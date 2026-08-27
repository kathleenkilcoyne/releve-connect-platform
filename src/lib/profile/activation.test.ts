import { describe, it, expect } from "vitest";
import {
  resolveActivationBasis,
  buildProfileSeed,
  buildFoundingSeed,
  ACTIVATION_PROFILE_STATUS,
  type ApplicationAnswers,
} from "./activation";

const activePro = [{ tier: "professional", membership_status: "active" }];
const approvedApp = { application_id: "app-1", state: "approved" };

describe("resolveActivationBasis — who may have a professional profile", () => {
  it("refuses an applicant who has only applied (no membership)", () => {
    expect(
      resolveActivationBasis({
        application: { application_id: "app-1", state: "in-review" },
        hasFoundingGrant: false,
        membershipRows: [],
      }),
    ).toBeNull();
  });

  it("refuses an APPROVED applicant who has not activated — approval alone is not enough", () => {
    expect(
      resolveActivationBasis({ application: approvedApp, hasFoundingGrant: false, membershipRows: [] }),
    ).toBeNull();
  });

  it("refuses an active member whose application is still in review", () => {
    expect(
      resolveActivationBasis({
        application: { application_id: "app-1", state: "in-review" },
        hasFoundingGrant: false,
        membershipRows: activePro,
      }),
    ).toBeNull();
  });

  it("refuses a declined applicant even with an active membership", () => {
    expect(
      resolveActivationBasis({
        application: { application_id: "app-1", state: "declined" },
        hasFoundingGrant: false,
        membershipRows: activePro,
      }),
    ).toBeNull();
  });

  it("activates an approved applicant with an active Professional membership", () => {
    expect(
      resolveActivationBasis({ application: approvedApp, hasFoundingGrant: false, membershipRows: activePro }),
    ).toEqual({ kind: "approved_application", applicationId: "app-1" });
  });

  it("activates on the Creator tier too", () => {
    expect(
      resolveActivationBasis({
        application: approvedApp,
        hasFoundingGrant: false,
        membershipRows: [{ tier: "professional_full", membership_status: "active" }],
      }),
    ).toEqual({ kind: "approved_application", applicationId: "app-1" });
  });

  it("treats a complimentary membership row as activation (comp == paid for this gate)", () => {
    // A founding_comp / founder_permanent grant IS a memberships row with
    // membership_status='active', so the same predicate covers it.
    expect(
      resolveActivationBasis({
        application: approvedApp,
        hasFoundingGrant: false,
        membershipRows: [{ tier: "professional", membership_status: "active" }],
      }),
    ).toEqual({ kind: "approved_application", applicationId: "app-1" });
  });

  it("does NOT activate a Live Pass holder — $99 has never granted a Roster profile", () => {
    expect(
      resolveActivationBasis({
        application: approvedApp,
        hasFoundingGrant: false,
        membershipRows: [{ tier: "live_pass", membership_status: "active" }],
      }),
    ).toBeNull();
  });

  it("does NOT activate a studio-tier holder — studios are the employer side", () => {
    for (const tier of ["studio_connect", "studio_growth", "studio_accelerator"]) {
      expect(
        resolveActivationBasis({
          application: approvedApp,
          hasFoundingGrant: false,
          membershipRows: [{ tier, membership_status: "active" }],
        }),
      ).toBeNull();
    }
  });

  it("does NOT activate on a lapsed or pending membership", () => {
    for (const status of ["pending", "lapsed", "canceled"]) {
      expect(
        resolveActivationBasis({
          application: approvedApp,
          hasFoundingGrant: false,
          membershipRows: [{ tier: "professional", membership_status: status }],
        }),
      ).toBeNull();
    }
  });

  it("activates an invited Founding Professional who never applied", () => {
    expect(
      resolveActivationBasis({ application: null, hasFoundingGrant: true, membershipRows: activePro }),
    ).toEqual({ kind: "founding_grant" });
  });

  it("refuses an active member with neither an approved application nor a grant", () => {
    expect(
      resolveActivationBasis({ application: null, hasFoundingGrant: false, membershipRows: activePro }),
    ).toBeNull();
  });

  it("prefers the approved application over a grant, so provenance is recorded", () => {
    expect(
      resolveActivationBasis({ application: approvedApp, hasFoundingGrant: true, membershipRows: activePro }),
    ).toEqual({ kind: "approved_application", applicationId: "app-1" });
  });

  // ── Private Invited Professional (2026-08-24) — structurally separate from
  // Founding Professional; see @/lib/invited-professional/invited-professional.
  it("activates a privately invited professional who never applied", () => {
    expect(
      resolveActivationBasis({
        application: null,
        hasFoundingGrant: false,
        hasPrivateInvite: true,
        membershipRows: activePro,
      }),
    ).toEqual({ kind: "private_invite" });
  });

  it("omitting hasPrivateInvite behaves exactly like passing false (every pre-existing caller/test)", () => {
    expect(
      resolveActivationBasis({ application: null, hasFoundingGrant: false, membershipRows: activePro }),
    ).toBeNull();
  });

  it("prefers the approved application over a private invitation too", () => {
    expect(
      resolveActivationBasis({
        application: approvedApp,
        hasFoundingGrant: false,
        hasPrivateInvite: true,
        membershipRows: activePro,
      }),
    ).toEqual({ kind: "approved_application", applicationId: "app-1" });
  });

  it("a Founding Professional grant and a private invitation are independent — founding wins when both are set, and neither implies the other", () => {
    expect(
      resolveActivationBasis({
        application: null,
        hasFoundingGrant: true,
        hasPrivateInvite: true,
        membershipRows: activePro,
      }),
    ).toEqual({ kind: "founding_grant" });
    expect(
      resolveActivationBasis({
        application: null,
        hasFoundingGrant: false,
        hasPrivateInvite: true,
        membershipRows: activePro,
      }),
    ).toEqual({ kind: "private_invite" });
  });
});

