import { describe, it, expect } from "vitest";
import {
  entitlementTerms,
  isEntitlementKind,
  entitlementLabel,
  normalizeEmail,
  COMP_PERMANENT_SOURCE,
  COMP_TERM_SOURCE,
  COMP_TERM_MONTHS,
  FOUNDING_PROFESSIONAL_DISTINCTION,
} from "./founding-professional";

describe("entitlementTerms — billing flavor (identity-agnostic)", () => {
  it("permanent complimentary never expires", () => {
    const terms = entitlementTerms("permanent", new Date("2026-08-13T12:00:00Z"));
    expect(terms.source).toBe(COMP_PERMANENT_SOURCE);
    expect(terms.renewalDate).toBeNull(); // NULL renewal = never billed, never lapses
  });

  it("12-month complimentary expires exactly COMP_TERM_MONTHS out", () => {
    const from = new Date("2026-08-13T12:00:00Z");
    const terms = entitlementTerms("comp_12mo", from);
    expect(terms.source).toBe(COMP_TERM_SOURCE);
    expect(terms.renewalDate).not.toBeNull();

    const expected = new Date(from);
    expected.setMonth(expected.getMonth() + COMP_TERM_MONTHS);
    expect(terms.renewalDate).toBe(expected.toISOString());
    // Sanity: it's a year later.
    expect(new Date(terms.renewalDate as string).getUTCFullYear()).toBe(2027);
  });

  it("the two flavors use DIFFERENT sources so billing is queryable", () => {
    expect(entitlementTerms("permanent").source).not.toBe(entitlementTerms("comp_12mo").source);
  });

  it("neither flavor's source mentions 'founder' — billing carries no identity", () => {
    // The decoupling guarantee: no code can infer identity from the membership row.
    expect(COMP_PERMANENT_SOURCE).not.toContain("found");
    expect(COMP_TERM_SOURCE).not.toContain("found");
    // And identity is its own value, unrelated to billing sources.
    expect(FOUNDING_PROFESSIONAL_DISTINCTION).toBe("founding_professional");
  });
});

describe("isEntitlementKind", () => {
  it("accepts only the two valid kinds", () => {
    expect(isEntitlementKind("permanent")).toBe(true);
    expect(isEntitlementKind("comp_12mo")).toBe(true);
    expect(isEntitlementKind("free_forever")).toBe(false);
    expect(isEntitlementKind("")).toBe(false);
    expect(isEntitlementKind(null)).toBe(false);
    expect(isEntitlementKind(undefined)).toBe(false);
  });
});

describe("entitlementLabel", () => {
  it("reads in plain admin language", () => {
    expect(entitlementLabel("permanent")).toBe("Permanent complimentary");
    expect(entitlementLabel("comp_12mo")).toBe("12-month complimentary");
  });
});

describe("normalizeEmail", () => {
  it("lower-cases and trims (matches Supabase Auth storage)", () => {
    expect(normalizeEmail("  Founder@Example.COM ")).toBe("founder@example.com");
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});
