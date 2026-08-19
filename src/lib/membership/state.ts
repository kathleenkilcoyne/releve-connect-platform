// What is this person's membership situation?
//
// ── Why this exists (F1–F4, 2026-08-18) ──
// `/subscribe` used to ask "does this person have a membership?" — a yes/no
// question — when the real question has nine answers. That single missing
// distinction produced two loops that were live in the product:
//
//   · an active Live Pass holder was told "You're a founding member 🎉" and
//     handed a "Build your profile" button. Live Pass is `hasProfile: false`,
//     so /profile/edit bounced them back here. Forever.
//   · a member who had just paid sat in `pending` until the webhook landed
//     (three minutes, observed) and bounced the same way in the meantime.
//
// Rewriting the page without fixing the question would only relocate the bug,
// so the question is answered HERE — once, purely, and unit-tested without a
// database, the same way `lib/membership/access.ts` extracts its predicates
// under CLAUDE.md guardrail #6.
//
// Nothing in this file reads Supabase, Stripe, cookies, or the clock. The
// caller gathers the rows and passes `now`; this decides.

import { getTier, TIERS, type TierSlug } from "./tiers";
import { FOUNDING_COMP_SOURCE } from "./founding";
import { FOUNDER_COMP_SOURCES } from "@/lib/founding/founding-professional";

/* ───────────────────────────  Complimentary  ──────────────────────────── */

/**
 * Every membership `source` that means "Relevé gave this to them."
 *
 * Two vocabularies grew independently and both are live in production:
 *   · `founding_comp`                              (lib/membership/founding.ts)
 *   · `complimentary_permanent` | `complimentary_term`
 *                                    (lib/founding/founding-professional.ts)
 *
 * They are unified HERE, at the point of READING, deliberately. Migrating the
 * data would rewrite audit rows that record what was actually granted, and the
 * two grants genuinely differ (a founding-period comp is not a founder's
 * permanent entitlement). Every future comp vocabulary must be added to this
 * list or a founding member will be shown a paywall.
 */
export const COMPLIMENTARY_SOURCES: readonly string[] = [
  FOUNDING_COMP_SOURCE,
  ...FOUNDER_COMP_SOURCES,
];

export function isComplimentarySource(source: string | null | undefined): boolean {
  return source != null && COMPLIMENTARY_SOURCES.includes(source);
}

/* ─────────────────────────────  The states  ───────────────────────────── */

export type MembershipState =
  /** Not signed in. Still shown the tiers — a stranger must be able to buy. */
  | "signed_out"
  /** Paid moments ago; the webhook has not landed yet. NEVER redirect. */
  | "pending"
  /** A CURRENTLY VALID complimentary entitlement. Warm copy, no prices. */
  | "comp"
  /** A complimentary TERM that has run out. See the note on F9 below. */
  | "comp_expired"
  /** Active, paid, profile-bearing (Professional / Creator). */
  | "active_profile_tier"
  /**
   * Active, paid Live Pass — a REAL membership in its own right (founder
   * clarification 2026-08-18): $99/year for a family, carrying family
   * participation, the monthly Zooms, news and resources, community viewing and
   * engagement, choreography purchase/licensing, the Relevé Passport and the
   * College Audition Cycle. It is NOT a lesser state on the way to
   * Professional, and it must never be sold to someone who already holds it.
   */
  | "active_live_pass"
  /** Active, paid studio tier — the employer side, never talent. */
  | "active_studio"
  /** A payment failed. A way back, never a locked door. */
  | "lapsed"
  /** Application approved, no membership row. The tier chooser. */
  | "approved_no_membership"
  /** Applied, awaiting a decision. */
  | "applied"
  /** Application declined. */
  | "declined"
  /** No application, no membership. */
  | "none";

/* ─────────────────────────────  The inputs  ───────────────────────────── */

