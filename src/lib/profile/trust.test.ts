import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FOUNDER_DISTINCTIONS,
  CONFERRABLE_DISTINCTIONS,
  CHOREOGRAPHER_TIERS,
  CONFERRABLE_HONORIFICS,
  RETIRED_HONORIFICS,
  isFounderDistinction,
  isChoreographerTier,
  isRetiredHonorific,
  normalizeHonorifics,
  diffTrustSignals,
  resolveTrustUpdate,
  type TrustSignals,
} from "./trust";

const base: TrustSignals = {
  honorifics: [],
  founder_distinction: "none",
  choreographer_tier: "emerging",
};

describe("vocabularies match the live database", () => {
  it("carries all four choreographer tiers — featured is preserved, not remapped", () => {
    expect(CHOREOGRAPHER_TIERS).toEqual(["emerging", "established", "featured", "signature"]);
    expect(isChoreographerTier("featured")).toBe(true);
  });

  it("carries all four founder distinctions", () => {
    expect(FOUNDER_DISTINCTIONS).toEqual([
      "none",
      "founding_25",
      "first_50",
      "founding_professional",
    ]);
  });

  it("offers founding_25 for conferral but never first_50", () => {
    expect(CONFERRABLE_DISTINCTIONS).toContain("founding_25");
    expect(CONFERRABLE_DISTINCTIONS).not.toContain("first_50");
  });

  it("rejects values outside the enums", () => {
    expect(isFounderDistinction("founding_50")).toBe(false);
    expect(isChoreographerTier("platinum")).toBe(false);
    expect(isFounderDistinction(null)).toBe(false);
  });
});

describe("honorifics", () => {
  it("does not offer the two that collided with system marks", () => {
    expect(RETIRED_HONORIFICS).toEqual(["Verified Artist", "Founding Artist"]);
    for (const h of RETIRED_HONORIFICS) {
      expect(CONFERRABLE_HONORIFICS).not.toContain(h);
      expect(isRetiredHonorific(h)).toBe(true);
    }
  });

  it("refuses to add a retired honorific even if submitted directly", () => {
    // The API is the boundary, not the UI: a hand-crafted request must not be
    // able to re-add "Verified Artist" beside the real ✓ Verified Member mark.
    expect(normalizeHonorifics(["Master Teacher", "Verified Artist"])).toEqual(["Master Teacher"]);
  });

  it("trims, drops blanks, and de-duplicates while preserving order", () => {
    expect(normalizeHonorifics([" Master Teacher ", "", "Master Teacher", "Adaptive Arts Faculty"]))
      .toEqual(["Master Teacher", "Adaptive Arts Faculty"]);
  });

  it("treats a non-array as empty rather than throwing", () => {
    expect(normalizeHonorifics("Master Teacher")).toEqual([]);
    expect(normalizeHonorifics(null)).toEqual([]);
  });
});

describe("resolveTrustUpdate — a malformed request never changes standing", () => {
  const current: TrustSignals = {
    honorifics: ["Master Teacher"],
    founder_distinction: "founding_25",
    choreographer_tier: "signature",
  };

  it("applies valid submitted values", () => {
    expect(
      resolveTrustUpdate(current, {
        honorifics: ["Adaptive Arts Faculty"],
        founder_distinction: "none",
        choreographer_tier: "established",
      }),
    ).toEqual({
      honorifics: ["Adaptive Arts Faculty"],
      founder_distinction: "none",
      choreographer_tier: "established",
    });
  });

  it("keeps the CURRENT value for anything missing", () => {
    expect(resolveTrustUpdate(current, {})).toEqual(current);
  });

  it("keeps the current value for anything unrecognised — never resets to a default", () => {
    // The dangerous failure would be silently downgrading a Founding 25 to 'none'
    // because a request was malformed.
    expect(
      resolveTrustUpdate(current, {
        founder_distinction: "bogus",
        choreographer_tier: "platinum",
      }),
    ).toEqual(current);
  });

  it("allows a deliberate withdrawal — admins can correct a mistake", () => {
    const next = resolveTrustUpdate(current, {
      honorifics: [],
      founder_distinction: "none",
      choreographer_tier: "emerging",
    });
    expect(next).toEqual(base);
  });
});

describe("diffTrustSignals — what gets written to the audit trail", () => {
  it("returns nothing when nothing changed, so no-ops are never logged", () => {
    expect(diffTrustSignals(base, { ...base })).toEqual([]);
  });

  it("records a conferral with its before and after", () => {
    expect(diffTrustSignals(base, { ...base, founder_distinction: "founding_25" })).toEqual([
      { field: "founder_distinction", previous: "none", next: "founding_25" },
    ]);
  });

  it("records honorifics as readable text, not an array dump", () => {
    expect(
      diffTrustSignals(base, { ...base, honorifics: ["Master Teacher", "Adaptive Arts Faculty"] }),
    ).toEqual([
      { field: "honorifics", previous: "", next: "Master Teacher, Adaptive Arts Faculty" },
    ]);
  });

  it("records one row per field when several change at once", () => {
    const changes = diffTrustSignals(base, {
      honorifics: ["Master Teacher"],
      founder_distinction: "founding_25",
      choreographer_tier: "signature",
    });
    expect(changes.map((c) => c.field)).toEqual([
      "honorifics",
      "founder_distinction",
      "choreographer_tier",
    ]);
  });
});

describe("the brand rule holds across the codebase", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const stripComments = (s: string) =>
    s
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");

  it("the member's own form still cannot write a trust signal", () => {
    // Slice 2's guarantee, re-asserted here: adding an admin path must not have
    // reopened the member path.
    const code = stripComments(read("src/app/profile/edit/actions.ts"));
    for (const field of [
      "verification_flag",
      "honorifics",
      "choreographer_tier",
      "founder_distinction",
    ]) {
      expect(code, `saveProfile must not touch ${field}`).not.toContain(field);
    }
  });

  it("the admin trust route is gated on a signed-in admin", () => {
    const code = read("src/app/api/admin/profiles/[profileId]/trust/route.ts");
    expect(code).toContain("requireAdmin(req)");
    expect(code).toContain("if (!gate.ok) return gate.response;");
  });

  it("founding_25 is never inferred from the application's fee-waiver flag", () => {
    // Founder decision B: financial treatment and Relevé distinction are
    // different concepts. is_founding_25 controls the $30 waiver and nothing else.
    const trust = read("src/lib/profile/trust.ts");
    const route = read("src/app/api/admin/profiles/[profileId]/trust/route.ts");
    const activate = read("src/lib/profile/activate.ts");
    for (const src of [stripComments(trust), stripComments(route), stripComments(activate)]) {
      expect(src).not.toContain("is_founding_25");
    }
  });

  it("no pricing or split logic reads choreographer_tier", () => {
    // Founder decision C: curation and economics are separate until Choreo
    // License deliberately decides the relationship.
    const code = stripComments(read("src/app/api/admin/profiles/[profileId]/trust/route.ts"));
    for (const money of ["price_cents", "application_fee", "platform_fee", "amount_cents"]) {
      expect(code).not.toContain(money);
    }
  });
});