const fullAnswers: ApplicationAnswers = {
  identity: {
    first_name: " Ada ",
    last_name: "Lovelace",
    city: "Montclair",
    state_province: "NJ",
    country: "United States",
    age_range: "35-50",
  },
  roles: ["teacher", "choreographer"],
  primary_role: "teacher",
  story: { bio: "Twenty years in the studio.", years_experience: "11-20" },
  industry: {
    studios_companies: "Bergen Ballet; Montclair Dance",
    notable_credits: "Nutcracker, 2019",
    unions: ["AEA", "None"],
    certifications: "ABT NTC Levels 1-3, Acrobatic Arts",
    degrees: ["BFA", "MFA"],
  },
  teaching: {
    philosophy: "Technique serves expression.",
    levels: ["beginner", "advanced"],
    styles: ["ballet", "contemporary"],
    adaptive_experience: "Six years with adaptive dancers.",
    currently_teaching: "Bergen Ballet",
  },
  choreographer: {
    focus_areas: ["competition", "concert"],
    years: "12",
    work_links: ["https://vimeo.com/111", "", "https://vimeo.com/333"],
  },
  working_dancer: { auditioning_for: ["Commercial", "Cruise"] },
  digital_presence: {
    website: "https://ada.example",
    instagram: "https://instagram.com/ada",
    teaching_reel: "https://vimeo.com/teaching",
    choreography_reel: "https://vimeo.com/choreo",
    performance_reel: "https://vimeo.com/perf",
    headshot_url: "https://cdn.example/headshot.jpg",
    resume_url: "https://cdn.example/cv.pdf",
  },
  open_to: ["teaching-new-classes", "licensing"],
};

