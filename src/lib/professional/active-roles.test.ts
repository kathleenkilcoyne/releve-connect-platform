import { describe, expect, it, vi } from "vitest";
import { filterToActiveRoles, getActiveProfessionalRoleSlugs } from "./active-roles";

// Everything currently `is_active = true` in role_types on production, queried
// live during the audit that found the equivalent bug on the application form.
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

const RETIRED_SLUGS = ["working_dancer", "coach"];

describe("filterToActiveRoles", () => {
  it("keeps a single currently-active role", () => {
    expect(filterToActiveRoles(["teacher"], LIVE_ACTIVE_ROLE_SLUGS)).toEqual(["teacher"]);
  });

  it("keeps multiple currently-active roles together — the core of multi-role editing", () => {
    expect(
      filterToActiveRoles(["teacher", "choreographer", "yoga_instructor"], LIVE_ACTIVE_ROLE_SLUGS),
    ).toEqual(["teacher", "choreographer", "yoga_instructor"]);
  });

  it("lets every currently-active role survive, in one shot", () => {
    expect(filterToActiveRoles(LIVE_ACTIVE_ROLE_SLUGS, LIVE_ACTIVE_ROLE_SLUGS)).toEqual(
      LIVE_ACTIVE_ROLE_SLUGS,
    );
  });

  it.each(RETIRED_SLUGS)("drops a retired role (%s) without reactivating it", (slug) => {
    expect(filterToActiveRoles([slug], LIVE_ACTIVE_ROLE_SLUGS)).toEqual([]);
  });

  it("drops a fabricated/tampered-with role value", () => {
    expect(filterToActiveRoles(["<script>", "not_a_real_role"], LIVE_ACTIVE_ROLE_SLUGS)).toEqual(
      [],
    );
  });

  it("keeps valid selections while dropping invalid ones from a mixed submission", () => {
    expect(
      filterToActiveRoles(
        ["teacher", "working_dancer", "yoga_instructor", "not_real"],
        LIVE_ACTIVE_ROLE_SLUGS,
      ),
    ).toEqual(["teacher", "yoga_instructor"]);
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
