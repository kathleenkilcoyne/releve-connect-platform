import { describe, it, expect } from "vitest";
import {
  parseRosterParams,
  profileMatchesFilters,
  hasNoActiveFilters,
  type RosterRow,
} from "./filters";

// Search returning correct filtered results is a flow that MUST NOT break
// (CLAUDE.md guardrail #6). These lock the filter semantics the SQL query
// mirrors. Phase 1 rebuild (founder-approved 2026-08-21): Professional Role
// moved from a single-select category (filtering on the deprecated
// `primary_role` column) to a proper multi-select facet on `role_slugs`, the
// same ANY-within/AND-across mechanism as every other facet. Focus Areas and
// Professional Experience joined as new facets the same way.

describe("parseRosterParams", () => {
  it("defaults to an empty, page-1 filter", () => {
    const f = parseRosterParams({});
    expect(f).toEqual({
      roles: [],
      styles: [],
      levels: [],
      focusAreas: [],
      certs: [],
      experience: [],
      availability: [],
      region: null,
      state: null,
      q: null,
      page: 1,
    });
    expect(hasNoActiveFilters(f)).toBe(true);
  });

  it("parses role like every other multi-value facet — repeated, comma-separated, de-duped, lowercased", () => {
    expect(parseRosterParams({ role: "teacher" }).roles).toEqual(["teacher"]);
    expect(parseRosterParams({ role: ["teacher", "choreographer"] }).roles).toEqual([
      "teacher",
      "choreographer",
    ]);
    expect(parseRosterParams({ role: "vocal_coach,audition_coach,vocal_coach" }).roles).toEqual([
      "vocal_coach",
      "audition_coach",
    ]);
    // No membership check against a known set any more — same as style/cert:
    // an unrecognized slug is a harmless no-op at the DB level (an overlap
    // against a slug nobody has just returns nothing), not a parse-time reject.
    expect(parseRosterParams({ role: "nonsense" }).roles).toEqual(["nonsense"]);
  });

  it("parses repeated and comma-separated multi-values, de-duped and lowercased", () => {
    expect(parseRosterParams({ style: ["ballet", "jazz"] }).styles).toEqual(["ballet", "jazz"]);
    expect(parseRosterParams({ style: "ballet,jazz,ballet" }).styles).toEqual(["ballet", "jazz"]);
    expect(parseRosterParams({ cert: "ABT-NTC" }).certs).toEqual(["abt-ntc"]);
    expect(parseRosterParams({ focus: "competition,concert-stage" }).focusAreas).toEqual([
      "competition",
      "concert-stage",
    ]);
    expect(parseRosterParams({ exp: "broadway,international_tour" }).experience).toEqual([
      "broadway",
      "international_tour",
    ]);
  });

  it("clamps a bad page to 1", () => {
    expect(parseRosterParams({ page: "3" }).page).toBe(3);
    expect(parseRosterParams({ page: "0" }).page).toBe(1);
    expect(parseRosterParams({ page: "-2" }).page).toBe(1);
    expect(parseRosterParams({ page: "abc" }).page).toBe(1);
  });

  it("flags active filters — role now counts as one, unlike the old category tab", () => {
    expect(hasNoActiveFilters(parseRosterParams({ role: "teacher" }))).toBe(false);
    expect(hasNoActiveFilters(parseRosterParams({ style: "ballet" }))).toBe(false);
    expect(hasNoActiveFilters(parseRosterParams({ focus: "competition" }))).toBe(false);
    expect(hasNoActiveFilters(parseRosterParams({ exp: "broadway" }))).toBe(false);
    expect(hasNoActiveFilters(parseRosterParams({ q: "ava" }))).toBe(false);
  });
});

