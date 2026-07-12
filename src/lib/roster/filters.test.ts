import { describe, it, expect } from "vitest";
import {
  parseRosterParams,
  profileMatchesFilters,
  hasNoActiveFilters,
  type RosterRow,
} from "./filters";

// Search returning correct filtered results is a flow that MUST NOT break
// (CLAUDE.md guardrail #6). These lock the filter semantics the SQL query mirrors.

describe("parseRosterParams", () => {
  it("defaults to an empty, page-1 filter", () => {
    const f = parseRosterParams({});
    expect(f).toEqual({
      role: null,
      styles: [],
      levels: [],
      certs: [],
      region: null,
      state: null,
      q: null,
      page: 1,
    });
    expect(hasNoActiveFilters(f)).toBe(true);
  });

  it("accepts a known role and rejects an unknown one", () => {
    expect(parseRosterParams({ role: "teacher" }).role).toBe("teacher");
    expect(parseRosterParams({ role: "choreographer" }).role).toBe("choreographer");
    // studio_owner is not a talent category
    expect(parseRosterParams({ role: "studio_owner" }).role).toBeNull();
    expect(parseRosterParams({ role: "nonsense" }).role).toBeNull();
  });

  it("parses repeated and comma-separated multi-values, de-duped and lowercased", () => {
    expect(parseRosterParams({ style: ["ballet", "jazz"] }).styles).toEqual(["ballet", "jazz"]);
    expect(parseRosterParams({ style: "ballet,jazz,ballet" }).styles).toEqual(["ballet", "jazz"]);
    expect(parseRosterParams({ cert: "ABT-NTC" }).certs).toEqual(["abt-ntc"]);
  });

  it("clamps a bad page to 1", () => {
    expect(parseRosterParams({ page: "3" }).page).toBe(3);
    expect(parseRosterParams({ page: "0" }).page).toBe(1);
    expect(parseRosterParams({ page: "-2" }).page).toBe(1);
    expect(parseRosterParams({ page: "abc" }).page).toBe(1);
  });

  it("flags active filters", () => {
    expect(hasNoActiveFilters(parseRosterParams({ role: "teacher" }))).toBe(true); // role isn't a filter
    expect(hasNoActiveFilters(parseRosterParams({ style: "ballet" }))).toBe(false);
    expect(hasNoActiveFilters(parseRosterParams({ q: "ava" }))).toBe(false);
  });
});

const base: RosterRow = {
  primary_role: "teacher",
  style_slugs: ["ballet", "contemporary"],
  level_slugs: ["advanced", "professional"],
  cert_slugs: ["abt-ntc"],
  region_id: "region-nj",
  state_province: "NJ",
  display_name: "Ava Marchetti",
  owner_active: true,
};

describe("profileMatchesFilters", () => {
  it("matches when no filters are applied", () => {
    expect(profileMatchesFilters(base, parseRosterParams({}))).toBe(true);
  });

  it("excludes profiles whose owner is not an active member", () => {
    expect(profileMatchesFilters({ ...base, owner_active: false }, parseRosterParams({}))).toBe(false);
  });

  it("filters by role category", () => {
    expect(profileMatchesFilters(base, parseRosterParams({ role: "teacher" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ role: "choreographer" }))).toBe(false);
  });

  it("style/level/cert are ANY-within-facet (overlap)", () => {
    expect(profileMatchesFilters(base, parseRosterParams({ style: "jazz,ballet" }))).toBe(true); // has ballet
    expect(profileMatchesFilters(base, parseRosterParams({ style: "jazz,tap" }))).toBe(false);
    expect(profileMatchesFilters(base, parseRosterParams({ level: "advanced" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ cert: "rad" }))).toBe(false);
    expect(profileMatchesFilters(base, parseRosterParams({ cert: "abt-ntc" }))).toBe(true);
  });

  it("facets are AND across each other", () => {
    // has ballet AND advanced → match
    expect(profileMatchesFilters(base, parseRosterParams({ style: "ballet", level: "advanced" }))).toBe(true);
    // has ballet but NOT beginner → no match
    expect(profileMatchesFilters(base, parseRosterParams({ style: "ballet", level: "beginner" }))).toBe(false);
  });

  it("filters by region and state (case-insensitive)", () => {
    expect(profileMatchesFilters(base, parseRosterParams({ region: "region-nj" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ region: "region-ny" }))).toBe(false);
    expect(profileMatchesFilters(base, parseRosterParams({ state: "nj" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ state: "NY" }))).toBe(false);
  });

  it("matches free text against the name", () => {
    expect(profileMatchesFilters(base, parseRosterParams({ q: "ava" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ q: "marchetti" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ q: "zzz" }))).toBe(false);
  });

  it("tolerates null facet arrays", () => {
    const sparse: RosterRow = { ...base, style_slugs: null, level_slugs: null, cert_slugs: null };
    expect(profileMatchesFilters(sparse, parseRosterParams({}))).toBe(true);
    expect(profileMatchesFilters(sparse, parseRosterParams({ style: "ballet" }))).toBe(false);
  });
});
