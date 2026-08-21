import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isVisibility,
  normalizeVisibility,
  canViewByDirectLink,
  appearsInDiscovery,
  shouldIndex,
  VISIBILITY_VALUES,
  VISIBILITY_COPY,
} from "./visibility";

const published = (visibility: string) => ({ profileStatus: "published", visibility });
const draft = (visibility: string) => ({ profileStatus: "draft", visibility });

describe("the two axes stay separate", () => {
  it("offers exactly public and unlisted — members_only is not in this slice", () => {
    expect(VISIBILITY_VALUES).toEqual(["public", "unlisted"]);
    expect(VISIBILITY_VALUES).not.toContain("members_only");
  });

  it("recognises only the real values", () => {
    expect(isVisibility("public")).toBe(true);
    expect(isVisibility("unlisted")).toBe(true);
    expect(isVisibility("members_only")).toBe(false);
    expect(isVisibility("")).toBe(false);
    expect(isVisibility(null)).toBe(false);
  });
});

describe("canViewByDirectLink — what 'link-only' actually means", () => {
  it("shows a published public profile to anyone", () => {
    expect(canViewByDirectLink(published("public"))).toBe(true);
  });

  it("SHOWS a published unlisted profile to someone holding the URL", () => {
    // The whole point of D1. Before Profile V2 this was false, so `unlisted`
    // 404'd for everyone and the setting was unusable.
    expect(canViewByDirectLink(published("unlisted"))).toBe(true);
  });

  it("hides a draft from everyone but its owner", () => {
    expect(canViewByDirectLink(draft("public"))).toBe(false);
    expect(canViewByDirectLink(draft("unlisted"))).toBe(false);
    expect(canViewByDirectLink(draft("public"), true)).toBe(true);
    expect(canViewByDirectLink(draft("unlisted"), true)).toBe(true);
  });

  it("hides a profile carrying an unrecognised visibility value", () => {
    expect(canViewByDirectLink(published("members_only"))).toBe(false);
    expect(canViewByDirectLink({ profileStatus: "published", visibility: null })).toBe(false);
  });
});

describe("appearsInDiscovery — the Roster and every other discovery surface", () => {
  it("includes only published + public", () => {
    expect(appearsInDiscovery(published("public"))).toBe(true);
  });

  it("EXCLUDES unlisted — that is what makes it link-only", () => {
    expect(appearsInDiscovery(published("unlisted"))).toBe(false);
  });

  it("excludes drafts", () => {
    expect(appearsInDiscovery(draft("public"))).toBe(false);
  });

  it("matches the roster_profiles view's WHERE clause exactly", () => {
    // The view filters `profile_status = 'published' and visibility = 'public'`,
    // so the Roster needed no change. This asserts the code agrees with the
    // database rather than drifting from it.
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260712210504_roster_certifications_and_view.sql"),
      "utf8",
    );
    expect(sql).toContain("where p.profile_status = 'published' and p.visibility = 'public'");
  });
});

describe("shouldIndex — link-only as a fact, not a promise", () => {
  it("indexes an intentionally public profile", () => {
    expect(shouldIndex(published("public"))).toBe(true);
  });

  it("does NOT index an unlisted profile", () => {
    expect(shouldIndex(published("unlisted"))).toBe(false);
  });

  it("does not index a draft", () => {
    expect(shouldIndex(draft("public"))).toBe(false);
  });
});

describe("normalizeVisibility — a save can never silently widen exposure", () => {
  it("takes the member's explicit choice", () => {
    expect(normalizeVisibility("unlisted", "public")).toBe("unlisted");
    expect(normalizeVisibility("public", "unlisted")).toBe("public");
  });

  it("keeps what they already had when the form sends nothing", () => {
    // This is the bug being fixed: the old code wrote 'public' unconditionally,
    // so an unlisted member reverted to public the moment they edited anything.
    expect(normalizeVisibility(undefined, "unlisted")).toBe("unlisted");
    expect(normalizeVisibility(null, "unlisted")).toBe("unlisted");
    expect(normalizeVisibility("", "unlisted")).toBe("unlisted");
  });

  it("ignores an unrecognised submitted value rather than trusting it", () => {
    expect(normalizeVisibility("members_only", "unlisted")).toBe("unlisted");
    expect(normalizeVisibility("public; drop table", "unlisted")).toBe("unlisted");
  });

  it("falls back to public only when there is nothing to preserve", () => {
    expect(normalizeVisibility(undefined, null)).toBe("public");
  });
});

describe("member-facing copy", () => {
  it("states plainly what each option means", () => {
    expect(VISIBILITY_COPY.public.help).toMatch(/Roster/);
    expect(VISIBILITY_COPY.public.help).toMatch(/search engines/i);
    expect(VISIBILITY_COPY.unlisted.help).toMatch(/link/i);
    expect(VISIBILITY_COPY.unlisted.help).toMatch(/not appear on the Roster/i);
  });
});

describe("saveProfile no longer forces visibility", () => {
  const code = () =>
    readFileSync(join(process.cwd(), "src/app/profile/edit/actions.ts"), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

  it('does not hardcode visibility: "public"', () => {
    expect(code()).not.toContain('visibility: "public"');
  });

  it("routes the value through normalizeVisibility", () => {
    expect(code()).toContain("normalizeVisibility(");
  });
});

describe("discovery surfaces filter on publication", () => {
  it("/roster/saved excludes unpublished profiles", () => {
    // It reads talent_profiles with the SERVICE ROLE, which bypasses RLS, so the
    // filter has to be explicit. Without it a saved profile that was later
    // unpublished kept rendering — someone else's draft, on your list.
    const src = readFileSync(join(process.cwd(), "src/app/roster/saved/page.tsx"), "utf8");
    expect(src).toContain('.eq("profile_status", "published")');
  });
});
