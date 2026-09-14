// The Professional-membership gate for the profile builder.
//
// Build spec §6 + §17: the profile is what the Professional tier SELLS, so
// building/publishing a profile is gated behind an ACTIVE membership on a
// profile-bearing tier (Professional $149 or Professional · Full $199). Live
// Pass $99 has no profile; studios are the employer side, not talent.
//
// This centralizes the check that used to live inline in /subscribe. It reads
// the caller's own `memberships` rows (RLS-safe: pass the request-scoped client),
// so it can be reused by the /profile/edit gate and anywhere else.

import { TIERS, type TierSlug } from "./tiers";

/** The tiers that grant a built, vetted Roster profile (hasProfile === true). */
export const PROFILE_TIER_SLUGS: TierSlug[] = (
  Object.keys(TIERS) as TierSlug[]
).filter((slug) => TIERS[slug].hasProfile);

type MembershipRow = { tier: string; membership_status: string; grace_until?: string | null };

/**
 * Is this row "active for access" right now? `active` alone counts; so does
 * `active` with a `grace_until` that hasn't passed yet (the 14-day
 * failed-renewal grace period — see lib/membership/grace.ts). A `grace_until`
 * in the past means the window already lapsed — nothing flips the status
 * automatically on day 14, so this comparison IS the enforcement.
 */
function isActiveForAccess(m: MembershipRow, now: Date): boolean {
  if (m.membership_status !== "active") return false;
  if (!m.grace_until) return true;
  return now.getTime() < new Date(m.grace_until).getTime();
}

/**
 * Pure predicate: given a member's membership rows, do they hold an ACTIVE
 * membership on a profile-bearing tier? Extracted so it can be unit-tested
 * without a database (CLAUDE.md guardrail #6 — the gate must not silently break).
 */
export function hasActiveProfileTierFromRows(rows: MembershipRow[], now: Date = new Date()): boolean {
  const profileTiers = new Set<string>(PROFILE_TIER_SLUGS);
  return rows.some((m) => isActiveForAccess(m, now) && profileTiers.has(m.tier));
}

/**
 * Pure predicate: does the member hold ANY active membership (any tier)?
 *
 * NOT a Roster-view gate — the Roster and public professional profiles are
 * PUBLIC DISCOVERY, open to anyone, no login or membership required (the
 * auth-free gate was removed from /roster on 2026-08-25; confirmed again
 * 2026-09-01, founder decision, superseding the earlier §5 design where
 * browsing was itself a paid benefit). This predicate gates only PRIVATE
 * PARTICIPATION actions on a profile — saving / requesting an intro (see
 * `canConnect` in src/lib/connections/messages.ts and its callers in
 * src/lib/connections/actions.ts) — where any active tier (Live Pass,
 * Professional, or a studio tier) still qualifies. Extracted for unit tests
 * (guardrail #6).
 */
export function hasAnyActiveMembershipFromRows(rows: MembershipRow[], now: Date = new Date()): boolean {
  return rows.some((m) => isActiveForAccess(m, now));
}

/**
 * Loose shape of a Supabase-like client — just enough to run our one read,
 * without importing Supabase's heavily-generic types (which trip TS's
 * deep-instantiation guard). Any of this project's clients satisfies it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (table: string) => any };

/**
 * Does this user currently have an active Professional-tier membership?
 * Pass a request-scoped Supabase client (cookie/RLS or admin — both work; the
 * query only ever reads this user's own rows).
 */
export async function hasActiveProfileTier(
  db: SupabaseLike,
  userId: string,
): Promise<boolean> {
  const { data } = await db
    .from("memberships")
    .select("tier, membership_status, grace_until")
    .eq("user_id", userId)
    .eq("membership_status", "active");
  return hasActiveProfileTierFromRows((data as MembershipRow[] | null) ?? []);
}

/**
 * Does this user hold ANY active membership? Gates PRIVATE PARTICIPATION on a
 * profile (save / intro-request) — NOT Roster viewing, which is public (see
 * hasAnyActiveMembershipFromRows above). Pass a request-scoped Supabase client;
 * reads only this user's own membership rows.
 */
export async function hasAnyActiveMembership(
  db: SupabaseLike,
  userId: string,
): Promise<boolean> {
  const { data } = await db
    .from("memberships")
    .select("tier, membership_status, grace_until")
    .eq("user_id", userId)
    .eq("membership_status", "active");
  return hasAnyActiveMembershipFromRows((data as MembershipRow[] | null) ?? []);
}
