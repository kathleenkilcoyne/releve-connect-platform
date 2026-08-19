import { describe, it, expect } from "vitest";
import {
  COMPLIMENTARY_SOURCES,
  isComplimentarySource,
  offeredTiers,
  PENDING_FRESH_SECONDS,
  professionalPathway,
  resolveMembershipSituation,
  type MembershipSituationInput,
  type MembershipStateRow,
} from "./state";
import { FOUNDING_COMP_SOURCE } from "./founding";
import {
  COMP_PERMANENT_SOURCE,
  COMP_TERM_SOURCE,
} from "@/lib/founding/founding-professional";

// The membership-state resolver decides what every person is told about their
// own membership. Getting it wrong is what produced the two live loops this
// sprint exists to close, so it is tested without a database — the same
// discipline `access.test.ts` applies to the profile gate (guardrail #6).

const NOW = new Date("2026-08-18T12:00:00.000Z");

/** A timestamp `seconds` before NOW. */
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

const row = (over: Partial<MembershipStateRow> = {}): MembershipStateRow => ({
  tier: "professional",
  membership_status: "active",
  source: "self_subscribe",
  stripe_customer_id: "cus_123",
  updated_at: ago(86_400),
  ...over,
});

const resolve = (over: Partial<MembershipSituationInput> = {}) =>
  resolveMembershipSituation({
    userId: "user-1",
    membershipRows: [],
    now: NOW,
    ...over,
  });

/* ─────────────────────────────  signed out  ───────────────────────────── */

describe("signed_out — a stranger must still see what is for sale", () => {
  it("resolves to signed_out with no membership facts", () => {
    const s = resolve({ userId: null });
    expect(s.state).toBe("signed_out");
    expect(s.tier).toBeNull();
    expect(s.hasProfile).toBe(false);
    expect(s.canManageBilling).toBe(false);
  });

  it("offers Live Pass — the one tier that needs no application", () => {
    expect(offeredTiers(resolve({ userId: null }))).toEqual(["live_pass"]);
  });
});

/* ───────────────────────────────  admin  ──────────────────────────────── */

describe("isAdmin is orthogonal — the escape hatch renders in every state", () => {
  it("an admin with NO membership still resolves to a normal state, flagged admin", () => {
    const s = resolve({ accountType: "admin" });
    expect(s.state).toBe("none");
    expect(s.isAdmin).toBe(true);
  });

  it("an admin who also holds a membership keeps BOTH facts", () => {
    const s = resolve({
      accountType: "admin",
      membershipRows: [row({ tier: "professional" })],
    });
    expect(s.state).toBe("active_profile_tier");
    expect(s.isAdmin).toBe(true);
  });

  it("an admin on a comp membership keeps both — warm copy AND the door", () => {
    const s = resolve({
      accountType: "admin",
      membershipRows: [row({ source: FOUNDING_COMP_SOURCE, stripe_customer_id: null })],
    });
    expect(s.state).toBe("comp");
    expect(s.isAdmin).toBe(true);
  });

  it("a non-admin is never flagged", () => {
    expect(resolve({ accountType: "talent" }).isAdmin).toBe(false);
    expect(resolve({ accountType: "employer" }).isAdmin).toBe(false);
    expect(resolve({}).isAdmin).toBe(false);
  });
});

/* ──────────────────────────────  pending  ─────────────────────────────── */

