import { describe, expect, it, vi } from "vitest";
import { filterToActiveRoles, getActiveProfessionalRoleSlugs } from "./roles";

// The 24 roles that are actually `is_active = true` in production right now
// (queried live during the audit that found this bug) — teacher/choreographer
// (the untouched regression cases), studio_owner (its own flow, unaffected by
// this fix), and the 22 roles added 2026-08-18 through 2026-08-22 that the old
// hardcoded VALID_ROLES silently dropped.
const LIVE_ACTIVE_ROLE_SLUGS = [
  "teacher",
  "choreographer",
  "studio_owner",
  "dancer",
  "dancer_singer",
  "dancer_singer_actor",
  "adjudicator",
  "performer",
  "director",
  "vocal_coach",
  "acting_coach",
  "dance_coach",
  "audition_coach",
  "music_director_accompanist",
  "stage_manager",
  "casting_director",
  "dance_captain_asst_choreographer",
  "college_university_faculty",
  "costume_designer",
  "lighting_designer",
  "digital_content_creator",
  "arts_administrator_company_manager",
  "personal_trainer",
  "pilates_instructor",
  "yoga_instructor",
  "gyrotonic_practitioner",
];

// Retired by role_taxonomy_cleanup / superseded by the dancer/performer split —
// must never be reachable again even though it's still in some old drafts/tests.
const RETIRED_SLUGS = ["working_dancer", "coach"];

describe("filterToActiveRoles", () => {
  it("keeps a role that is currently active (regression: teacher)", () => {
    expect(filterToActiveRoles(["teacher"], LIVE_ACTIVE_ROLE_SLUGS)).toEqual(["teacher"]);
  });

  it("keeps a role that is currently active (regression: choreographer)", () => {
    expect(filterToActiveRoles(["choreographer"], LIVE_ACTIVE_ROLE_SLUGS)).toEqual([
      "choreographer",
    ]);
  });

  it("keeps a newly-added role selected on its own (yoga_instructor) — the reported bug", () => {
    expect(filterToActiveRoles(["yoga_instructor"], LIVE_ACTIVE_ROLE_SLUGS)).toEqual([
      "yoga_instructor",
    ]);
  });

  it("keeps a newly-added role selected on its own (lighting_designer)", () => {
    expect(filterToActiveRoles(["lighting_designer"], LIVE_ACTIVE_ROLE_SLUGS)).toEqual([
      "lighting_designer",
    ]);
  });

  it("lets every currently-active role survive submission, in one shot", () => {
    expect(filterToActiveRoles(LIVE_ACTIVE_ROLE_SLUGS, LIVE_ACTIVE_ROLE_SLUGS)).toEqual(
      LIVE_ACTIVE_ROLE_SLUGS,
    );
  });

  it.each(RETIRED_SLUGS)(
    "drops a retired role (%s) even if a stale client submits it, without reactivating it",
    (slug) => {
      expect(filterToActiveRoles([slug], LIVE_ACTIVE_ROLE_SLUGS)).toEqual([]);
    },
  );

  it("drops a fabricated/tampered-with role value that was never real", () => {
    expect(filterToActiveRoles(["administrator", "<script>"], LIVE_ACTIVE_ROLE_SLUGS)).toEqual(
      [],
    );
  });

  it("keeps valid selections while dropping invalid ones from a mixed submission", () => {
    expect(
      filterToActiveRoles(["teacher", "working_dancer", "not_a_real_role"], LIVE_ACTIVE_ROLE_SLUGS),
    ).toEqual(["teacher"]);
  });

  it("returns an empty array when nothing submitted overlaps the active set", () => {
    expect(filterToActiveRoles(["working_dancer"], LIVE_ACTIVE_ROLE_SLUGS)).toEqual([]);
  });
});

describe("getActiveProfessionalRoleSlugs", () => {
  it("queries role_types filtered to is_active = true and returns just the slugs", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ slug: "teacher" }, { slug: "yoga_instructor" }],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as unknown as Parameters<typeof getActiveProfessionalRoleSlugs>[0];

    const result = await getActiveProfessionalRoleSlugs(supabase);

    expect(from).toHaveBeenCalledWith("role_types");
    expect(select).toHaveBeenCalledWith("slug");
    expect(eq).toHaveBeenCalledWith("is_active", true);
    expect(result).toEqual(["teacher", "yoga_instructor"]);
  });

  it("returns an empty array rather than throwing when the query returns no data", async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as unknown as Parameters<typeof getActiveProfessionalRoleSlugs>[0];

    expect(await getActiveProfessionalRoleSlugs(supabase)).toEqual([]);
  });
});
