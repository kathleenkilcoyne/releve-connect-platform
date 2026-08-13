import { describe, it, expect } from "vitest";
import {
  hasActiveProfileTierFromRows,
  hasAnyActiveMembershipFromRows,
  professionalAccessFromRows,
  PROFILE_TIER_SLUGS,
} from "./access";

// The profile-builder gate (build spec §6 + §17). This predicate decides who may
// build/publish a profile — it must NOT silently break (CLAUDE.md guardrail #6).
describe("hasActiveProfileTierFromRows", () => {
  it("grants access on an active Professional membership", () => {
    expect(
      hasActiveProfileTierFromRows([{ tier: "professional", membership_status: "active" }]),
    ).toBe(true);
  });

  it("grants access on an active Professional · Full membership", () => {
    expect(
      hasActiveProfileTierFromRows([{ tier: "professional_full", membership_status: "active" }]),
    ).toBe(true);
  });

  it("denies Live Pass — the door-opener tier has no profile", () => {
    expect(
      hasActiveProfileTierFromRows([{ tier: "live_pass", membership_status: "active" }]),
    ).toBe(false);
  });

  it("denies studio tiers — studios are the employer side, not talent", () => {
    expect(
      hasActiveProfileTierFromRows([
        { tier: "studio_connect", membership_status: "active" },
        { tier: "studio_growth", membership_status: "active" },
        { tier: "studio_accelerator", membership_status: "active" },
      ]),
    ).toBe(false);
  });

  it("denies a Professional tier that is not active (pending / lapsed / canceled)", () => {
    for (const status of ["pending", "lapsed", "canceled"]) {
      expect(
        hasActiveProfileTierFromRows([{ tier: "professional", membership_status: status }]),
      ).toBe(false);
    }
  });

  it("denies when there are no memberships at all", () => {
    expect(hasActiveProfileTierFromRows([])).toBe(false);
  });

  it("grants when an active Professional row sits alongside inactive ones", () => {
    expect(
      hasActiveProfileTierFromRows([
        { tier: "live_pass", membership_status: "active" },
        { tier: "professional", membership_status: "active" },
      ]),
    ).toBe(true);
  });

  it("only the two Professional tiers bear a profile", () => {
    expect([...PROFILE_TIER_SLUGS].sort()).toEqual(["professional", "professional_full"]);
  });
});

// The Roster-access gate (§5): browsing the directory is open to ANY active tier,
// including Live Pass and studios — not just the profile-bearing tiers.
describe("hasAnyActiveMembershipFromRows", () => {
  it("grants access on any active tier — Live Pass and studios included", () => {
    for (const tier of ["live_pass", "professional", "professional_full", "studio_connect", "studio_accelerator"]) {
      expect(hasAnyActiveMembershipFromRows([{ tier, membership_status: "active" }])).toBe(true);
    }
  });

  it("denies when every membership is inactive", () => {
    expect(
      hasAnyActiveMembershipFromRows([
        { tier: "live_pass", membership_status: "pending" },
        { tier: "professional", membership_status: "lapsed" },
      ]),
    ).toBe(false);
  });

  it("denies when there are no memberships", () => {
    expect(hasAnyActiveMembershipFromRows([])).toBe(false);
  });
});

// The unified professional-access gate: an active Professional MEMBERSHIP or an
// active, in-window $30 ACTIVATION grants the profile builder.
describe("professionalAccessFromRows", () => {
  const now = new Date("2026-08-12T00:00:00.000Z");
  const future = new Date(now.getTime() + 10 * 86_400_000).toISOString();
  const past = new Date(now.getTime() - 1).toISOString();

  it("grants on an active Professional membership (no activation needed)", () => {
    expect(
      professionalAccessFromRows({
        membershipRows: [{ tier: "professional", membership_status: "active" }],
        activationExpiries: [],
        now,
      }),
    ).toBe(true);
  });

  it("grants on an active, in-window activation (no membership needed)", () => {
    expect(
      professionalAccessFromRows({ membershipRows: [], activationExpiries: [future], now }),
    ).toBe(true);
  });

  it("denies an activation whose window has already lapsed", () => {
    expect(
      professionalAccessFromRows({ membershipRows: [], activationExpiries: [past], now }),
    ).toBe(false);
  });

  it("denies a null/absent activation expiry", () => {
    expect(
      professionalAccessFromRows({ membershipRows: [], activationExpiries: [null], now }),
    ).toBe(false);
  });

  it("denies with neither membership nor activation", () => {
    expect(
      professionalAccessFromRows({ membershipRows: [], activationExpiries: [], now }),
    ).toBe(false);
  });
});
