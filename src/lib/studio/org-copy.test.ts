// org-copy — the org-type-aware editor labels. Proves a dance_team Director sees
// "team" language and a studio owner keeps "studio" language, from one source.

import { describe, expect, it } from "vitest";

import { orgCopy } from "./org-copy";

describe("orgCopy", () => {
  it("uses team language for a dance_team", () => {
    const c = orgCopy("dance_team");
    expect(c.isTeam).toBe(true);
    expect(c.noun).toBe("team");
    expect(c.owner).toBe("Team Director");
    expect(c.nameLabel).toBe("Team name");
    expect(c.saveLabel).toBe("Save team profile");
    expect(c.setupTitle).toBe("Set up your team");
    expect(c.returningTitle).toBe("Your team");
  });

  it("uses studio language for a studio (and any non-team / null)", () => {
    for (const t of ["studio", null, undefined, "other"]) {
      const c = orgCopy(t);
      expect(c.isTeam).toBe(false);
      expect(c.noun).toBe("studio");
      expect(c.owner).toBe("studio owner");
      expect(c.nameLabel).toBe("Studio name");
      expect(c.saveLabel).toBe("Save studio profile");
    }
  });
});
