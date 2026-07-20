// Tests for the free-founding-period comp membership.
//
// This decides what an accepted member can actually DO (the Roster, the profile
// builder, connections all gate on the resulting row), and how long they get it
// for. Both are promises made to founding members, so both are pinned here.

import { describe, expect, it } from "vitest";

import {
  FOUNDING_COMP_SOURCE,
  FOUNDING_FREE_MONTHS,
  foundingRenewalDate,
  foundingTierFor,
} from "./founding";
import { hasActiveProfileTierFromRows, hasAnyActiveMembershipFromRows } from "./access";
import { TIERS } from "./tiers";

describe("foundingTierFor", () => {
  it("gives a teacher the Professional tier (the one that opens the profile builder)", () => {
    expect(foundingTierFor(["teacher"])).toBe("professional");
  });

  it("gives choreographers and dancers Professional too", () => {
    expect(foundingTierFor(["choreographer"])).toBe("professional");
    expect(foundingTierFor(["working_dancer"])).toBe("professional");
  });

  it("gives a studio-ONLY applicant the entry studio tier", () => {
    expect(foundingTierFor(["studio_owner"])).toBe("studio_connect");
  });

  it("treats a studio owner who ALSO teaches as talent, not a studio", () => {
    // They need the profile builder — the studio tier would not give it to them.
    expect(foundingTierFor(["studio_owner", "teacher"])).toBe("professional");
    expect(foundingTierFor(["studio_owner", "choreographer"])).toBe("professional");
  });

  it("falls back to Professional for missing or empty roles", () => {
    expect(foundingTierFor(null)).toBe("professional");
    expect(foundingTierFor([])).toBe("professional");
  });

  it("never comps a tier above the entry point of its side", () => {
    // Professional·Full and the higher studio tiers are upsells, not defaults.
    const granted = [
      foundingTierFor(["teacher"]),
      foundingTierFor(["studio_owner"]),
    ];
    expect(granted).not.toContain("professional_full");
    expect(granted).not.toContain("studio_growth");
    expect(granted).not.toContain("studio_accelerator");
  });
});

describe("foundingRenewalDate", () => {
  it("is one year out — the ratified founding promise", () => {
    expect(FOUNDING_FREE_MONTHS).toBe(12);
    const from = new Date("2026-07-20T12:00:00Z");
    expect(foundingRenewalDate(from).toISOString().slice(0, 10)).toBe("2027-07-20");
  });

  it("handles a month-end start without rolling into the wrong month", () => {
    // Jan 31 + 12 months must still be in 2027, not silently shifted a year on.
    const from = new Date("2026-01-31T12:00:00Z");
    expect(foundingRenewalDate(from).getFullYear()).toBe(2027);
  });
});

describe("the comped row actually opens the product", () => {
  // The whole point of granting a real membership row instead of a bypass flag:
  // every existing gate must accept it with no change.
  const comped = (tier: string) => [{ tier, membership_status: "active" }];

  it("opens the Roster for a comped professional", () => {
    expect(hasAnyActiveMembershipFromRows(comped("professional"))).toBe(true);
  });

  it("opens the profile builder for a comped professional", () => {
    expect(hasActiveProfileTierFromRows(comped("professional"))).toBe(true);
  });

  it("opens the Roster for a comped studio, but NOT the profile builder", () => {
    // Studios are the employer side — they browse, they don't build a talent profile.
    expect(hasAnyActiveMembershipFromRows(comped("studio_connect"))).toBe(true);
    expect(hasActiveProfileTierFromRows(comped("studio_connect"))).toBe(false);
  });

  it("comps a tier that really exists in the pricing table", () => {
    // Guards against comping a slug like "access" that no tier definition backs.
    expect(TIERS[foundingTierFor(["teacher"])]).toBeDefined();
    expect(TIERS[foundingTierFor(["studio_owner"])]).toBeDefined();
  });

  it("labels comps distinctly so they can never be counted as revenue", () => {
    expect(FOUNDING_COMP_SOURCE).toBe("founding_comp");
  });
});
