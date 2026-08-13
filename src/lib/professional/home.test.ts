// Slice 1 — "My Professional Home" pure shaping rules. The DB assembly is thin;
// the judgment calls (what counts as a view, empty vs. real activity, the unread
// badge, the greeting) are pure and pinned here.

import { describe, expect, it } from "vitest";

import {
  AVAILABLE_FOR_SERVICES,
  firstNameOf,
  hasActivity,
  isSeniorSpotlightArtist,
  locationLabel,
  shouldLogProfileView,
  titleCaseRole,
  unreadBadge,
} from "./home";

describe("shouldLogProfileView — the view-counting rule", () => {
  it("counts a stranger viewing a LIVE profile", () => {
    expect(shouldLogProfileView({ isLive: true, isOwnerViewing: false })).toBe(true);
  });

  it("never counts the owner viewing their own profile", () => {
    expect(shouldLogProfileView({ isLive: true, isOwnerViewing: true })).toBe(false);
  });

  it("never counts a draft / non-public profile", () => {
    expect(shouldLogProfileView({ isLive: false, isOwnerViewing: false })).toBe(false);
  });
});

describe("hasActivity — empty vs. real", () => {
  it("is false when everything is zero (drives the warm empty state)", () => {
    expect(hasActivity({ saves: 0, inquiries: 0, views: 0 })).toBe(false);
  });

  it("is true if any single signal exists", () => {
    expect(hasActivity({ saves: 0, inquiries: 0, views: 1 })).toBe(true);
    expect(hasActivity({ saves: 2, inquiries: 0, views: 0 })).toBe(true);
    expect(hasActivity({ saves: 0, inquiries: 3, views: 0 })).toBe(true);
  });
});

describe("unreadBadge — no dead zeros", () => {
  it("returns null for 0 or negative so no badge renders", () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(-1)).toBeNull();
  });

  it("shows the number up to 99", () => {
    expect(unreadBadge(1)).toBe("1");
    expect(unreadBadge(99)).toBe("99");
  });

  it("caps at 99+", () => {
    expect(unreadBadge(100)).toBe("99+");
    expect(unreadBadge(4210)).toBe("99+");
  });
});

describe("locationLabel — the hero location line", () => {
  it("joins present parts with commas", () => {
    expect(locationLabel(["Montclair", "NJ", "USA"])).toBe("Montclair, NJ, USA");
  });

  it("skips blanks and null/undefined", () => {
    expect(locationLabel(["Montclair", null, "USA"])).toBe("Montclair, USA");
    expect(locationLabel([" ", "NJ", undefined])).toBe("NJ");
  });

  it("returns null when nothing is present", () => {
    expect(locationLabel([null, "", "   "])).toBeNull();
    expect(locationLabel([])).toBeNull();
  });
});

describe("titleCaseRole — a controlled-vocabulary role", () => {
  it("humanizes snake_case roles", () => {
    expect(titleCaseRole("working_dancer")).toBe("Working Dancer");
    expect(titleCaseRole("choreographer")).toBe("Choreographer");
  });

  it("is null-safe", () => {
    expect(titleCaseRole(null)).toBeNull();
    expect(titleCaseRole("")).toBeNull();
  });
});

describe("isSeniorSpotlightArtist — the curated honor gate", () => {
  it("shows for a member with a founder distinction", () => {
    expect(isSeniorSpotlightArtist("founding_honoree")).toBe(true);
  });

  it("hides for an ordinary member (no distinction)", () => {
    expect(isSeniorSpotlightArtist(null)).toBe(false);
    expect(isSeniorSpotlightArtist("")).toBe(false);
    expect(isSeniorSpotlightArtist("   ")).toBe(false);
  });

  it("treats the 'none' sentinel as no distinction (handoff §6 fix)", () => {
    expect(isSeniorSpotlightArtist("none")).toBe(false);
    expect(isSeniorSpotlightArtist("None")).toBe(false);
    expect(isSeniorSpotlightArtist("  none  ")).toBe(false);
  });
});

describe("AVAILABLE_FOR_SERVICES — the services vocabulary", () => {
  it("includes the canonical services and no duplicates", () => {
    expect(AVAILABLE_FOR_SERVICES).toContain("Master Classes");
    expect(AVAILABLE_FOR_SERVICES).toContain("Competition Choreography");
    expect(AVAILABLE_FOR_SERVICES).toContain("College Audition Coaching");
    expect(new Set(AVAILABLE_FOR_SERVICES).size).toBe(AVAILABLE_FOR_SERVICES.length);
  });
});

describe("firstNameOf — the greeting", () => {
  it("takes the first token", () => {
    expect(firstNameOf("Kathleen McAree")).toBe("Kathleen");
  });

  it("handles single names", () => {
    expect(firstNameOf("Twyla")).toBe("Twyla");
  });

  it("is resilient to empty / whitespace / null", () => {
    expect(firstNameOf("")).toBeNull();
    expect(firstNameOf("   ")).toBeNull();
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf(undefined)).toBeNull();
  });
});