describe("pending — the ten seconds after someone hands us their card", () => {
  it("a just-written pending row wins over everything", () => {
    const s = resolve({
      applicationState: "approved",
      membershipRows: [row({ membership_status: "pending", updated_at: ago(2) })],
    });
    expect(s.state).toBe("pending");
    expect(s.tier).toBe("professional");
    expect(s.hasProfile).toBe(true);
    expect(s.pendingAgeSeconds).toBe(2);
  });

  it("carries hasProfile:false for a pending Live Pass, so no profile CTA appears", () => {
    const s = resolve({
      membershipRows: [
        row({ tier: "live_pass", membership_status: "pending", updated_at: ago(5) }),
      ],
    });
    expect(s.state).toBe("pending");
    expect(s.hasProfile).toBe(false);
  });

  it("pre-empts an existing Live Pass when that member is upgrading", () => {
    const s = resolve({
      applicationState: "approved",
      membershipRows: [
        row({ tier: "live_pass", membership_status: "active" }),
        row({ tier: "professional", membership_status: "pending", updated_at: ago(10) }),
      ],
    });
    expect(s.state).toBe("pending");
    expect(s.tier).toBe("professional");
  });

  it("sells nothing while a purchase is in flight", () => {
    const s = resolve({
      applicationState: "approved",
      membershipRows: [row({ membership_status: "pending", updated_at: ago(3) })],
    });
    expect(offeredTiers(s)).toEqual([]);
  });

  it("stays pending right up to the freshness boundary", () => {
    const s = resolve({
      membershipRows: [
        row({ membership_status: "pending", updated_at: ago(PENDING_FRESH_SECONDS) }),
      ],
    });
    expect(s.state).toBe("pending");
  });

  it("treats a pending row with no timestamp as fresh — never risk a second charge", () => {
    const s = resolve({
      membershipRows: [
        row({ membership_status: "pending", updated_at: null, created_at: null }),
      ],
    });
    expect(s.state).toBe("pending");
    expect(s.pendingAgeSeconds).toBeNull();
  });

  it("falls back to created_at when updated_at is absent", () => {
    const s = resolve({
      membershipRows: [
        row({ membership_status: "pending", updated_at: null, created_at: ago(30) }),
      ],
    });
    expect(s.state).toBe("pending");
    expect(s.pendingAgeSeconds).toBe(30);
  });
});

describe("a STALE pending row is an abandoned checkout, not a dead end", () => {
  const stale = () =>
    resolve({
      applicationState: "approved",
      membershipRows: [
        row({
          membership_status: "pending",
          updated_at: ago(PENDING_FRESH_SECONDS + 1),
        }),
      ],
    });

  it("stops holding them on a spinner and falls through to what they hold", () => {
    expect(stale().state).toBe("approved_no_membership");
  });

  it("still reports the abandoned tier, so the page can say so calmly", () => {
    expect(stale().stalePendingTier).toBe("professional");
  });

  it("lets them buy again rather than stranding them", () => {
    expect(offeredTiers(stale())).toEqual(["professional", "professional_full"]);
  });

  it("does not mask a real active membership underneath", () => {
    const s = resolve({
      membershipRows: [
        row({ tier: "live_pass", membership_status: "active" }),
        row({
          tier: "professional",
          membership_status: "pending",
          updated_at: ago(PENDING_FRESH_SECONDS + 60),
        }),
      ],
    });
    expect(s.state).toBe("active_live_pass");
    expect(s.stalePendingTier).toBe("professional");
  });
});

/* ────────────────────────────────  comp  ──────────────────────────────── */

describe("comp — a founding member must never see a paywall", () => {
  it("recognises BOTH complimentary vocabularies", () => {
    for (const source of [FOUNDING_COMP_SOURCE, COMP_PERMANENT_SOURCE, COMP_TERM_SOURCE]) {
      const s = resolve({
        membershipRows: [row({ source, stripe_customer_id: null })],
      });
      expect(s.state, `source ${source}`).toBe("comp");
    }
  });

  it("lists exactly the three known comp sources", () => {
    expect([...COMPLIMENTARY_SOURCES].sort()).toEqual([
      "complimentary_permanent",
      "complimentary_term",
      "founding_comp",
    ]);
  });

  it("does not treat an ordinary purchase as complimentary", () => {
    expect(isComplimentarySource("self_subscribe")).toBe(false);
    expect(isComplimentarySource(null)).toBe(false);
    expect(isComplimentarySource(undefined)).toBe(false);
    expect(isComplimentarySource("")).toBe(false);
  });

  it("outranks the paid profile tier, so the warm copy wins on a comp Professional", () => {
    const s = resolve({
      membershipRows: [row({ tier: "professional", source: FOUNDING_COMP_SOURCE, stripe_customer_id: null })],
    });
    expect(s.state).toBe("comp");
    // …and their profile is still one click away.
    expect(s.hasProfile).toBe(true);
  });

  it("shows a comp studio member no profile CTA", () => {
    const s = resolve({
      membershipRows: [
        row({ tier: "studio_connect", source: COMP_PERMANENT_SOURCE, stripe_customer_id: null }),
      ],
    });
    expect(s.state).toBe("comp");
    expect(s.hasProfile).toBe(false);
  });

  it("puts no price in front of them", () => {
    const s = resolve({
      membershipRows: [row({ source: FOUNDING_COMP_SOURCE, stripe_customer_id: null })],
    });
    expect(offeredTiers(s)).toEqual([]);
  });

  // F11, brought along with F4.
  it("offers no manage button — a comp row has no Stripe customer to manage", () => {
    const s = resolve({
      membershipRows: [row({ source: FOUNDING_COMP_SOURCE, stripe_customer_id: null })],
    });
    expect(s.canManageBilling).toBe(false);
  });

  it("ignores a comp row that is not active", () => {
    const s = resolve({
      membershipRows: [
        row({ source: FOUNDING_COMP_SOURCE, membership_status: "canceled", stripe_customer_id: null }),
      ],
    });
    expect(s.state).not.toBe("comp");
  });
});