/** One membership row, as much of it as this decision needs. */
export type MembershipStateRow = {
  tier: string;
  membership_status: string;
  source?: string | null;
  stripe_customer_id?: string | null;
  /** When the row last changed — the checkout route stamps this on `pending`. */
  updated_at?: string | null;
  created_at?: string | null;
  renewal_date?: string | null;
};

export type MembershipSituationInput = {
  /** Null when nobody is signed in. */
  userId: string | null;
  /** `users.account_type`. */
  accountType?: string | null;
  /** The most recent application's `state`, or null if they never applied. */
  applicationState?: string | null;
  /** True ONLY when a $30 application fee was really paid (never for a waiver). */
  applicationFeePaid?: boolean;
  /** Every membership row for this user. */
  membershipRows: MembershipStateRow[];
  /** Injected so the pending window is testable without faking the clock. */
  now?: Date;
};

/* ─────────────────────────────  The answer  ───────────────────────────── */

export type MembershipSituation = {
  state: MembershipState;
  /**
   * ORTHOGONAL to `state`, on purpose. The admin door renders in EVERY state.
   * Kathleen is an admin who may also hold a membership; if `admin` were an
   * exclusive state, activating one would hide the other. Signing in lands on
   * /profile/edit, which redirects here when there is no membership — so an
   * admin without one had no route to their own vetting queue at all. That cost
   * an evening once (see the comment this replaces at subscribe/page.tsx:49).
   */
  isAdmin: boolean;
  /** The tier of the row that decided the state; null when no row decided it. */
  tier: TierSlug | null;
  /** Does the deciding tier bear a Roster profile? Gates every profile CTA. */
  hasProfile: boolean;
  /**
   * F4 + F11 — the ONE condition the manage/cancel button renders on. Comp rows
   * carry no `stripe_customer_id` by design, so this is false for them and a
   * founding member is never shown a button that 404s.
   */
  canManageBilling: boolean;
  /** True only when a $30 fee was really paid, so the credit line is honest. */
  applicationFeeCredited: boolean;
  /**
   * When a complimentary entitlement runs out — `null` means LIFETIME.
   *
   * Complimentary is deliberately NOT hard-coded as free forever (founder rule,
   * 2026-08-18). Two populations are real and both must work:
   *   · lifetime founders            → `renewal_date` NULL  (never expires)
   *   · founding members on a term   → `renewal_date` set   (12 months, and
   *                                     `founding_comp` grants always set one)
   * Carried so copy can be honest about a date without this file deciding what
   * happens on it — that is F9, and it is Kathleen's to ratify.
   */
  compExpiresAt: string | null;
  /** Seconds since the pending row was written. Drives F2's ~90s hard stop. */
  pendingAgeSeconds: number | null;
  /**
   * A `pending` row too old to still be confirming — almost always an ABANDONED
   * Checkout, occasionally a badly delayed webhook. We cannot tell the two
   * apart from our own database, so the state falls through to what they really
   * hold (no dead end for the abandoner) and the page shows a calm note (no
   * silent second charge for the payer).
   */
  stalePendingTier: TierSlug | null;
  /** The application state, carried through so the chooser can use it. */
  applicationState: string | null;
  accountType: string | null;
};

/**
 * How long a `pending` row is treated as genuinely in flight.
 *
 * The checkout route writes `pending` BEFORE redirecting to Stripe, so an
 * abandoned Checkout leaves a `pending` row behind permanently. Holding such a
 * person on "Confirming your payment…" forever would be the exact dead end this
 * sprint exists to remove. Fifteen minutes is comfortably longer than the worst
 * webhook delay observed (three minutes) and far shorter than a return visit.
 */
export const PENDING_FRESH_SECONDS = 15 * 60;

/** After this long, F2's panel stops spinning and says we will email them. */
export const PENDING_PATIENCE_SECONDS = 90;

