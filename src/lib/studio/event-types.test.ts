import { describe, it, expect } from "vitest";
import { EVENT_TYPE_BY_SLUG, familyLabelFor, studioLabelFor, hintFor } from "./event-types";

describe("event-types — Dance Team overrides", () => {
  const fullStudioEvent = EVENT_TYPE_BY_SLUG["full_studio_event"];

  it("studioLabelFor: 'Full Studio Event' for a studio, 'Full Team Event' for a team", () => {
    expect(studioLabelFor(fullStudioEvent, false)).toBe("Full Studio Event");
    expect(studioLabelFor(fullStudioEvent, true)).toBe("Full Team Event");
  });

  it("hintFor: 'Everyone at your studio' vs 'Everyone on your team'", () => {
    expect(hintFor(fullStudioEvent, false)).toMatch(/^Everyone at your studio/);
    expect(hintFor(fullStudioEvent, true)).toMatch(/^Everyone on your team/);
  });

  it("familyLabelFor: the default title follows the same override", () => {
    expect(familyLabelFor("full_studio_event", 0, false)).toBe("Full Studio Event");
    expect(familyLabelFor("full_studio_event", 0, true)).toBe("Full Team Event");
  });

  it("a type with no team override reads identically for a studio and a team", () => {
    const classDef = EVENT_TYPE_BY_SLUG["class"];
    expect(studioLabelFor(classDef, false)).toBe(studioLabelFor(classDef, true));
    expect(hintFor(classDef, false)).toBe(hintFor(classDef, true));
    expect(familyLabelFor("class", 0, false)).toBe(familyLabelFor("class", 0, true));
  });

  it("familyLabelFor still defaults isTeam to false (existing call sites unaffected)", () => {
    expect(familyLabelFor("full_studio_event")).toBe("Full Studio Event");
  });
});
