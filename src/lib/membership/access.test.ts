import { describe, it, expect } from "vitest";
import {
  hasActiveProfileTierFromRows,
  hasAnyActiveMembershipFromRows,
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
