import { describe, it, expect } from "vitest";
import {
  OFFERING_TYPES,
  PRICING_TYPES,
  CTA_TYPES,
  OFFERING_STATUSES,
  OFFERING_TYPE_LABEL,
  DEFAULT_CTA_BY_TYPE,
  OFFERING_LIMITS,
  isOfferingType,
  isPricingType,
  isCtaType,
  isValidHttpUrl,
  validateOffering,
  deriveCta,
  licensingHref,
  pricingDisplay,
  type OfferingInput,
} from "./offerings";

// A minimal valid input, spread + overridden per test.
const base: OfferingInput = { type: "service", title: "Master Class" };

// The vocab lists must stay in lockstep with the SQL CHECK constraints in
// supabase/migrations/20260812220000_professional_offerings.sql.
describe("controlled vocabularies", () => {
  it("exposes the six offering types", () => {
    expect([...OFFERING_TYPES].sort()).toEqual(
      ["event", "license", "other", "product", "service", "session"].sort(),
    );
  });

  it("labels every offering type", () => {
    for (const t of OFFERING_TYPES) {
      expect(OFFERING_TYPE_LABEL[t]).toBeTruthy();
    }
  });

  it("has a default CTA for every offering type", () => {
    for (const t of OFFERING_TYPES) {
      expect(CTA_TYPES).toContain(DEFAULT_CTA_BY_TYPE[t]);
    }
  });

  it("pricing types and statuses match the schema", () => {
    expect(PRICING_TYPES).toContain("starting_at");
    expect(PRICING_TYPES).toContain("contact");
    expect([...OFFERING_STATUSES].sort()).toEqual(["active", "inactive"]);
  });
});

describe("type guards", () => {
  it("accept known members and reject junk", () => {
    expect(isOfferingType("license")).toBe(true);
    expect(isOfferingType("teleport")).toBe(false);
    expect(isOfferingType(null)).toBe(false);
    expect(isPricingType("hourly")).toBe(true);
    expect(isPricingType("weekly")).toBe(false);
    expect(isCtaType("view_licensing")).toBe(true);
    expect(isCtaType("buy_now")).toBe(false);
  });
});

