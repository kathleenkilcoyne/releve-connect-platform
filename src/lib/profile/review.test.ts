import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildChecklist,
  essentialsRemaining,
  completionCount,
  canPublish,
  publishBlockedMessage,
  isReleveHosted,
  carriedAssetsNeedingAttention,
  resolveAudience,
  WELCOME_COPY,
  PUBLISH_MEANING,
  type ReviewProfile,
} from "./review";

const empty: ReviewProfile = {
  display_name: "Ada Lovelace",
  headshot_url: null,
  bio: null,
  primary_role: null,
  city: null,
  teaching_reel_url: null,
  resume_url: null,
  social_links: null,
  gallery_urls: null,
  profile_status: "draft",
  visibility: "public",
};

const seeded: ReviewProfile = {
  ...empty,
  bio: "Twenty years in the studio.",
  primary_role: "teacher",
  city: "Montclair",
  social_links: { website: "https://ada.example" },
};

const none = { styles: 0, levels: 0 };

describe("the checklist", () => {
  it("marks what came across from the application as done", () => {
    const items = buildChecklist(seeded, { styles: 2, levels: 1 });
    const done = items.filter((i) => i.done).map((i) => i.key);
    expect(done).toEqual(expect.arrayContaining(["bio", "role", "location", "styles", "links"]));
  });

  it("marks what the application never collects as still needed", () => {
    // A headshot and a featured video are uploads, not application answers, so a
    // freshly seeded profile always lacks them.
    const items = buildChecklist(seeded, none);
    const outstanding = items.filter((i) => !i.done).map((i) => i.key);
    expect(outstanding).toContain("headshot");
    expect(outstanding).toContain("video");
  });

  it("treats an invited founder's empty profile as everything outstanding", () => {
    const items = buildChecklist(empty, none);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(completionCount(items)).toEqual({ done: 0, total: items.length });
  });

  it("counts styles OR levels as the same checklist item", () => {
    expect(buildChecklist(seeded, { styles: 1, levels: 0 }).find((i) => i.key === "styles")?.done).toBe(true);
    expect(buildChecklist(seeded, { styles: 0, levels: 1 }).find((i) => i.key === "styles")?.done).toBe(true);
  });

  it("treats whitespace as empty", () => {
    expect(buildChecklist({ ...empty, bio: "   " }, none).find((i) => i.key === "bio")?.done).toBe(false);
  });

  it("names the four essentials", () => {
    expect(essentialsRemaining(buildChecklist(empty, none)).map((i) => i.key)).toEqual([
      "headshot",
      "bio",
      "role",
      "location",
    ]);
  });

  it("explains WHY each missing item matters, in the member's terms", () => {
    for (const item of buildChecklist(empty, none)) {
      expect(item.why.length).toBeGreaterThan(20);
      expect(item.why).not.toMatch(/required|field|invalid/i);
    }
  });
});

describe("the publish gate — four essentials, and only four", () => {
  const complete: ReviewProfile = {
    ...seeded,
    headshot_url: "https://abc.supabase.co/storage/v1/object/public/headshots/a.jpg",
  };

  it("allows publishing once headshot, story, role and location are in", () => {
    // Note: NO video, NO résumé, NO styles, NO gallery — five of the nine items
    // are still outstanding and must not block.
    const items = buildChecklist(complete, none);
    expect(canPublish(items)).toBe(true);
    expect(items.filter((i) => !i.done).length).toBeGreaterThan(0);
  });

  it("blocks publishing when ANY single essential is missing", () => {
    const essentials: Array<[string, Partial<ReviewProfile>]> = [
      ["headshot", { headshot_url: null }],
      ["bio", { bio: null }],
      ["primary_role", { primary_role: null }],
      ["city", { city: null }],
    ];
    for (const [name, patch] of essentials) {
      const items = buildChecklist({ ...complete, ...patch }, none);
      expect(canPublish(items), `missing ${name} must block publishing`).toBe(false);
    }
  });

  it("does NOT block on any recommended item", () => {
    const recommended: Array<Partial<ReviewProfile>> = [
      { teaching_reel_url: null },
      { resume_url: null },
      { social_links: null },
      { gallery_urls: null },
    ];
    for (const patch of recommended) {
      expect(canPublish(buildChecklist({ ...complete, ...patch }, none))).toBe(true);
    }
    // Nor on styles/levels, which live in join tables.
    expect(canPublish(buildChecklist(complete, { styles: 0, levels: 0 }))).toBe(true);
  });

  it("blocks an invited founder's empty profile until they fill the four in", () => {
    // Six real Founding Professionals land with a name and a badge and nothing
    // else. The gate applies to them exactly as it does to everyone.
    expect(canPublish(buildChecklist(empty, none))).toBe(false);
  });

  it("names every missing essential in the refusal, in plain words", () => {
    const msg = publishBlockedMessage(buildChecklist(empty, none));
    expect(msg).toContain("a headshot");
    expect(msg).toContain("your story");
    expect(msg).toContain("what you do");
    expect(msg).toContain("where you are");
    expect(msg).toMatch(/private draft/i);
    expect(msg).not.toMatch(/required|invalid|field/i);
  });

  it("uses natural language for a single missing item", () => {
    const msg = publishBlockedMessage(buildChecklist({ ...complete, headshot_url: null }, none));
    expect(msg).toContain("Your profile still needs a headshot.");
    expect(msg).not.toContain(" and ");
  });

  it("says nothing when there is nothing to say", () => {
    expect(publishBlockedMessage(buildChecklist(complete, none))).toBe("");
  });
});

