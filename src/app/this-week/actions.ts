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
    // A guardian family: ONE family-level row (student_id null) for the whole-studio
    // occurrence. A self-managed adult (dance team) has no family_account, so their
    // row is keyed to their OWN student row instead — same "one row per
    // acknowledger", deduped by the existing (session_id, student_id) unique index.
    const selfStudentId = input.familyId === null ? input.studentIds[0] ?? null : null;
    if (input.familyId === null && selfStudentId === null) {
      return { ok: false, error: "Nothing to acknowledge." };
    }
    const { error } = await supabase.from("event_acknowledgements").insert({
      session_id: input.sessionId,
      student_id: selfStudentId,
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