describe("buildProfileSeed — the one-time application handoff", () => {
  const seed = buildProfileSeed(fullAnswers, { displayName: "fallback" });

  it("carries identity, story and location forward", () => {
    expect(seed.profile.display_name).toBe("Ada Lovelace");
    expect(seed.profile.primary_role).toBe("teacher");
    expect(seed.profile.city).toBe("Montclair");
    expect(seed.profile.bio).toBe("Twenty years in the studio.");
    expect(seed.profile.years_experience).toBe("11-20");
  });

  it("carries the three narrative answers V1 discarded", () => {
    expect(seed.profile.teaching_philosophy).toBe("Technique serves expression.");
    expect(seed.profile.adaptive_experience).toBe("Six years with adaptive dancers.");
    expect(seed.profile.choreographer_years).toBe("12");
  });

  it("maps controlled vocabularies straight across (same taxonomy, same slugs)", () => {
    expect(seed.styles).toEqual(["ballet", "contemporary"]);
    expect(seed.levels).toEqual(["beginner", "advanced"]);
    expect(seed.focusAreas).toEqual(["competition", "concert"]);
    expect(seed.roles).toEqual(["teacher", "choreographer"]);
  });

  it("turns auditioning_for into the ONE existing Open-To badge, not the categories", () => {
    // Option (a), founder decision 2026-08-17: naming audition categories sets
    // the generic `auditioning` interest signal. The outside-industry categories
    // themselves stay in the application and never become résumé facts.
    expect(seed.openTo).toEqual(["teaching-new-classes", "licensing", "auditioning"]);
    expect(seed.openTo).not.toContain("Commercial");
    expect(seed.openTo).not.toContain("Cruise");
  });

  it("turns list-valued evidence into credential badges, dropping the 'None' sentinel", () => {
    expect(seed.credentials).toEqual([
      { kind: "union", value: "AEA" },
      { kind: "degree", value: "BFA" },
      { kind: "degree", value: "MFA" },
    ]);
  });

  it("keeps the free-text certifications blob WHOLE — no blob-per-row splitting", () => {
    expect(seed.profile.credentials).toBe("ABT NTC Levels 1-3, Acrobatic Arts");
    expect(seed.credentials.some((c) => c.kind === "certification")).toBe(false);
  });

  it("distinguishes reels by purpose and promotes the teaching reel to the hero slot", () => {
    expect(seed.profile.teaching_reel_url).toBe("https://vimeo.com/teaching");
    expect(seed.profile.video_reels.map((r) => r.kind)).toEqual([
      "choreography",
      "performance",
      "work",
      "work",
    ]);
    // The hero reel is not duplicated into video_reels.
    expect(seed.profile.video_reels.some((r) => r.url === "https://vimeo.com/teaching")).toBe(false);
    // Empty work links are dropped, and ordering is stable.
    expect(seed.profile.video_reels.map((r) => r.order)).toEqual([0, 1, 2, 3]);
  });

  it("carries only the social keys the profile renders", () => {
    expect(seed.profile.social_links).toEqual({
      website: "https://ada.example",
      instagram: "https://instagram.com/ada",
    });
  });

  it("preserves external assets as context rather than fetching them", () => {
    expect(seed.carriedAssets).toEqual({
      headshotUrl: "https://cdn.example/headshot.jpg",
      resumeUrl: "https://cdn.example/cv.pdf",
    });
  });

  it("never carries admin/vetting-only content onto the profile", () => {
    const blob = JSON.stringify(seed);
    // alignment prose, work authorization, contact details, audition targets
    for (const forbidden of ["alignment", "work_authorization", "auditioning_for", "Commercial", "Cruise"]) {
      expect(blob).not.toContain(forbidden);
    }
  });
});

describe("the auditioning signal", () => {
  const base = { open_to: ["licensing"] };

  it("adds no badge when the applicant named no audition categories", () => {
    expect(
      buildProfileSeed({ ...base, working_dancer: { auditioning_for: [] } }, { displayName: "x" }).openTo,
    ).toEqual(["licensing"]);
  });

  it("adds no badge when there is no working-dancer section at all", () => {
    expect(buildProfileSeed(base, { displayName: "x" }).openTo).toEqual(["licensing"]);
  });

  it("does not duplicate when the applicant already ticked the auditioning badge", () => {
    const seed = buildProfileSeed(
      { open_to: ["auditioning", "licensing"], working_dancer: { auditioning_for: ["Film/TV"] } },
      { displayName: "x" },
    );
    expect(seed.openTo).toEqual(["auditioning", "licensing"]);
    expect(seed.openTo.filter((s) => s === "auditioning")).toHaveLength(1);
  });
});

describe("buildProfileSeed — partial and missing applications", () => {
  it("survives an application with no role-branched sections", () => {
    const seed = buildProfileSeed(
      { identity: { first_name: "Sol" }, story: { bio: "Hello." } },
      { displayName: "fallback" },
    );
    expect(seed.profile.display_name).toBe("Sol");
    expect(seed.styles).toEqual([]);
    expect(seed.credentials).toEqual([]);
    expect(seed.profile.video_reels).toEqual([]);
    expect(seed.profile.teaching_philosophy).toBeNull();
  });

  it("falls back to the account display name when the application has no name", () => {
    expect(buildProfileSeed({}, { displayName: "Account Name" }).profile.display_name).toBe("Account Name");
  });

  it("treats null answers as an empty application", () => {
    const seed = buildProfileSeed(null, { displayName: "Nobody" });
    expect(seed.profile.display_name).toBe("Nobody");
    expect(seed.profile.social_links).toEqual({});
  });

  it("gives a Founding Professional an empty seed — they never applied", () => {
    const seed = buildFoundingSeed("Kathleen McAree");
    expect(seed.profile.display_name).toBe("Kathleen McAree");
    expect(seed.roles).toEqual([]);
    expect(seed.credentials).toEqual([]);
    expect(seed.carriedAssets).toEqual({ headshotUrl: null, resumeUrl: null });
  });
});

describe("creation state", () => {
  it("always creates a DRAFT — creation and publication are separate acts", () => {
    expect(ACTIVATION_PROFILE_STATUS).toBe("draft");
  });
});