function ageSeconds(row: MembershipStateRow, now: Date): number | null {
  const stamp = row.updated_at ?? row.created_at ?? null;
  if (!stamp) return null;
  const then = new Date(stamp).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / 1000));
}

function slugOf(row: MembershipStateRow): TierSlug | null {
  return getTier(row.tier)?.slug ?? null;
}

/**
 * Is a complimentary row's entitlement good RIGHT NOW?
 *
 *   · `renewal_date` NULL      → lifetime complimentary. Always valid.
 *   · `renewal_date` in future → a term still running.
 *   · `renewal_date` in past   → the term has ended.
 *
 * An unparseable date is treated as VALID: a founding member must never be
 * dropped out of their entitlement because of a malformed timestamp.
 */
function compIsValid(row: MembershipStateRow, now: Date): boolean {
  if (!row.renewal_date) return true;
  const ends = new Date(row.renewal_date).getTime();
  if (Number.isNaN(ends)) return true;
  return ends > now.getTime();
}

/**
 * Resolve the whole situation from rows. Pure: no database, no clock, no I/O.
 *
 * ── Precedence, and why it is this order ──
 * A person can hold several rows at once (a Live Pass holder upgrading, a comp
 * member who later paid). The order below answers "what is most urgently true
 * about this person right now?", which is the only ordering that never shows
 * someone copy meant for somebody else:
 *
 *   1. pending  — they handed us a card seconds ago. The most fragile moment in
 *                 the product; nothing may pre-empt it.
 *   2. comp     — Relevé gave it to them. Outranks the paid states so a founding
 *                 member never meets a price list, even if the comp sits on a
 *                 profile-bearing tier.
 *   3. active profile tier → 4. active non-profile → 5. lapsed
 *   6..9 — no membership at all; the application decides.
 */
