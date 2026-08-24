import { describe, it, expect } from "vitest";
import {
  entitlementTerms,
  isEntitlementKind,
  entitlementLabel,
  normalizeEmail,
  INVITED_PROFESSIONAL_PERMANENT_SOURCE,
  INVITED_PROFESSIONAL_TERM_SOURCE,
  INVITED_PROFESSIONAL_TERM_MONTHS,
} from "./invited-professional";
import {
  COMP_PERMANENT_SOURCE,
  COMP_TERM_SOURCE,
} from "@/lib/founding/founding-professional";

describe("entitlementTerms — billing flavor, no identity", () => {
  it("permanent complimentary never expires", () => {
    const terms = entitlementTerms("permanent", new Date("2026-08-24T12:00:00Z"));
    expect(terms.source).toBe(INVITED_PROFESSIONAL_PERMANENT_SOURCE);
    expect(terms.renewalDate).toBeNull();
  });

  it("12-month complimentary expires exactly INVITED_PROFESSIONAL_TERM_MONTHS out", () => {
    const from = new Date("2026-08-24T12:00:00Z");
    const terms = entitlementTerms("comp_12mo", from);
    expect(terms.source).toBe(INVITED_PROFESSIONAL_TERM_SOURCE);
    expect(terms.renewalDate).not.toBeNull();

    const expected = new Date(from);
    expected.setMonth(expected.getMonth() + INVITED_PROFESSIONAL_TERM_MONTHS);
    expect(terms.renewalDate).toBe(expected.toISOString());
    expect(new Date(terms.renewalDate as string).getUTCFullYear()).toBe(2027);
  });

  it("the two flavors use DIFFERENT sources so billing is queryable", () => {
    expect(entitlementTerms("permanent").source).not.toBe(entitlementTerms("comp_12mo").source);
  });

  it("this pathway's sources are DISTINCT from Founding Professional's — the whole point of this migration", () => {
    // Kathleen's explicit requirement: reportable apart without reconstructing
    // history from either grants table.
    expect(INVITED_PROFESSIONAL_PERMANENT_SOURCE).not.toBe(COMP_PERMANENT_SOURCE);
    expect(INVITED_PROFESSIONAL_TERM_SOURCE).not.toBe(COMP_TERM_SOURCE);
  });

  it("neither source claims to be a 'founder' or 'founding' concept", () => {
    expect(INVITED_PROFESSIONAL_PERMANENT_SOURCE).not.toContain("found");
    expect(INVITED_PROFESSIONAL_TERM_SOURCE).not.toContain("found");
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
    expect(normalizeEmail("  Invitee@Example.COM ")).toBe("invitee@example.com");
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});