describe("isValidHttpUrl", () => {
  it("accepts http and https only", () => {
    expect(isValidHttpUrl("https://shop.example.com/tee")).toBe(true);
    expect(isValidHttpUrl("http://example.com")).toBe(true);
  });
  it("rejects other schemes and garbage", () => {
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    expect(isValidHttpUrl("mailto:me@example.com")).toBe(false);
    expect(isValidHttpUrl("not a url")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
  });
});

describe("validateOffering", () => {
  it("accepts a minimal valid offering and defaults status to active", () => {
    const res = validateOffering(base);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.type).toBe("service");
      expect(res.value.title).toBe("Master Class");
      expect(res.value.status).toBe("active");
      expect(res.value.shortDescription).toBeNull();
    }
  });

  it("trims strings and coerces empties to null", () => {
    const res = validateOffering({
      ...base,
      title: "  Private Coaching  ",
      shortDescription: "   ",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.title).toBe("Private Coaching");
      expect(res.value.shortDescription).toBeNull();
    }
  });

  it("requires a type", () => {
    const res = validateOffering({ ...base, type: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.field === "type")).toBe(true);
  });

  it("rejects an unknown type", () => {
    const res = validateOffering({ ...base, type: "franchise" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.field === "type")).toBe(true);
  });

  it("requires a title", () => {
    const res = validateOffering({ ...base, title: "  " });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.field === "title")).toBe(true);
  });

  it("enforces the title length ceiling", () => {
    const res = validateOffering({ ...base, title: "x".repeat(OFFERING_LIMITS.titleMax + 1) });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.field === "title")).toBe(true);
  });

  it("rejects a non-http external URL", () => {
    const res = validateOffering({ ...base, type: "product", externalUrl: "javascript:alert(1)" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.field === "externalUrl")).toBe(true);
  });

  it("accepts a valid https external URL", () => {
    const res = validateOffering({
      ...base,
      type: "product",
      externalUrl: "https://shop.example.com/tee",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.externalUrl).toBe("https://shop.example.com/tee");
  });

  it("rejects unknown pricing/location/cta/status values", () => {
    expect(validateOffering({ ...base, pricingType: "weekly" }).ok).toBe(false);
    expect(validateOffering({ ...base, locationMode: "moon" }).ok).toBe(false);
    expect(validateOffering({ ...base, ctaType: "buy_now" }).ok).toBe(false);
    expect(validateOffering({ ...base, status: "archived" }).ok).toBe(false);
  });

  it("collects multiple errors at once", () => {
    const res = validateOffering({ type: "", title: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe("deriveCta", () => {
  it("service/session default to the intro rail", () => {
    expect(deriveCta({ type: "service" })).toEqual({ action: "intro", label: "Inquire" });
    expect(deriveCta({ type: "session" })).toEqual({ action: "intro", label: "Inquire" });
  });

  it("product links out when it has an external URL", () => {
    expect(deriveCta({ type: "product", externalUrl: "https://shop.example.com" })).toEqual({
      action: "external",
      label: "View Product",
      href: "https://shop.example.com",
    });
  });

  it("product with no URL falls back to the intro rail", () => {
    expect(deriveCta({ type: "product" })).toEqual({ action: "intro", label: "Inquire" });
  });

  it("event registers via external URL, else falls back to intro", () => {
    expect(deriveCta({ type: "event", externalUrl: "https://ev.example.com" })).toEqual({
      action: "external",
      label: "Register",
      href: "https://ev.example.com",
    });
    expect(deriveCta({ type: "event" })).toEqual({ action: "intro", label: "Inquire" });
  });

  it("license links to the existing licensing page via signature_work_id", () => {
    expect(deriveCta({ type: "license", signatureWorkId: "abc-123" })).toEqual({
      action: "licensing",
      label: "View Licensing",
      href: licensingHref("abc-123"),
    });
  });

  it("license with no signature work falls back to the intro rail", () => {
    expect(deriveCta({ type: "license" })).toEqual({ action: "intro", label: "Inquire" });
  });

  it("other resolves to learn-more (external) or none when there is no link", () => {
    expect(deriveCta({ type: "other", externalUrl: "https://x.example.com" })).toEqual({
      action: "external",
      label: "Learn More",
      href: "https://x.example.com",
    });
    expect(deriveCta({ type: "other" })).toEqual({ action: "none", label: "" });
  });

  it("an explicit cta override wins over the type default", () => {
    // A product professional who prefers inquiries over an external shop link.
    expect(deriveCta({ type: "product", ctaType: "inquire" })).toEqual({
      action: "intro",
      label: "Inquire",
    });
  });

  it("licensingHref points at the existing /experiences route", () => {
    expect(licensingHref("work-9")).toBe("/experiences/work-9");
  });
});

describe("pricingDisplay", () => {
  it("prefers an explicit display string", () => {
    expect(pricingDisplay({ priceDisplay: "$85/hour", pricingType: "hourly" })).toBe("$85/hour");
    expect(pricingDisplay({ priceDisplay: "Starting at $250" })).toBe("Starting at $250");
  });

  it("uses canonical copy for free and contact when no display string is set", () => {
    expect(pricingDisplay({ pricingType: "free" })).toBe("Free");
    expect(pricingDisplay({ pricingType: "contact" })).toBe("Contact for pricing");
  });

  it("shows nothing for hidden/external/unpriced-structured in V1", () => {
    expect(pricingDisplay({ pricingType: "hidden" })).toBeNull();
    expect(pricingDisplay({ pricingType: "external" })).toBeNull();
    expect(pricingDisplay({ pricingType: "hourly" })).toBeNull();
    expect(pricingDisplay({})).toBeNull();
  });
});