describe("the gate is enforced on the server, not just in the UI", () => {
  const code = readFileSync(join(process.cwd(), "src/app/profile/review/actions.ts"), "utf8");

  it("the publish action checks canPublish itself", () => {
    // A disabled button is a courtesy; the action is the control.
    expect(code).toContain("canPublish(checklist)");
    expect(code).toContain("publishBlockedMessage(checklist)");
  });

  it("gates only the transition INTO published", () => {
    // Once live, this action is how a member switches to unlisted — a
    // privacy-protective move that must never be blocked.
    expect(code).toContain("publishing && !alreadyLive");
  });

  it("never blocks unpublishing — a member may always retreat to a draft", () => {
    const gateLine = code.split("\n").find((l) => l.includes("if (publishing &&"));
    expect(gateLine).toBeDefined();
    expect(gateLine).toContain("publishing");
  });
});

describe("assets we already hold", () => {
  it("recognises Relevé-hosted storage", () => {
    expect(isReleveHosted("https://abc.supabase.co/storage/v1/object/public/headshots/x.jpg")).toBe(true);
    expect(isReleveHosted("https://cdn.example.com/headshot.jpg")).toBe(false);
    expect(isReleveHosted(null)).toBe(false);
  });

  it("surfaces an external application asset the member has not replaced", () => {
    expect(
      carriedAssetsNeedingAttention(
        { headshotUrl: "https://cdn.example/h.jpg", resumeUrl: "https://cdn.example/cv.pdf" },
        { headshot_url: null, resume_url: null },
      ).map((a) => a.kind),
    ).toEqual(["headshot", "resume"]);
  });

  it("stops asking once they have uploaded their own", () => {
    expect(
      carriedAssetsNeedingAttention(
        { headshotUrl: "https://cdn.example/h.jpg", resumeUrl: null },
        {
          headshot_url: "https://abc.supabase.co/storage/v1/object/public/headshots/x.jpg",
          resume_url: null,
        },
      ),
    ).toEqual([]);
  });

  it("asks for nothing when the application supplied nothing", () => {
    expect(
      carriedAssetsNeedingAttention(
        { headshotUrl: null, resumeUrl: null },
        { headshot_url: null, resume_url: null },
      ),
    ).toEqual([]);
  });
});

describe("which welcome the member sees", () => {
  it("tells an approved applicant their application started the profile", () => {
    const a = resolveAudience({ profileStatus: "draft", prefilledFromApplicationId: "app-1" });
    expect(a).toBe("seeded_from_application");
    expect(WELCOME_COPY[a].heading).toMatch(/approved application/i);
  });

  it("does NOT tell an invited founder to review information that was never carried across", () => {
    // They never applied. Six real people are in exactly this position.
    const a = resolveAudience({ profileStatus: "draft", prefilledFromApplicationId: null });
    expect(a).toBe("invited_founder");
    expect(WELCOME_COPY[a].heading).not.toMatch(/application/i);
    expect(WELCOME_COPY[a].body).toMatch(/no application to carry across/i);
  });

  it("switches to the returning framing once published", () => {
    expect(
      resolveAudience({ profileStatus: "published", prefilledFromApplicationId: "app-1" }),
    ).toBe("returning");
  });
});

describe("the member is told what publishing does, before they do it", () => {
  it("states Roster inclusion and indexing for public", () => {
    expect(PUBLISH_MEANING.public).toMatch(/Roster/);
    expect(PUBLISH_MEANING.public).toMatch(/search engines/i);
  });

  it("states link-only and Roster exclusion for unlisted", () => {
    expect(PUBLISH_MEANING.unlisted).toMatch(/link/i);
    expect(PUBLISH_MEANING.unlisted).toMatch(/not appear on the Roster/i);
  });
});

describe("the publish action respects the brand rule", () => {
  const code = readFileSync(join(process.cwd(), "src/app/profile/review/actions.ts"), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

  it("cannot write any Relevé-controlled trust signal", () => {
    for (const field of [
      "verification_flag",
      "certified_eligible_at",
      "honorifics",
      "choreographer_tier",
      "founder_distinction",
    ]) {
      expect(code, `publishProfile must not touch ${field}`).not.toContain(field);
    }
  });

  it("does not create profiles — creation belongs to the activation service", () => {
    expect(code).not.toContain(".insert(");
  });

  it("routes visibility through normalizeVisibility rather than hardcoding it", () => {
    expect(code).toContain("normalizeVisibility(");
    expect(code).not.toContain('visibility: "public"');
  });
});
