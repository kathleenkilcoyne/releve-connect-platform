// Organization branding — the pure core. Proves the four behaviors the slice
// calls out: monogram derivation, contrast fallback (dark AND light accents both
// yield legible text), the header model rendering from affiliation alone (no
// events), and the <= 60 motto limit.

import { describe, expect, it } from "vitest";

import {
  MOTTO_MAX,
  brandHeaderModel,
  contrastRatio,
  isValidMotto,
  monogramFrom,
  normalizeHex,
  readableTextColor,
  type OrgBrand,
} from "./branding";

describe("monogramFrom", () => {
  it("skips the leading article 'The' and caps at three initials", () => {
    expect(monogramFrom("The Manhattan College Dance Team")).toBe("MCD");
  });

  it("skips '(…)' tags", () => {
    expect(monogramFrom("Elite (NBA) Dancers")).toBe("ED");
  });

  it("uses the first two letters of a single significant word", () => {
    expect(monogramFrom("Rockettes")).toBe("RO");
    expect(monogramFrom("The Rockettes")).toBe("RO");
  });

  it("takes one initial per significant word", () => {
    expect(monogramFrom("Test College Dance Team")).toBe("TCD");
  });

  it("handles empty / punctuation-only names without throwing", () => {
    expect(monogramFrom("")).toBe("");
    expect(monogramFrom("   ")).toBe("");
    expect(monogramFrom("(retired)")).toBe("");
  });

  it("preserves accented initials (Relevé world)", () => {
    // 'de' is a significant word (only 'the' is skipped) → É · d · B, capped at 3.
    expect(monogramFrom("École de Ballet")).toBe("ÉDB");
  });
});

describe("readableTextColor — contrast fallback", () => {
  it("returns white on a DARK accent and near-black on a LIGHT accent, both legible", () => {
    const onDark = readableTextColor("#1a1a2e"); // deep navy
    const onLight = readableTextColor("#ffe066"); // bright yellow
    expect(onDark).toBe("#ffffff");
    expect(onLight).toBe("#111111");
    // "Legible" = WCAG AA large-text (>= 3:1); both comfortably clear it.
    expect(contrastRatio("#1a1a2e", onDark)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffe066", onLight)).toBeGreaterThanOrEqual(4.5);
  });

  it("falls back to near-black for an invalid/empty accent", () => {
    expect(readableTextColor(null)).toBe("#111111");
    expect(readableTextColor("not-a-color")).toBe("#111111");
  });
});

describe("normalizeHex", () => {
  it("expands #rgb and lowercases; rejects junk", () => {
    expect(normalizeHex("#FFF")).toBe("#ffffff");
    expect(normalizeHex("#1A1A2E")).toBe("#1a1a2e");
    expect(normalizeHex("blue")).toBeNull();
    expect(normalizeHex("#12")).toBeNull();
  });
});

describe("brandHeaderModel — renders from affiliation, independent of events", () => {
  const base: OrgBrand = {
    name: "Test College Dance Team",
    logoUrl: null,
    accent: "#1a1a2e",
    accent2: null,
    motto: "Rise together",
  };

  it("produces a monogram + accessible foreground when there is no logo (and no events involved at all)", () => {
    const m = brandHeaderModel(base);
    expect(m.name).toBe("Test College Dance Team");
    expect(m.logoUrl).toBeNull();
    expect(m.monogram).toBe("TCD");
    expect(m.accent).toBe("#1a1a2e");
    expect(m.foreground).toBe("#ffffff"); // legible on the dark tile
    expect(m.motto).toBe("Rise together");
  });

  it("prefers the logo when present and normalizes a light accent's foreground", () => {
    const m = brandHeaderModel({ ...base, logoUrl: "https://cdn/x.png", accent: "#ffe066" });
    expect(m.logoUrl).toBe("https://cdn/x.png");
    expect(m.foreground).toBe("#111111");
  });

  it("drops an invalid accent to null (header falls back to neutral)", () => {
    const m = brandHeaderModel({ ...base, accent: "periwinkle" });
    expect(m.accent).toBeNull();
  });
});

describe("motto <= 60 limit", () => {
  it("accepts empty and up-to-60, rejects 61+", () => {
    expect(isValidMotto(null)).toBe(true);
    expect(isValidMotto("")).toBe(true);
    expect(isValidMotto("a".repeat(MOTTO_MAX))).toBe(true);
    expect(isValidMotto("a".repeat(MOTTO_MAX + 1))).toBe(false);
  });

  it("counts the trimmed length", () => {
    expect(isValidMotto("  " + "a".repeat(MOTTO_MAX) + "  ")).toBe(true);
  });
});
