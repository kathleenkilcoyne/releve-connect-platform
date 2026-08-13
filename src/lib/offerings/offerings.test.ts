import { describe, it, expect } from "vitest";
import {
  OFFERING_TYPES,
  PRICING_TYPES,
  CTA_TYPES,
  OFFERING_STATUSES,
  OFFERING_TYPE_LABEL,
  DEFAULT_CTA_BY_TYPE,
  OFFERING_LIMITS,
  AMOUNT_PRICING_TYPES,
  PRICING_TYPE_LABEL,
  LOCATION_MODE_LABEL,
  LOCATION_MODES,
  isOfferingType,
  isPricingType,
  isCtaType,
  isValidHttpUrl,
  validateOffering,
  deriveCta,
  licensingHref,
  pricingDisplay,
  formatMoney,
  formatPriceDisplay,
  resolvePricing,
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

  it("other defaults to the intro rail (founder spec: Other → Inquire)", () => {
    expect(deriveCta({ type: "other" })).toEqual({ action: "intro", label: "Inquire" });
    expect(DEFAULT_CTA_BY_TYPE.other).toBe("inquire");
  });

  it("an explicit learn_more override still links out when a URL is present", () => {
    expect(
      deriveCta({ type: "other", ctaType: "learn_more", externalUrl: "https://x.example.com" }),
    ).toEqual({ action: "external", label: "Learn More", href: "https://x.example.com" });
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

describe("builder label maps", () => {
  it("labels every pricing type and location mode", () => {
    for (const p of PRICING_TYPES) expect(PRICING_TYPE_LABEL[p]).toBeTruthy();
    for (const m of LOCATION_MODES) expect(LOCATION_MODE_LABEL[m]).toBeTruthy();
  });

  it("only amount-carrying pricing types are in AMOUNT_PRICING_TYPES", () => {
    expect([...AMOUNT_PRICING_TYPES].sort()).toEqual(
      ["daily", "fixed", "hourly", "project", "starting_at"].sort(),
    );
    // contact/free/hidden do NOT carry an amount
    expect(AMOUNT_PRICING_TYPES).not.toContain("free");
    expect(AMOUNT_PRICING_TYPES).not.toContain("contact");
  });

  it("raised the short-description ceiling for a generous writing area", () => {
    expect(OFFERING_LIMITS.shortMax).toBe(600);
  });
});

describe("formatMoney", () => {
  it("drops cents on whole dollars and adds thousands separators", () => {
    expect(formatMoney(85)).toBe("$85");
    expect(formatMoney(600)).toBe("$600");
    expect(formatMoney(1250)).toBe("$1,250");
  });
  it("keeps two decimals when there are cents", () => {
    expect(formatMoney(85.5)).toBe("$85.50");
  });
});

describe("formatPriceDisplay", () => {
  it("composes each amount-carrying type (the founder's examples)", () => {
    expect(formatPriceDisplay("hourly", 85)).toBe("$85 / hour");
    expect(formatPriceDisplay("daily", 600)).toBe("$600 / day");
    expect(formatPriceDisplay("project", 175)).toBe("$175 / project");
    expect(formatPriceDisplay("starting_at", 250)).toBe("Starting at $250");
    expect(formatPriceDisplay("fixed", 175)).toBe("$175");
  });
  it("returns null for non-amount types", () => {
    expect(formatPriceDisplay("free", 0)).toBeNull();
    expect(formatPriceDisplay("contact", 0)).toBeNull();
    expect(formatPriceDisplay("hidden", 0)).toBeNull();
  });
});

describe("resolvePricing", () => {
  it("no pricing type → both null (never forces a price)", () => {
    expect(resolvePricing({ pricingType: "", amount: "" })).toEqual({
      ok: true,
      pricingType: null,
      priceDisplay: null,
    });
  });

  it("test case D — $85/hour", () => {
    expect(resolvePricing({ pricingType: "hourly", amount: "85" })).toEqual({
      ok: true,
      pricingType: "hourly",
      priceDisplay: "$85 / hour",
    });
  });

  it("test case B — $600/day", () => {
    expect(resolvePricing({ pricingType: "daily", amount: "$600" })).toEqual({
      ok: true,
      pricingType: "daily",
      priceDisplay: "$600 / day",
    });
  });

  it("test case C — $175/project", () => {
    expect(resolvePricing({ pricingType: "project", amount: "175" })).toEqual({
      ok: true,
      pricingType: "project",
      priceDisplay: "$175 / project",
    });
  });

  it("free / contact carry no amount and no composed string", () => {
    expect(resolvePricing({ pricingType: "free" })).toEqual({
      ok: true,
      pricingType: "free",
      priceDisplay: null,
    });
    expect(resolvePricing({ pricingType: "contact" })).toEqual({
      ok: true,
      pricingType: "contact",
      priceDisplay: null,
    });
  });

  it("rejects an amount type with a missing or non-positive amount", () => {
    expect(resolvePricing({ pricingType: "hourly", amount: "" }).ok).toBe(false);
    expect(resolvePricing({ pricingType: "hourly", amount: "0" }).ok).toBe(false);
    expect(resolvePricing({ pricingType: "hourly", amount: "abc" }).ok).toBe(false);
  });

  it("rejects an unknown pricing type", () => {
    expect(resolvePricing({ pricingType: "weekly", amount: "5" }).ok).toBe(false);
  });
});
