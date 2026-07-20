// The FREE FOUNDING PERIOD — complimentary memberships.
//
// ── Why this exists ──
// Launch decision (2026-07-20): Relevé opens free. No $30 application fee, and
// approved members get their first year at no charge; paid membership is
// switched on later.
//
// The subtlety that makes this more than "skip the payment step": essentially the
// whole product is gated on an ACTIVE membership row — the Roster, the profile
// builder, connections, messaging. Simply not charging would leave every accepted
// member locked out of the thing they were accepted into.
//
// ── Why a comp MEMBERSHIP ROW, not a "free mode" flag ──
// Granting a real membership row means:
//   · zero changes to any gate. hasAnyActiveMembership / hasActiveProfileTier and
//     every caller keep working untouched — no security-adjacent logic is edited
//     for a temporary pricing decision, and nothing has to be unpicked later.
//   · every comp is a visible, queryable, auditable row (`source = 'founding_comp'`)
//     — you can count them, expire them, and see exactly who got one.
//   · switching payment on is "stop calling this function"; the existing Stripe
//     checkout path is already the fallback and was never disabled.
//
// The row deliberately carries NO Stripe ids and price_cents = 0, so it can never
// be confused with revenue in reporting.

import type { SupabaseClient } from "@supabase/supabase-js";
import { TIERS, type TierSlug } from "./tiers";

/** Marks a membership as a founding-period comp. Query this to find them all. */
export const FOUNDING_COMP_SOURCE = "founding_comp";

/** Free for ONE YEAR from activation (founder decision, 2026-07-20). */
export const FOUNDING_FREE_MONTHS = 12;

/**
 * Which tier a newly-approved applicant is comped into.
 *
 * Studio owners are the employer side and get the entry studio tier; everyone
 * else gets Professional, the tier that opens the profile builder. Deliberately
 * conservative — Professional·Full and the higher studio tiers are upsells, not
 * something to hand out by default.
 */
export function foundingTierFor(roles: string[] | null): TierSlug {
  const list = roles ?? [];
  const isStudioOnly =
    list.includes("studio_owner") &&
    !list.some((r) => r === "teacher" || r === "choreographer" || r === "working_dancer");

  return isStudioOnly ? "studio_connect" : "professional";
}

/** The date the free year ends, from `from` (defaults to now). */
export function foundingRenewalDate(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + FOUNDING_FREE_MONTHS);
  return end;
}

export type GrantResult =
  | { granted: true; tier: TierSlug; renewalDate: string }
  | { granted: false; reason: "already_active" | "error"; detail?: string };

/**
 * Give a user a complimentary founding membership.
 *
 * Idempotent: if they already hold ANY active membership (comped or paid) this
 * does nothing, so re-approving an application can never stack memberships or
 * silently extend someone's free year.
 *
 * Never throws — a failure here must not fail the admin's approve click. The
 * result is returned so the caller can surface it.
 *
 * @param db an ADMIN client. Members cannot write their own membership rows.
 */
export async function grantFoundingMembership(
  db: SupabaseClient,
  userId: string,
  roles: string[] | null,
): Promise<GrantResult> {
  try {
    const { data: existing, error: readErr } = await db
      .from("memberships")
      .select("membership_id")
      .eq("user_id", userId)
      .eq("membership_status", "active")
      .limit(1);

    if (readErr) return { granted: false, reason: "error", detail: readErr.message };
    if (existing && existing.length > 0) return { granted: false, reason: "already_active" };

    const tier = foundingTierFor(roles);
    const renewal = foundingRenewalDate();

    const { error } = await db.from("memberships").insert({
      user_id: userId,
      tier,
      // Zero, not the list price: this is not revenue and must never look like it.
      price_cents: 0,
      term: "annual",
      membership_status: "active",
      renewal_date: renewal.toISOString(),
      source: FOUNDING_COMP_SOURCE,
      // stripe_customer_id / stripe_subscription_id stay NULL — there is no
      // subscription behind this, and nothing should try to manage one.
    });

    if (error) return { granted: false, reason: "error", detail: error.message };

    return {
      granted: true,
      tier,
      renewalDate: renewal.toISOString(),
    };
  } catch (err) {
    return { granted: false, reason: "error", detail: (err as Error).message };
  }
}

/** Human label for a tier, for email copy. */
export function tierLabel(slug: TierSlug): string {
  return TIERS[slug].label;
}
