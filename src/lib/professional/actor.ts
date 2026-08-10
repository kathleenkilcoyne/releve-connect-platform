// The professional "actor" — the adult-to-adult safety wall in app code.
//
// Slice 0 (PROFESSIONAL-IDENTITY-ARCHITECTURE §5/§9.1): the professional discovery
// + messaging graph is ADULTS ONLY. An eligible participant ("actor") is a
// professional (`talent_profiles`) or a studio/employer (`employer_profiles`).
// Students/minors and families/guardians are NEVER actors — they live in the
// separate affiliations + communications + This Week pilot.
//
// This is the app-layer mirror of the SQL `is_professional_actor()` primitive
// (see migration 20260809120000). Defense in depth: the DB is the hard boundary,
// this gate keeps the UI and server actions from ever offering a
// discovery/messaging path to a non-actor.

import type { SupabaseClient } from "@supabase/supabase-js";

/** What an identity is allowed to do in the professional graph. */
export interface ActorClassification {
  /** Has a `talent_profiles` row — a vetted/known professional. */
  isProfessional: boolean;
  /** Owns an `employer_profiles` row — a studio/employer. */
  isStudio: boolean;
  /** Eligible participant in the professional discovery/messaging graph. */
  isActor: boolean;
}

/* ─────────────────────────────  Pure core  ───────────────────────────────── */

/**
 * Classify an identity from the two facts that decide it. Pure, so the wall's
 * semantics are provable without a database: a professional OR a studio is an
 * actor; anyone who is NEITHER (a family guardian, a student's user) is not.
 */
export function classifyActor(input: {
  hasTalentProfile: boolean;
  ownsEmployer: boolean;
}): ActorClassification {
  const isProfessional = input.hasTalentProfile;
  const isStudio = input.ownsEmployer;
  return { isProfessional, isStudio, isActor: isProfessional || isStudio };
}

/* ────────────────────────────  DB resolution  ────────────────────────────── */

export interface ProfessionalActor extends ActorClassification {
  userId: string;
  /** The professional's profile id + public handle, when they have one. */
  talentProfileId: string | null;
  publicSlug: string | null;
  /** The studio/employer they own, when they own one. */
  employerId: string | null;
}

/**
 * Resolve a user's actor status from the two identity tables. Read with whatever
 * client the caller passes (the server components use the admin client, mirroring
 * AdminConsoleLink, so the check can't drift with an RLS change elsewhere).
 */
export async function resolveProfessionalActor(
  db: SupabaseClient,
  userId: string,
): Promise<ProfessionalActor> {
  const [{ data: talent }, { data: employer }] = await Promise.all([
    db.from("talent_profiles").select("profile_id, public_slug").eq("user_id", userId).maybeSingle(),
    db.from("employer_profiles").select("employer_id").eq("owner_user_id", userId).limit(1).maybeSingle(),
  ]);
  const t = talent as { profile_id: string; public_slug: string | null } | null;
  const e = employer as { employer_id: string } | null;
  const cls = classifyActor({ hasTalentProfile: Boolean(t), ownsEmployer: Boolean(e) });
  return {
    userId,
    talentProfileId: t?.profile_id ?? null,
    publicSlug: t?.public_slug ?? null,
    employerId: e?.employer_id ?? null,
    ...cls,
  };
}

/** True iff the user may participate in the professional discovery/messaging graph. */
export async function isProfessionalActor(db: SupabaseClient, userId: string): Promise<boolean> {
  return (await resolveProfessionalActor(db, userId)).isActor;
}
