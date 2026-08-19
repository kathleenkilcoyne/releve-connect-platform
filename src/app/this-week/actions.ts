"use server";

// The "Got it" write. A guardian taps an event on their This Week; this records
// the acknowledgement. It runs as the CALLER (cookie-backed client), so the
// event_acknowledgements RLS INSERT policy — not app code — is what authorizes
// the write: a guardian may only acknowledge an event their dancer is enrolled in
// (targeted) or a studio-wide event at their studio (family-level). No admin
// client, no service-role bypass.

import { createClient } from "@/lib/supabase/server";
import type { EventAck } from "@/lib/this-week/types";

export type AckInput = Pick<EventAck, "sessionId" | "scope" | "studentIds" | "familyId">;
export type AckResult = { ok: boolean; acknowledgedAt?: string; error?: string };

/** True when a Postgres error is a unique-violation (already acknowledged). */
function isDuplicate(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export async function acknowledgeEvent(input: AckInput): Promise<AckResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const acknowledgedAt = new Date().toISOString();

  if (input.scope === "studio_wide") {
    // One family-level row for the whole-studio occurrence.
    const { error } = await supabase.from("event_acknowledgements").insert({
      session_id: input.sessionId,
      student_id: null,
      family_id: input.familyId,
      acknowledged_by: user.id,
    });
    if (error && !isDuplicate(error)) {
      console.error("[ack] studio-wide insert failed:", error.message);
      return { ok: false, error: "Couldn't save that just now — please try again." };
    }
    return { ok: true, acknowledgedAt };
  }

  // Targeted: one row per enrolled dancer this card covers (usually one).
  const rows = input.studentIds.map((sid) => ({
    session_id: input.sessionId,
    student_id: sid,
    family_id: input.familyId,
    acknowledged_by: user.id,
  }));
  if (rows.length === 0) return { ok: false, error: "Nothing to acknowledge." };

  const { error } = await supabase.from("event_acknowledgements").insert(rows);
  if (error && !isDuplicate(error)) {
    console.error("[ack] targeted insert failed:", error.message);
    return { ok: false, error: "Couldn't save that just now — please try again." };
  }
  return { ok: true, acknowledgedAt };
}

/* ══════════════════════════════════════════════════════════════════════════
   THE WRITE PATH — a professional's own This Week entries.

   Until 2026-08-18 nothing in the product wrote `personal_events`; This Week
   rendered an empty week for every professional. These are the writes.

   Every one of them runs as the CALLER (cookie-backed client, no admin client,
   no service-role bypass), so RLS is what authorizes them:
     · personal_events      — ONE policy, owner-only, ALL. No studio, guardian
                              or teacher read path exists at all.
     · service_availability — insert/update/delete own.

   ── The firewall (ratified 2026-08-18) ──
   "Only publish when the member explicitly marks a window public."
   A personal_events row is ALWAYS private. Publishing is the creation of a
   SEPARATE service_availability row; unpublishing DELETES that row and never
   edits the private event. Only starts/ends/timezone/service cross over — the
   projection that decides is `toPublicWindow` in lib/this-week/entry.ts, which
   physically cannot read a title or a note.
   ══════════════════════════════════════════════════════════════════════════ */

import { revalidatePath } from "next/cache";
import { validateEntry, type EntryInput, type FieldError } from "@/lib/this-week/entry";

export type EntryResult =
  | { ok: true; eventId: string; published: boolean }
  | { ok: false; errors: FieldError[] };

const fail = (field: string, message: string): EntryResult => ({
  ok: false,
  errors: [{ field, message }],
});

/** Resolve the caller's own profile and their active My Services ids. */
async function callerContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profileId: null, serviceIds: [] as string[] };

  const { data: profile } = await supabase
    .from("talent_profiles")
    .select("profile_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const profileId = (profile as { profile_id: string } | null)?.profile_id ?? null;
  if (!profileId) return { supabase, profileId: null, serviceIds: [] as string[] };

  // My Services is the source of truth for what this person offers. This Week
  // never asks them to name a service again — it reads these.
  const { data: services } = await supabase
    .from("professional_offerings")
    .select("id")
    .eq("profile_id", profileId)
    .eq("status", "active");

  return {
    supabase,
    profileId,
    serviceIds: ((services ?? []) as Array<{ id: string }>).map((s) => s.id),
  };
}