/* ─────────────────────────  active, paid tiers  ───────────────────────── */

describe("active_profile_tier — a paying Professional or Creator", () => {
  it("resolves Professional", () => {
    const s = resolve({ membershipRows: [row({ tier: "professional" })] });
    expect(s.state).toBe("active_profile_tier");
    expect(s.hasProfile).toBe(true);
    expect(s.canManageBilling).toBe(true);
  });

  it("resolves Creator", () => {
    const s = resolve({ membershipRows: [row({ tier: "professional_full" })] });
    expect(s.state).toBe("active_profile_tier");
    expect(s.hasProfile).toBe(true);
  });

  it("offers Creator as the only step up from Professional", () => {
    const s = resolve({ membershipRows: [row({ tier: "professional" })] });
    expect(offeredTiers(s)).toEqual(["professional_full"]);
  });

  it("offers a Creator nothing further", () => {
    const s = resolve({ membershipRows: [row({ tier: "professional_full" })] });
    expect(offeredTiers(s)).toEqual([]);
  });

  it("prefers the profile tier when it sits alongside a Live Pass", () => {
    const s = resolve({
      membershipRows: [row({ tier: "live_pass" }), row({ tier: "professional" })],
    });
    expect(s.state).toBe("active_profile_tier");
  });
});

/* ───────────  F3: the Live Pass loop that never resolved  ─────────────── */

describe("active_live_pass / active_studio — F3, the loop that never resolved", () => {
  it("a Live Pass holder is NOT an active profile member", () => {
    const s = resolve({ membershipRows: [row({ tier: "live_pass" })] });
    expect(s.state).toBe("active_live_pass");
  });

  // The bug, stated directly: this is what put a profile button in front of
  // someone /profile/edit would bounce straight back here.
  it("a Live Pass holder never carries a profile affordance", () => {
    const s = resolve({ membershipRows: [row({ tier: "live_pass" })] });
    expect(s.hasProfile).toBe(false);
  });

  it("offers an unapplied Live Pass holder no vetted tier they cannot buy", () => {
    const s = resolve({ membershipRows: [row({ tier: "live_pass" })] });
    expect(offeredTiers(s)).toEqual([]);
  });

  it("offers the upgrade once their application is approved", () => {
    const s = resolve({
      applicationState: "approved",
      membershipRows: [row({ tier: "live_pass" })],
    });
    expect(offeredTiers(s)).toEqual(["professional", "professional_full"]);
  });

  it("does not offer the upgrade while an application is merely submitted", () => {
    const s = resolve({
      applicationState: "submitted",
      membershipRows: [row({ tier: "live_pass" })],
    });
    expect(offeredTiers(s)).toEqual([]);
  });

  it("keeps a studio member in the studio lane, never the profile lane", () => {
    const s = resolve({ membershipRows: [row({ tier: "studio_connect" })] });
    expect(s.state).toBe("active_studio");
    expect(s.hasProfile).toBe(false);
    expect(offeredTiers(s)).toEqual(["studio_growth", "studio_accelerator"]);
  });

  it("never offers a studio the tier it already holds", () => {
    const s = resolve({ membershipRows: [row({ tier: "studio_growth" })] });
    expect(offeredTiers(s)).not.toContain("studio_growth");
  });

  it("shows an employer with no membership the studio lane, not Live Pass", () => {
    const s = resolve({ accountType: "employer" });
    expect(s.state).toBe("none");
    expect(offeredTiers(s)).toEqual([
      "studio_connect",
      "studio_growth",
      "studio_accelerator",
    ]);
  });
});

/* ───────────────────────────────  lapsed  ─────────────────────────────── */

