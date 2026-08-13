"use server";

// Server actions for Licensing on the professional home. Owner-scoped at the
// database layer: `talent_profiles` writes are gated by `user_id = auth.uid()`,
// and `works` writes by the `owns_talent_profile(profile_id)` RLS policy — so a
// member can only ever touch their own flag and their own works. The status
// lifecycle is ALSO enforced here (never trust the client to pick the next
// state): every mutation re-reads the current status and asks the pure machine.
//
// Kept separate from actions.ts (the Slice 1 Swing action) so this is purely
// additive — no existing file is rewritten.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProfessionalActor } from "@/lib/professional/actor";
import {
  artistTransition,
  canArtistEdit,
  WORK_SELECT,
  type WorkInput,
  type WorkRecord,
  type WorkStatus,
} from "@/lib/professional/licensing";

/* ───────────────────────────────  helpers  ──────────────────────────────── */

/** Resolve the caller's own talent profile id, or null if they aren't a pro. */
async function callerProfileId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const actor = await resolveProfessionalActor(createAdminClient(), user.id);
  return actor.isProfessional ? actor.talentProfileId : null;
}

const trimOrNull = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

/** Coerce a year field to a sane 4-digit int, or null. */
function parseYear(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n < 1900 || n > 2100) return null;
  return n;
}

/** Normalize the form payload into the columns `works` accepts. */
function cleanInput(input: WorkInput) {
  return {
    title: (input.title ?? "").trim(),
    work_type: trimOrNull(input.work_type),
    style: trimOrNull(input.style),
    cast_size: trimOrNull(input.cast_size),
    duration: trimOrNull(input.duration),
    level_audience: trimOrNull(input.level_audience),
    year_created: parseYear(input.year_created),
    description: trimOrNull(input.description),
    preview_video_url: trimOrNull(input.preview_video_url),
    origin: trimOrNull(input.origin),
    license_type: trimOrNull(input.license_type),
  };
}

export interface ToggleResult {
  ok: boolean;
  on: boolean;
}

export interface WorkResult {
  ok: boolean;
  work?: WorkRecord;
  error?: string;
}

/* ─────────────────────────────  the actions  ────────────────────────────── */

/** Flip the signed-in professional's Available-for-Licensing capability. */
export async function setAvailableForLicensing(on: boolean): Promise<ToggleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, on: !on };

  // Owner-scoped write: RLS restricts this to the caller's own row.
  const { error } = await supabase
    .from("talent_profiles")
    .update({ available_for_licensing: on })
    .eq("user_id", user.id);

  if (error) return { ok: false, on: !on };
  revalidatePath("/profile");
  return { ok: true, on };
}

/** Create a new work in DRAFT. Never auto-publishes. */
export async function addWork(input: WorkInput): Promise<WorkResult> {
  const profileId = await callerProfileId();
  if (!profileId) return { ok: false, error: "not_a_professional" };

  const clean = cleanInput(input);
  if (!clean.title) return { ok: false, error: "title_required" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("works")
    .insert({ profile_id: profileId, status: "draft", ...clean })
    .select(WORK_SELECT)
    .single();

  if (error || !data) return { ok: false, error: "insert_failed" };
  revalidatePath("/profile");
  return { ok: true, work: data as unknown as WorkRecord };
}

/** Edit a work's fields — allowed only while it's a draft or was returned. */
export async function updateWork(workId: string, input: WorkInput): Promise<WorkResult> {
  const profileId = await callerProfileId();
  if (!profileId) return { ok: false, error: "not_a_professional" };

  const clean = cleanInput(input);
  if (!clean.title) return { ok: false, error: "title_required" };

  const supabase = await createClient();
  // Re-read status through the RLS client (returns the row only if it's mine).
  const { data: current } = await supabase
    .from("works")
    .select("status")
    .eq("work_id", workId)
    .maybeSingle();
  const status = (current as { status: WorkStatus } | null)?.status;
  if (!status) return { ok: false, error: "not_found" };
  if (!canArtistEdit(status)) return { ok: false, error: "locked" };

  const { data, error } = await supabase
    .from("works")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("work_id", workId)
    .select(WORK_SELECT)
    .single();

  if (error || !data) return { ok: false, error: "update_failed" };
  revalidatePath("/profile");
  return { ok: true, work: data as unknown as WorkRecord };
}

/** Submit a work for admin review (draft/returned → submitted). */
export async function submitWork(workId: string): Promise<WorkResult> {
  return transition(workId, "submit");
}

/** Withdraw a still-unreviewed submission (submitted → draft). */
export async function withdrawWork(workId: string): Promise<WorkResult> {
  return transition(workId, "withdraw");
}

async function transition(
  workId: string,
  action: "submit" | "withdraw",
): Promise<WorkResult> {
  const profileId = await callerProfileId();
  if (!profileId) return { ok: false, error: "not_a_professional" };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("works")
    .select("status")
    .eq("work_id", workId)
    .maybeSingle();
  const status = (current as { status: WorkStatus } | null)?.status;
  if (!status) return { ok: false, error: "not_found" };

  const next = artistTransition(status, action);
  if (!next) return { ok: false, error: "illegal_transition" };

  const patch: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() };
  // Stamp the submission time when entering review; leave it on withdraw so the
  // history of "was submitted at" isn't lost.
  if (action === "submit") patch.submitted_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("works")
    .update(patch)
    .eq("work_id", workId)
    .select(WORK_SELECT)
    .single();

  if (error || !data) return { ok: false, error: "update_failed" };
  revalidatePath("/profile");
  return { ok: true, work: data as unknown as WorkRecord };
}
