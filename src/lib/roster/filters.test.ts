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
      availability: [],
      services: [],
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
  availability_slugs: ["weekends", "willing-to-travel", "accepting-choreography"],
  // My Services — the source of truth for what this person offers.
  service_slugs: ["choreography", "master-classes"],
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
    const sparse: RosterRow = {
      ...base,
      style_slugs: null,
      level_slugs: null,
      cert_slugs: null,
      availability_slugs: null,
    };
    expect(profileMatchesFilters(sparse, parseRosterParams({}))).toBe(true);
    expect(profileMatchesFilters(sparse, parseRosterParams({ style: "ballet" }))).toBe(false);
    expect(profileMatchesFilters(sparse, parseRosterParams({ avail: "weekends" }))).toBe(false);
  });

  // Availability (revisions 2026-07-24 §9). Both kinds of tag — when someone can
  // work, and what they're taking on — share the single `avail` facet.
  it("filters by availability, ANY-within-facet", () => {
    expect(profileMatchesFilters(base, parseRosterParams({ avail: "weekends" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ avail: "saturdays" }))).toBe(false);
    // ANY: has weekends, not summers-only → still a match
    expect(profileMatchesFilters(base, parseRosterParams({ avail: "summers-only,weekends" }))).toBe(true);
  });

  it("treats 'currently accepting' tags as the same facet as general availability", () => {
    expect(profileMatchesFilters(base, parseRosterParams({ avail: "accepting-choreography" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ avail: "available-for-adjudication" }))).toBe(false);
  });

  it("answers the studio's real question: jazz teacher, weekends, CPR-certified", () => {
    // The query from PROFILE-REVISIONS-FROM-KATHLEEN.md, as a filter.
    const query = parseRosterParams({
      role: "teacher",
      style: "jazz",
      avail: "weekends",
      cert: "cpr-first-aid",
    });

    // Ava teaches ballet/contemporary and holds ABT — wrong style, wrong cert.
    expect(profileMatchesFilters(base, query)).toBe(false);

    const match: RosterRow = {
      ...base,
      display_name: "Jordan Reyes",
      style_slugs: ["jazz", "hip-hop"],
      cert_slugs: ["cpr-first-aid", "safe-sport"],
      availability_slugs: ["weekends", "willing-to-travel"],
    };
    expect(profileMatchesFilters(match, query)).toBe(true);

    // Same person, but only free weekends in summer → drops out.
    expect(
      profileMatchesFilters({ ...match, availability_slugs: ["summers-only"] }, query),
    ).toBe(false);
  });

  it("counts availability as an active filter (so 'Clear filters' shows)", () => {
    expect(hasNoActiveFilters(parseRosterParams({ avail: "weekends" }))).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   MY SERVICES as the Roster's source of truth for what someone offers.
   (2026-08-18 — "one fact, one source of truth, many useful places".)
   ══════════════════════════════════════════════════════════════════════════ */

describe("the services facet", () => {
  it("parses ?svc= into the services filter", () => {
    expect(parseRosterParams({ svc: "choreography" }).services).toEqual(["choreography"]);
    expect(parseRosterParams({ svc: ["choreography", "adjudication"] }).services).toEqual([
      "choreography",
      "adjudication",
    ]);
    expect(parseRosterParams({ svc: "choreography,guest-teaching" }).services).toEqual([
      "choreography",
      "guest-teaching",
    ]);
  });

  it("counts as an active filter", () => {
    expect(hasNoActiveFilters(parseRosterParams({ svc: "choreography" }))).toBe(false);
  });

  it("matches a profile that offers the service", () => {
    const f = parseRosterParams({ svc: "choreography" });
    expect(profileMatchesFilters(base, f)).toBe(true);
  });

  it("excludes a profile that does not offer it", () => {
    const f = parseRosterParams({ svc: "adjudication" });
    expect(profileMatchesFilters(base, f)).toBe(false);
  });

  it("is ANY-within-facet — one match is enough", () => {
    const f = parseRosterParams({ svc: ["adjudication", "master-classes"] });
    expect(profileMatchesFilters(base, f)).toBe(true);
  });

  it("is AND-across-facets — services plus style must both hold", () => {
    expect(
      profileMatchesFilters(base, parseRosterParams({ svc: "choreography", style: "ballet" })),
    ).toBe(true);
    expect(
      profileMatchesFilters(base, parseRosterParams({ svc: "choreography", style: "tap" })),
    ).toBe(false);
  });

  it("treats a profile with no services as unmatched, not as a wildcard", () => {
    const noServices = { ...base, service_slugs: null };
    expect(profileMatchesFilters(noServices, parseRosterParams({ svc: "choreography" }))).toBe(
      false,
    );
    // …but an unfiltered search still returns them.
    expect(profileMatchesFilters(noServices, parseRosterParams({}))).toBe(true);
  });
});

// NOTHING may lose results. The four retired tags were preserved (inactive), and
// the availability facet now matches through EITHER path.
describe("no existing search path loses results", () => {
  it("a retired tag still matches a profile that HOLDS the tag", () => {
    const tagOnly = { ...base, service_slugs: [] };
    expect(
      profileMatchesFilters(tagOnly, parseRosterParams({ avail: "accepting-choreography" })),
    ).toBe(true);
  });

  // The case the tag-only path could never have handled: someone who joined
  // after the conversion has the service and no tag at all.
  it("a retired tag ALSO matches a profile that only has the SERVICE", () => {
    const serviceOnly = {
      ...base,
      availability_slugs: ["weekends"],
      service_slugs: ["choreography"],
    };
    expect(
      profileMatchesFilters(serviceOnly, parseRosterParams({ avail: "accepting-choreography" })),
    ).toBe(true);
  });

  it("still excludes someone with neither the tag nor the service", () => {
    const neither = {
      ...base,
      availability_slugs: ["weekends"],
      service_slugs: ["master-classes"],
    };
    expect(
      profileMatchesFilters(neither, parseRosterParams({ avail: "accepting-choreography" })),
    ).toBe(false);
  });

  it("general availability behaves exactly as it always did", () => {
    expect(profileMatchesFilters(base, parseRosterParams({ avail: "weekends" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ avail: "summers-only" }))).toBe(false);
    // …and is not rescued by any service, because it maps to none.
    const noTags = { ...base, availability_slugs: [] };
    expect(profileMatchesFilters(noTags, parseRosterParams({ avail: "weekends" }))).toBe(false);
  });

  it("every retired tag finds a profile holding only its service equivalent", () => {
    const cases: Array<[string, string]> = [
      ["accepting-choreography", "choreography"],
      ["accepting-master-classes", "master-classes"],
      ["available-for-adjudication", "adjudication"],
      ["available-for-guest-teaching", "guest-teaching"],
    ];
    for (const [tag, service] of cases) {
      const row = { ...base, availability_slugs: [], service_slugs: [service] };
      expect(profileMatchesFilters(row, parseRosterParams({ avail: tag })), tag).toBe(true);
    }
  });

  it("clearing filters returns everyone again", () => {
    expect(hasNoActiveFilters(parseRosterParams({}))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({}))).toBe(true);
  });
});