describe("lapsed — a way back, not a locked door", () => {
  it("resolves a failed invoice to lapsed", () => {
    const s = resolve({ membershipRows: [row({ membership_status: "lapsed" })] });
    expect(s.state).toBe("lapsed");
  });

  it("treats a canceled membership the same way", () => {
    const s = resolve({ membershipRows: [row({ membership_status: "canceled" })] });
    expect(s.state).toBe("lapsed");
  });

  it("keeps the billing portal available — that IS the recovery path", () => {
    const s = resolve({ membershipRows: [row({ membership_status: "lapsed" })] });
    expect(s.canManageBilling).toBe(true);
  });

  it("does not push a fresh purchase at someone whose card just failed", () => {
    const s = resolve({ membershipRows: [row({ membership_status: "lapsed" })] });
    expect(offeredTiers(s)).toEqual([]);
  });

  it("never outranks a membership that is actually active", () => {
    const s = resolve({
      membershipRows: [
        row({ tier: "professional", membership_status: "lapsed" }),
        row({ tier: "live_pass", membership_status: "active" }),
      ],
    });
    expect(s.state).toBe("active_live_pass");
  });
});

/* ──────────────────────  no membership at all  ────────────────────────── */

describe("no membership — the application decides", () => {
  it("approved with no row gets the tier chooser", () => {
    const s = resolve({ applicationState: "approved" });
    expect(s.state).toBe("approved_no_membership");
    expect(offeredTiers(s)).toEqual(["professional", "professional_full"]);
  });

  it("claims the $30 credit only when a fee was really paid", () => {
    expect(
      resolve({ applicationState: "approved", applicationFeePaid: true })
        .applicationFeeCredited,
    ).toBe(true);
  });

  it("never claims a credit for a waived or unpaid fee", () => {
    expect(resolve({ applicationState: "approved" }).applicationFeeCredited).toBe(false);
    expect(
      resolve({ applicationState: "approved", applicationFeePaid: false })
        .applicationFeeCredited,
    ).toBe(false);
  });

  it("never claims a credit in any other state", () => {
    for (const applicationState of [null, "submitted", "declined"]) {
      expect(
        resolve({ applicationState, applicationFeePaid: true }).applicationFeeCredited,
      ).toBe(false);
    }
  });

  it("resolves an application under review", () => {
    for (const state of ["submitted", "in-review", "more-info", "draft"]) {
      expect(resolve({ applicationState: state }).state, state).toBe("applied");
    }
  });

  it("resolves a declined application", () => {
    expect(resolve({ applicationState: "declined" }).state).toBe("declined");
  });

  it("resolves someone who never applied", () => {
    expect(resolve({}).state).toBe("none");
    expect(offeredTiers(resolve({}))).toEqual(["live_pass"]);
  });

  it("offers Live Pass to an applicant still under review", () => {
    expect(offeredTiers(resolve({ applicationState: "submitted" }))).toEqual(["live_pass"]);
  });

  it("has no manage button when there has never been a Stripe customer", () => {
    expect(resolve({ applicationState: "approved" }).canManageBilling).toBe(false);
  });
});

/* ────────────────────────────  robustness  ────────────────────────────── */

