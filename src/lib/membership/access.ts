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

type MembershipRow = { tier: string; membership_status: string };

/**
 * Pure predicate: given a member's membership rows, do they hold an ACTIVE
 * membership on a profile-bearing tier? Extracted so it can be unit-tested
 * without a database (CLAUDE.md guardrail #6 — the gate must not silently break).
 */
export function hasActiveProfileTierFromRows(rows: MembershipRow[]): boolean {
  const profileTiers = new Set<string>(PROFILE_TIER_SLUGS);
  return rows.some(
    (m) => m.membership_status === "active" && profileTiers.has(m.tier),
  );
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
    .select("tier, membership_status")
    .eq("user_id", userId)
    .eq("membership_status", "active");
  return hasActiveProfileTierFromRows((data as MembershipRow[] | null) ?? []);
}
