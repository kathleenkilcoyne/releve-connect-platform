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
    expect(c.noticeEyebrow).toBe("Relevé Connect · For Dance Teams");
    expect(c.directorTitle).toBe("Coach / Team Director");
    expect(c.staffCountLabel(3)).toBe("3 coaches/staff");
    expect(c.backLink).toEqual({ href: "/", label: "← Back to Relevé" });
    // Admin review page (/admin/studios/[id]) field labels.
    expect(c.cultureQuestionLabel).toBe("What's special about this team?");
    expect(c.uniqueQuestionLabel).toBe("What makes this team unique?");
    expect(c.taglineLabel).toBe("Team tagline");
    expect(c.scaleBandLabel).toBe("Team size");
    expect(c.staffFieldLabel).toBe("Coaching staff");
    expect(c.bioFieldLabel).toBe("More about the team");
  });

  it("uses studio language for a studio (and any non-team / null)", () => {
    for (const t of ["studio", null, undefined, "other"]) {
      const c = orgCopy(t);
      expect(c.isTeam).toBe(false);
      expect(c.noun).toBe("studio");
      expect(c.owner).toBe("studio owner");
      expect(c.nameLabel).toBe("Studio name");
      expect(c.saveLabel).toBe("Save studio profile");
      expect(c.noticeEyebrow).toBe("Relevé Connect · For Studios");
      expect(c.directorTitle).toBe("Artistic Director");
      expect(c.staffCountLabel(3)).toBe("3 teachers");
      expect(c.backLink).toEqual({ href: "/studios", label: "← About Founding Studios" });
      // Admin review page (/admin/studios/[id]) field labels — verbatim
      // Studio wording, unchanged from before this page was made org-aware.
      expect(c.cultureQuestionLabel).toBe("What is special about teaching at your school?");
      expect(c.uniqueQuestionLabel).toBe("What makes your studio unique?");
      expect(c.taglineLabel).toBe("Your studio in one line (tagline)");
      expect(c.scaleBandLabel).toBe("Student-count band");
      expect(c.staffFieldLabel).toBe("Staff (teachers)");
      expect(c.bioFieldLabel).toBe("Anything else about the studio");
    }
  });
});