const base: RosterRow = {
  role_slugs: ["teacher"],
  style_slugs: ["ballet", "contemporary"],
  level_slugs: ["advanced", "professional"],
  focus_area_slugs: ["early-childhood"],
  cert_slugs: ["abt-ntc"],
  experience_slugs: ["regional_theatre"],
  availability_slugs: ["weekends", "willing-to-travel", "accepting-choreography"],
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

  it("role is ANY-within-facet, like every other facet — a multi-role profile matches on any held role", () => {
    const multiRole: RosterRow = { ...base, role_slugs: ["teacher", "choreographer"] };
    expect(profileMatchesFilters(multiRole, parseRosterParams({ role: "teacher" }))).toBe(true);
    expect(profileMatchesFilters(multiRole, parseRosterParams({ role: "choreographer" }))).toBe(true);
    expect(profileMatchesFilters(multiRole, parseRosterParams({ role: "working_dancer" }))).toBe(false);
    // Selecting two roles is a UNION, not an intersection: someone who is ONLY
    // a teacher still matches "teacher OR audition_coach".
    expect(
      profileMatchesFilters(base, parseRosterParams({ role: "teacher,audition_coach" })),
    ).toBe(true);
  });

  it("style/level/cert/focus/experience are ANY-within-facet (overlap)", () => {
    expect(profileMatchesFilters(base, parseRosterParams({ style: "jazz,ballet" }))).toBe(true); // has ballet
    expect(profileMatchesFilters(base, parseRosterParams({ style: "jazz,tap" }))).toBe(false);
    expect(profileMatchesFilters(base, parseRosterParams({ level: "advanced" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ cert: "rad" }))).toBe(false);
    expect(profileMatchesFilters(base, parseRosterParams({ cert: "abt-ntc" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ focus: "early-childhood" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ focus: "adaptive-dance" }))).toBe(false);
    expect(profileMatchesFilters(base, parseRosterParams({ exp: "regional_theatre" }))).toBe(true);
    expect(profileMatchesFilters(base, parseRosterParams({ exp: "broadway" }))).toBe(false);
  });

  it("facets are AND across each other", () => {
    // has ballet AND advanced → match
    expect(profileMatchesFilters(base, parseRosterParams({ style: "ballet", level: "advanced" }))).toBe(true);
    // has ballet but NOT beginner → no match
    expect(profileMatchesFilters(base, parseRosterParams({ style: "ballet", level: "beginner" }))).toBe(false);
    // role AND experience together — the "Vocal Coach + Broadway" shape
    const vocalCoachBroadway: RosterRow = {
      ...base,
      display_name: "Richard Alvarez",
      role_slugs: ["vocal_coach"],
      experience_slugs: ["broadway"],
    };
    expect(
      profileMatchesFilters(
        vocalCoachBroadway,
        parseRosterParams({ role: "vocal_coach", exp: "broadway" }),
      ),
    ).toBe(true);
    // Has the role but not the experience → no match.
    expect(
      profileMatchesFilters(base, parseRosterParams({ role: "teacher", exp: "broadway" })),
    ).toBe(false);
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
      role_slugs: null,
      style_slugs: null,
      level_slugs: null,
      focus_area_slugs: null,
      cert_slugs: null,
      experience_slugs: null,
      availability_slugs: null,
    };
    expect(profileMatchesFilters(sparse, parseRosterParams({}))).toBe(true);
    expect(profileMatchesFilters(sparse, parseRosterParams({ role: "teacher" }))).toBe(false);
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

  it("answers the founder's target combinations from the Phase 1 brief", () => {
    // Dancer + Tap + Broadway
    const dancerTapBroadway: RosterRow = {
      ...base,
      display_name: "Priya Nair",
      role_slugs: ["dancer"],
      style_slugs: ["tap"],
      experience_slugs: ["broadway"],
    };
    expect(
      profileMatchesFilters(
        dancerTapBroadway,
        parseRosterParams({ role: "dancer", style: "tap", exp: "broadway" }),
      ),
    ).toBe(true);
    expect(
      profileMatchesFilters(
        dancerTapBroadway,
        parseRosterParams({ role: "dancer", style: "ballet", exp: "broadway" }),
      ),
    ).toBe(false);

    // Audition Coach + College / University Faculty — both are ROLES (founder
    // decision 2026-08-21), which means selecting both checkboxes is a UNION
    // (anyone with EITHER role), not an intersection (anyone with BOTH). A
    // profile holding only one of the two still matches.
    const auditionCoachOnly: RosterRow = { ...base, role_slugs: ["audition_coach"] };
    expect(
      profileMatchesFilters(
        auditionCoachOnly,
        parseRosterParams({ role: "audition_coach,college_university_faculty" }),
      ),
    ).toBe(true);
  });

  it("counts availability as an active filter (so 'Clear filters' shows)", () => {
    expect(hasNoActiveFilters(parseRosterParams({ avail: "weekends" }))).toBe(false);
  });
});
