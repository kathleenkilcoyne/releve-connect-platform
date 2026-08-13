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
 * Pure predicate: does the member hold ANY active membership (any tier)? This is
 * the Roster-access gate — browsing the directory is a paid benefit that starts
 * at Live Pass (§5), so any active tier (Live Pass, Professional, or a studio
 * tier) qualifies. Extracted for unit tests (guardrail #6).
 */
export function hasAnyActiveMembershipFromRows(rows: MembershipRow[]): boolean {
  return rows.some((m) => m.membership_status === "active");
}

/**
 * Pure predicate: does the professional currently have profile access — via an
 * active Professional-tier MEMBERSHIP, or via an active, in-window ACTIVATION
 * (the unified membership model §3: the $30 activation's window grants access,
 * no throwaway membership row). Extracted so the gate is provable (guardrail #6).
 *
 * @param activationExpiries `access_expires_at` (ISO) of the caller's ACTIVE
 *   professional activations; a null/absent expiry never grants access.
 */
export function professionalAccessFromRows(input: {
  membershipRows: MembershipRow[];
  activationExpiries: Array<string | null>;
  now: Date;
}): boolean {
  if (hasActiveProfileTierFromRows(input.membershipRows)) return true;
  return input.activationExpiries.some(
    (iso) => iso != null && new Date(iso).getTime() >= input.now.getTime(),
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

/**
 * Does this professional currently have profile access — an active Professional
 * membership OR an active, in-window activation? This is the gate the profile
 * builder uses under the unified membership model. Pass a request-scoped client;
 * reads only this user's own rows.
 */
export async function hasActiveProfessionalAccess(
  db: SupabaseLike,
  userId: string,
): Promise<boolean> {
  const [membershipRes, activationRes] = await Promise.all([
    db
      .from("memberships")
      .select("tier, membership_status")
      .eq("user_id", userId)
      .eq("membership_status", "active"),
    db
      .from("activations")
      .select("access_expires_at")
      .eq("user_id", userId)
      .eq("membership_family", "professional")
      .eq("status", "active"),
  ]);
  return professionalAccessFromRows({
    membershipRows: (membershipRes.data as MembershipRow[] | null) ?? [],
    activationExpiries: (
      (activationRes.data as Array<{ access_expires_at: string | null }> | null) ?? []
    ).map((r) => r.access_expires_at),
    now: new Date(),
  });
}

/**
 * Does this user hold ANY active membership? Gates Roster access (§5). Pass a
 * request-scoped Supabase client; reads only this user's own membership rows.
 */
export async function hasAnyActiveMembership(
  db: SupabaseLike,
  userId: string,
): Promise<boolean> {
  const { data } = await db
    .from("memberships")
    .select("tier, membership_status")
    .eq("user_id", userId)
    .eq("membership_status", "active");
  return hasAnyActiveMembershipFromRows((data as MembershipRow[] | null) ?? []);
}