/** Turn a Postgres error into something a person can act on. */
function humanize(error: { code?: string; message?: string } | null): string {
  if (error?.code === "23P01") {
    // service_availability_no_overlap — the EXCLUDE constraint.
    return "You already have a public window that overlaps these hours.";
  }
  if (error?.code === "23514") {
    return "That window isn't valid — check the times and the service.";
  }
  return "Couldn't save that just now — please try again.";
}

/**
 * Create one entry on the member's own calendar, optionally publishing a window
 * for it in the same action.
 */
export async function createEntry(input: EntryInput): Promise<EntryResult> {
  const { supabase, profileId, serviceIds } = await callerContext();
  if (!profileId) return fail("form", "Only a professional with a profile can add to This Week.");

  const validated = validateEntry(input, serviceIds);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  const { event, publish } = validated.value;

  const { data, error } = await supabase
    .from("personal_events")
    .insert({ profile_id: profileId, ...event })
    .select("event_id")
    .single();

  if (error || !data) {
    console.error("[this-week] entry insert failed:", error?.message);
    return fail("form", humanize(error));
  }
  const eventId = (data as { event_id: string }).event_id;

  if (publish) {
    const { error: pubError } = await supabase.from("service_availability").insert({
      profile_id: profileId,
      offering_id: publish.offering_id,
      starts_at: publish.starts_at,
      ends_at: publish.ends_at,
      timezone: publish.timezone,
      status: "open",
      // Links the public window back to its private source for the OWNER only —
      // this column is REVOKEd from anon/authenticated SELECT (20260815173203),
      // so it can never be read back through the API by anyone.
      source_personal_event_id: eventId,
    });
    if (pubError) {
      // The private entry is kept. Publishing is a separate, explicit act, and
      // failing it must not silently discard what the member just wrote.
      console.error("[this-week] publish failed:", pubError.message);
      revalidatePath("/this-week");
      return fail("publish", humanize(pubError));
    }
  }

  revalidatePath("/this-week");
  return { ok: true, eventId, published: Boolean(publish) };
}

/**
 * Delete one of the member's own entries.
 *
 * Any public window derived from it goes too — `service_availability`'s FK to
 * `personal_events` is ON DELETE SET NULL, so the window would otherwise outlive
 * its source and keep advertising hours the member has removed. Deleted first so
 * a failure leaves the private event intact rather than a public orphan.
 */
export async function deleteEntry(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, profileId } = await callerContext();
  if (!profileId) return { ok: false, error: "Please sign in." };

  const { error: windowError } = await supabase
    .from("service_availability")
    .delete()
    .eq("profile_id", profileId)
    .eq("source_personal_event_id", eventId);
  if (windowError) {
    console.error("[this-week] window delete failed:", windowError.message);
    return { ok: false, error: "Couldn't remove the public window — please try again." };
  }

  const { error } = await supabase
    .from("personal_events")
    .delete()
    .eq("event_id", eventId)
    .eq("profile_id", profileId);
  if (error) {
    console.error("[this-week] entry delete failed:", error.message);
    return { ok: false, error: "Couldn't remove that entry — please try again." };
  }

  revalidatePath("/this-week");
  return { ok: true };
}

/**
 * Take a published window down. Deletes the PUBLIC row only — the private entry
 * is untouched, because unpublishing means "stop advertising", not "forget".
 */
export async function unpublishEntry(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, profileId } = await callerContext();
  if (!profileId) return { ok: false, error: "Please sign in." };

  const { error } = await supabase
    .from("service_availability")
    .delete()
    .eq("profile_id", profileId)
    .eq("source_personal_event_id", eventId);

  if (error) {
    console.error("[this-week] unpublish failed:", error.message);
    return { ok: false, error: "Couldn't take that down — please try again." };
  }

  revalidatePath("/this-week");
  return { ok: true };
}