export function resolveMembershipSituation(
  input: MembershipSituationInput,
): MembershipSituation {
  const now = input.now ?? new Date();
  const rows = input.membershipRows ?? [];
  const accountType = input.accountType ?? null;
  const isAdmin = accountType === "admin";
  const applicationState = input.applicationState ?? null;

  // The manage button's one condition (F4 + F11). Independent of state, so a
  // comp row that somehow carried a customer id is still warm copy — and a
  // lapsed member keeps the portal, which IS their recovery path.
  const canManageBilling = rows.some((r) => Boolean(r.stripe_customer_id));

  const base = {
    isAdmin,
    canManageBilling,
    applicationFeeCredited: false,
    compExpiresAt: null as string | null,
    pendingAgeSeconds: null as number | null,
    stalePendingTier: null as TierSlug | null,
    applicationState,
    accountType,
  };

  if (!input.userId) {
    return {
      ...base,
      state: "signed_out",
      tier: null,
      hasProfile: false,
      canManageBilling: false,
    };
  }

  const active = rows.filter((r) => r.membership_status === "active");
  const pendingRows = rows.filter((r) => r.membership_status === "pending");

  // ---- 1. pending -----------------------------------------------------------
  const fresh = pendingRows
    .map((r) => ({ row: r, age: ageSeconds(r, now) }))
    // A pending row with no usable timestamp is treated as fresh: erring toward
    // "we are confirming your payment" is safe; erring toward the chooser risks
    // a second charge.
    .filter(({ age }) => age === null || age <= PENDING_FRESH_SECONDS)
    .sort((a, b) => (a.age ?? 0) - (b.age ?? 0))[0];

  if (fresh) {
    const slug = slugOf(fresh.row);
    return {
      ...base,
      state: "pending",
      tier: slug,
      hasProfile: slug ? TIERS[slug].hasProfile : false,
      pendingAgeSeconds: fresh.age,
    };
  }

  // Any pending row that survives to here is stale. Carried, not acted on.
  const stale = pendingRows[0] ? slugOf(pendingRows[0]) : null;
  const withStale = { ...base, stalePendingTier: stale };

  // ---- 2. comp — but only while the entitlement is CURRENTLY VALID ----------
  // "comp" means a complimentary entitlement that is good right now. A lifetime
  // founder (renewal_date NULL) always qualifies; a founding member on a
  // 12-month term qualifies until their date passes. Nothing in the product
  // expires these rows today — the row stays `active` forever — so validity is
  // computed here rather than assumed from `membership_status`.
  const comps = active.filter((r) => isComplimentarySource(r.source));
  const validComp = comps.find((r) => compIsValid(r, now));
  if (validComp) {
    const slug = slugOf(validComp);
    return {
      ...withStale,
      state: "comp",
      tier: slug,
      hasProfile: slug ? TIERS[slug].hasProfile : false,
      compExpiresAt: validComp.renewal_date ?? null,
    };
  }

  // A complimentary TERM that has run out. Distinct on purpose: falling through
  // would quietly present a founding member's gift as a paid membership, and
  // there would be no way to see who is in this position. What SHOULD happen on
  // that date — grace, conversion, notice — is F9, and it is Kathleen's call, so
  // this state deliberately decides nothing beyond naming the situation.
  //
  // Unreachable in production until ~2027-07: the founding-period grants began
  // 2026-07-20 on a 12-month term.
  const expiredComp = comps[0];
  if (expiredComp) {
    const slug = slugOf(expiredComp);
    return {
      ...withStale,
      state: "comp_expired",
      tier: slug,
      hasProfile: slug ? TIERS[slug].hasProfile : false,
      compExpiresAt: expiredComp.renewal_date ?? null,
    };
  }

  // ---- 3. active, profile-bearing -------------------------------------------
  const profileRow = active.find((r) => {
    const slug = slugOf(r);
    return slug != null && TIERS[slug].hasProfile;
  });
  if (profileRow) {
    return {
      ...withStale,
      state: "active_profile_tier",
      tier: slugOf(profileRow),
      hasProfile: true,
    };
  }

  // ---- 4. active Live Pass — a real membership, not a waiting room ----------
  const livePass = active.find((r) => slugOf(r) === "live_pass");
  if (livePass) {
    return {
      ...withStale,
      state: "active_live_pass",
      tier: "live_pass",
      hasProfile: false,
    };
  }

  // ---- 5. active studio tier — the employer side ----------------------------
  const studioRow = active.find((r) => slugOf(r)?.startsWith("studio_") === true);
  if (studioRow) {
    return {
      ...withStale,
      state: "active_studio",
      tier: slugOf(studioRow),
      hasProfile: false,
    };
  }

  // ---- 6. lapsed ------------------------------------------------------------
  const lapsed = rows.find(
    (r) => r.membership_status === "lapsed" || r.membership_status === "canceled",
  );
  if (lapsed) {
    return { ...withStale, state: "lapsed", tier: slugOf(lapsed), hasProfile: false };
  }

  // ---- 6..9. no membership — the application decides -------------------------
  const noMembership = { ...withStale, tier: null, hasProfile: false };

  if (applicationState === "approved") {
    return {
      ...noMembership,
      state: "approved_no_membership",
      // The $30 line is claimed ONLY where it is true. A Founding 25 honoree
      // (fee waived) and a comp member never paid one, and must never be told
      // a credit was applied. Mirrors /subscribe/welcome's `credit_fee_id`.
      applicationFeeCredited: input.applicationFeePaid === true,
    };
  }
  if (applicationState === "declined") return { ...noMembership, state: "declined" };
  if (applicationState) return { ...noMembership, state: "applied" };
  return { ...noMembership, state: "none" };
}

/* ────────────────────────────  What to offer  ─────────────────────────── */

