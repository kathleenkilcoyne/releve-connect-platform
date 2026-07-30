import { describe, it, expect } from "vitest";
import { familyAccessFrom } from "./entitlement";

// A fixed "now" so past/future trial dates are deterministic.
const NOW = Date.parse("2026-09-15T12:00:00Z"); // mid free-pilot

describe("familyAccessFrom — free-pilot entitlement rule", () => {
  it("entitles an active family regardless of any trial date", () => {
    expect(familyAccessFrom("active", null, NOW)).toEqual({ allowed: true, reason: "active" });
    expect(familyAccessFrom("active", "2020-01-01T00:00:00Z", NOW).allowed).toBe(true);
  });

  it("entitles a trialing family while the trial end is in the future", () => {
    // The pilot default: trial_ends_at = end of 2026.
    const r = familyAccessFrom("trialing", "2026-12-31T23:59:59Z", NOW);
    expect(r).toEqual({ allowed: true, reason: "trialing" });
  });

  it("entitles a trialing family with no end date (open-ended trial)", () => {
    expect(familyAccessFrom("trialing", null, NOW).allowed).toBe(true);
  });

  it("does NOT entitle a trialing family whose trial has already ended", () => {
    // January, after the pilot: the paywall turns on by itself.
    const r = familyAccessFrom("trialing", "2026-12-31T23:59:59Z", Date.parse("2027-01-02T00:00:00Z"));
    expect(r).toEqual({ allowed: false, reason: "trialing" });
    // And a clearly-past date at "now".
    expect(familyAccessFrom("trialing", "2026-08-01T00:00:00Z", NOW).allowed).toBe(false);
  });

  it("does NOT entitle none / past_due / canceled", () => {
    expect(familyAccessFrom("none", null, NOW).allowed).toBe(false);
    expect(familyAccessFrom("past_due", null, NOW).allowed).toBe(false);
    expect(familyAccessFrom("canceled", null, NOW).allowed).toBe(false);
  });

  it("treats a null status (guardian without 'billing') as calendar-visible", () => {
    // Not a denial: a parent who can see the calendar but not the invoice still
    // sees the calendar. Resolves to reason 'none' with access granted.
    expect(familyAccessFrom(null, null, NOW)).toEqual({ allowed: true, reason: "none" });
  });
});
