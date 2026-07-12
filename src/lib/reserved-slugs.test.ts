import { describe, it, expect } from "vitest";
import { isReservedSlug } from "./reserved-slugs";

// A public handle is a ROOT-level URL, so it must never collide with a real app
// route. If this guard breaks, a member could claim /apply or /admin and either
// shadow a page or (more likely) end up with an unreachable profile.
describe("isReservedSlug", () => {
  it("rejects current top-level app routes", () => {
    for (const s of ["apply", "admin", "api", "login", "subscribe", "profile", "talent", "auth"]) {
      expect(isReservedSlug(s)).toBe(true);
    }
  });

  it("rejects likely-future surfaces (roster, swing, the-beat)", () => {
    expect(isReservedSlug("roster")).toBe(true);
    expect(isReservedSlug("swing")).toBe(true);
    expect(isReservedSlug("the-beat")).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isReservedSlug("ADMIN")).toBe(true);
    expect(isReservedSlug("  Apply  ")).toBe(true);
  });

  it("allows ordinary member handles", () => {
    for (const s of ["jane-doe", "marco", "the-dancer", "kilcoyne-ballet"]) {
      expect(isReservedSlug(s)).toBe(false);
    }
  });
});