describe("unknown data never produces confident wrong copy", () => {
  it("ignores a membership row on a tier that no longer exists", () => {
    const s = resolve({
      applicationState: "approved",
      membershipRows: [row({ tier: "legacy_tier_from_2025" })],
    });
    expect(s.state).toBe("approved_no_membership");
    expect(s.tier).toBeNull();
  });

  it("never reports hasProfile for an unrecognised pending tier", () => {
    const s = resolve({
      membershipRows: [
        row({ tier: "who_knows", membership_status: "pending", updated_at: ago(1) }),
      ],
    });
    expect(s.state).toBe("pending");
    expect(s.hasProfile).toBe(false);
  });

  it("survives an unparseable timestamp by treating the row as fresh", () => {
    const s = resolve({
      membershipRows: [
        row({ membership_status: "pending", updated_at: "not-a-date" }),
      ],
    });
    expect(s.state).toBe("pending");
  });

  it("handles a person with no rows at all", () => {
    const s = resolve({ membershipRows: [] });
    expect(s.state).toBe("none");
    expect(s.canManageBilling).toBe(false);
  });

  it("offeredTiers returns an array for every reachable state", () => {
    const inputs: MembershipSituationInput[] = [
      { userId: null, membershipRows: [] },
      { userId: "u", membershipRows: [row({ membership_status: "pending", updated_at: ago(1) })] },
      { userId: "u", membershipRows: [row({ source: FOUNDING_COMP_SOURCE, renewal_date: null })] },
      {
        userId: "u",
        membershipRows: [row({ source: FOUNDING_COMP_SOURCE, renewal_date: ago(1) })],
      },
      { userId: "u", membershipRows: [row({ tier: "professional" })] },
      { userId: "u", membershipRows: [row({ tier: "live_pass" })] },
      { userId: "u", membershipRows: [row({ tier: "studio_connect" })] },
      { userId: "u", membershipRows: [row({ membership_status: "lapsed" })] },
      { userId: "u", membershipRows: [], applicationState: "approved" },
      { userId: "u", membershipRows: [], applicationState: "submitted" },
      { userId: "u", membershipRows: [], applicationState: "declined" },
      { userId: "u", membershipRows: [] },
    ];
    const seen = new Set<string>();
    for (const input of inputs) {
      const s = resolveMembershipSituation({ ...input, now: NOW });
      seen.add(s.state);
      expect(Array.isArray(offeredTiers(s)), s.state).toBe(true);
      expect(typeof professionalPathway(s), s.state).toBe("string");
    }
    // Every one of the twelve states is exercised above.
    expect(seen.size).toBe(12);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Founder rules locked in by email, 2026-08-18.
   ══════════════════════════════════════════════════════════════════════════ */

// "Live Pass is a real paid Relevé membership tier — $99 for a family. It is
//  not merely a studio-access state or an upgrade lane."
describe("Live Pass is a real membership, not a waiting room", () => {
  const livePass = (over = {}) =>
    resolve({ membershipRows: [row({ tier: "live_pass" })], ...over });

  it("has its own state, distinct from a studio membership", () => {
    expect(livePass().state).toBe("active_live_pass");
    expect(resolve({ membershipRows: [row({ tier: "studio_connect" })] }).state).toBe(
      "active_studio",
    );
  });

  // The rule, stated directly: never ask someone to buy what they already have.
  it("is NEVER offered again to someone who already holds it", () => {
    expect(offeredTiers(livePass())).not.toContain("live_pass");
    expect(offeredTiers(livePass({ applicationState: "approved" }))).not.toContain("live_pass");
    expect(offeredTiers(livePass({ applicationState: "submitted" }))).not.toContain("live_pass");
    expect(offeredTiers(livePass({ applicationState: "declined" }))).not.toContain("live_pass");
  });

  it("keeps its holder off every profile CTA", () => {
    expect(livePass().hasProfile).toBe(false);
  });

  it("is still sellable to everyone who does not hold it", () => {
    expect(offeredTiers(resolve({ userId: null }))).toContain("live_pass");
    expect(offeredTiers(resolve({}))).toContain("live_pass");
    expect(offeredTiers(resolve({ applicationState: "submitted" }))).toContain("live_pass");
  });
});

// "Do not give an unapproved Live Pass member a direct 'upgrade to Professional'
//  checkout that will 403. … the appropriate optional action is to apply."
describe("the Professional Roster is a pathway, never a 403", () => {
  it("offers an unapproved Live Pass holder the APPLICATION, not a checkout", () => {
    const s = resolve({ membershipRows: [row({ tier: "live_pass" })] });
    expect(offeredTiers(s)).toEqual([]);
    expect(professionalPathway(s)).toBe("apply");
  });

  it("reassures rather than sells while their application is being reviewed", () => {
    for (const state of ["submitted", "in-review", "more-info", "draft"]) {
      const s = resolve({
        applicationState: state,
        membershipRows: [row({ tier: "live_pass" })],
      });
      expect(offeredTiers(s), state).toEqual([]);
      expect(professionalPathway(s), state).toBe("under_review");
    }
  });

  // "Preserve their existing Live Pass membership while they explore/apply for
  //  Professional." Applying must never cost someone the membership they hold.
  it("a Live Pass member KEEPS their Live Pass at every step of applying", () => {
    for (const applicationState of [null, "draft", "submitted", "in-review", "more-info"]) {
      const s = resolve({
        applicationState,
        membershipRows: [row({ tier: "live_pass" })],
      });
      expect(s.state, `application ${applicationState}`).toBe("active_live_pass");
      expect(s.tier, `application ${applicationState}`).toBe("live_pass");
      expect(offeredTiers(s), `application ${applicationState}`).not.toContain("live_pass");
    }
  });

  it("keeps their Live Pass even once they are approved and could buy Professional", () => {
    const s = resolve({
      applicationState: "approved",
      membershipRows: [row({ tier: "live_pass" })],
    });
    expect(s.state).toBe("active_live_pass");
    expect(offeredTiers(s)).not.toContain("live_pass");
  });

  it("keeps their Live Pass if the application is declined", () => {
    const s = resolve({
      applicationState: "declined",
      membershipRows: [row({ tier: "live_pass" })],
    });
    expect(s.state).toBe("active_live_pass");
    expect(professionalPathway(s)).toBe("none");
  });

  it("only offers the purchase once it will actually succeed", () => {
    const s = resolve({
      applicationState: "approved",
      membershipRows: [row({ tier: "live_pass" })],
    });
    expect(offeredTiers(s)).toEqual(["professional", "professional_full"]);
    expect(professionalPathway(s)).toBe("purchase");
  });

  it("invites a stranger and an unapplied member to apply", () => {
    expect(professionalPathway(resolve({ userId: null }))).toBe("apply");
    expect(professionalPathway(resolve({}))).toBe("apply");
  });

  it("never solicits someone who already holds a profile tier", () => {
    expect(professionalPathway(resolve({ membershipRows: [row({ tier: "professional" })] }))).toBe(
      "none",
    );
  });

  it("never solicits a complimentary member", () => {
    const s = resolve({
      membershipRows: [row({ source: FOUNDING_COMP_SOURCE, stripe_customer_id: null })],
    });
    expect(professionalPathway(s)).toBe("none");
  });

  it("never blurs the employer side into talent", () => {
    expect(professionalPathway(resolve({ accountType: "employer" }))).toBe("none");
    expect(
      professionalPathway(resolve({ membershipRows: [row({ tier: "studio_growth" })] })),
    ).toBe("none");
  });

  it("sends a lapsed member to billing, not to an application", () => {
    expect(
      professionalPathway(resolve({ membershipRows: [row({ membership_status: "lapsed" })] })),
    ).toBe("none");
  });

  it("does not re-solicit someone who was declined", () => {
    expect(professionalPathway(resolve({ applicationState: "declined" }))).toBe("none");
  });

  it("says nothing to someone mid-purchase", () => {
    const s = resolve({
      membershipRows: [row({ membership_status: "pending", updated_at: ago(2) })],
    });
    expect(professionalPathway(s)).toBe("none");
  });
});

// "comp means a currently valid complimentary entitlement. It must support both
//  lifetime complimentary founders and founding members whose complimentary
//  period can expire later. Do not hard-code complimentary as free forever."
describe("complimentary is an entitlement with a clock, not a permanent flag", () => {
  const comp = (renewal_date: string | null, source = FOUNDING_COMP_SOURCE) =>
    resolve({
      membershipRows: [row({ source, renewal_date, stripe_customer_id: null })],
    });

  it("a LIFETIME founder (no end date) is comp, and stays comp", () => {
    const s = comp(null, COMP_PERMANENT_SOURCE);
    expect(s.state).toBe("comp");
    expect(s.compExpiresAt).toBeNull();
  });

  it("a founding member inside their term is comp, and the date travels with them", () => {
    const ends = new Date(NOW.getTime() + 90 * 86_400_000).toISOString();
    const s = comp(ends);
    expect(s.state).toBe("comp");
    expect(s.compExpiresAt).toBe(ends);
  });

  it("a founding member whose term has ENDED is no longer comp", () => {
    const s = comp(ago(1));
    expect(s.state).toBe("comp_expired");
  });

  it("an ended term is never quietly presented as a paid membership", () => {
    const s = comp(ago(86_400));
    expect(s.state).not.toBe("active_profile_tier");
    expect(s.canManageBilling).toBe(false);
    // F9 is unratified, so nothing is sold and nothing is decided here.
    expect(offeredTiers(s)).toEqual([]);
  });

  it("keeps the profile reachable after a term ends — nothing is confiscated", () => {
    const s = comp(ago(86_400));
    expect(s.hasProfile).toBe(true);
  });

  it("prefers a still-valid comp row over an expired one", () => {
    const s = resolve({
      membershipRows: [
        row({ source: FOUNDING_COMP_SOURCE, renewal_date: ago(10), stripe_customer_id: null }),
        row({ source: COMP_PERMANENT_SOURCE, renewal_date: null, stripe_customer_id: null }),
      ],
    });
    expect(s.state).toBe("comp");
  });

  it("never drops a founding member out of comp over a malformed date", () => {
    const s = comp("not-a-date");
    expect(s.state).toBe("comp");
  });

  it("both comp vocabularies obey the same clock", () => {
    for (const source of [FOUNDING_COMP_SOURCE, COMP_PERMANENT_SOURCE, COMP_TERM_SOURCE]) {
      expect(comp(ago(1), source).state, source).toBe("comp_expired");
      expect(comp(null, source).state, source).toBe("comp");
    }
  });
});