/**
 * Which tiers may this person actually BUY right now?
 *
 * Separate from the state on purpose: the state says who they are, this says
 * what the page may put a price on. The rule the whole sprint is held to —
 * "never shown a price that doesn't apply to them" — lives here.
 *
 * The trap this closes (founder rule, 2026-08-18): the vetted tiers 403 at
 * /api/membership/checkout without an APPROVED application. A Live Pass holder
 * who never applied, offered an "Upgrade to Professional" button, would click
 * it and get an error. Professional/Creator is a separate professional
 * PATHWAY, not an upsell — so when someone has not been approved for the
 * Roster, the right action is to apply (see `professionalPathway` below), never
 * a checkout button that cannot succeed.
 */
export function offeredTiers(s: MembershipSituation): TierSlug[] {
  const approved = s.applicationState === "approved";
  const vetted: TierSlug[] = ["professional", "professional_full"];
  const studio: TierSlug[] = ["studio_connect", "studio_growth", "studio_accelerator"];
  const isStudioSide =
    s.accountType === "employer" || s.tier?.startsWith("studio_") === true;

  switch (s.state) {
    // Nothing to sell: they hold it, or we gave it to them, or it is in flight.
    case "pending":
    case "comp":
      return [];

    // What happens when a complimentary term ends is F9, and unratified. Until
    // it is decided nothing is sold here — a founding member is not handed a
    // price list by a default that nobody chose.
    case "comp_expired":
      return [];

    // They already have a profile tier. Creator is the only step up.
    case "active_profile_tier":
      return s.tier === "professional" ? ["professional_full"] : [];

    // Live Pass is a REAL membership they already hold — never sell it to them
    // again. The professional tiers are a separate pathway, offered only when
    // they have genuinely been approved for the Roster.
    case "active_live_pass":
      return approved ? vetted : [];

    // A studio's own lane, minus what they already hold.
    case "active_studio":
      return studio.filter((t) => t !== s.tier);

    // A recovery path is the billing portal (F4), not a fresh purchase.
    case "lapsed":
      return [];

    // Approved: the vetted tiers, which is what they were approved for.
    case "approved_no_membership":
      return vetted;

    // Everyone else: Live Pass needs no application, so it is always honest.
    // Studios are not vetted either, so an employer sees their own lane.
    case "signed_out":
    case "none":
    case "applied":
    case "declined":
      return isStudioSide ? studio : ["live_pass"];
  }
}

/**
 * How does this person reach the Professional Roster from where they stand?
 *
 * Separate from `offeredTiers` because the professional tiers are a PATHWAY,
 * not an upsell (founder rule, 2026-08-18). The honest action for someone who
 * has not been vetted is to APPLY; putting a price in front of them instead
 * produces a 403 at checkout, which is exactly the friction this sprint exists
 * to remove.
 *
 *   · `purchase`     — approved; a checkout that will actually succeed.
 *   · `apply`        — never applied; the application is the door.
 *   · `under_review` — applied, awaiting a decision. Reassure, sell nothing.
 *   · `none`         — not applicable: already on a profile tier, complimentary,
 *                      the studio side, mid-purchase, lapsed, or declined.
 */
export type ProfessionalPathway = "purchase" | "apply" | "under_review" | "none";

export function professionalPathway(s: MembershipSituation): ProfessionalPathway {
  // Already holds — or is moments from holding — a profile-bearing membership.
  if (s.hasProfile) return "none";
  if (s.state === "pending") return "none";
  // Complimentary members are Relevé's guests. Never solicited here.
  if (s.state === "comp" || s.state === "comp_expired") return "none";
  // The employer side is not talent, and the two must never be blurred.
  if (s.accountType === "employer" || s.tier?.startsWith("studio_") === true) return "none";
  // A failed payment is resolved through the billing portal, not an application.
  if (s.state === "lapsed") return "none";

  const offered = offeredTiers(s);
  if (offered.includes("professional") || offered.includes("professional_full")) {
    return "purchase";
  }

  const app = s.applicationState;
  if (app === null) return "apply";
  if (app === "declined") return "none";
  return "under_review";
}
