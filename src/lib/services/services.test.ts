// Professional Services — unit tests for the pure layer.
//
// The two things that MUST NOT break here are the ones a member would never
// forgive: a private phone number appearing on a public page, and a link that
// executes something instead of going to a website. Both are covered below,
// alongside the button rules the founder specified.

import { describe, it, expect } from "vitest";
import {
  validateService,
  deriveServiceCta,
  cardImageHref,
  toPublicService,
  isPubliclyVisible,
  normalizeUrl,
  sanitizeText,
  sanitizePhone,
  categoryLabel,
  locationLine,
  rateLine,
  SERVICE_LIMITS,
  type ServiceRow,
} from "./services";

// A minimal valid input, so each test can vary exactly one thing.
function base() {
  return {
    category: "massage_therapy",
    businessName: "McAree Bodywork",
    shortDescription: "Sports Massage - Recovery - Dancer Wellness",
  };
}

describe("validateService", () => {
  it("accepts a minimal service", () => {
    const r = validateService(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.businessName).toBe("McAree Bodywork");
      expect(r.value.category).toBe("massage_therapy");
      expect(r.value.status).toBe("active"); // displayed by default
    }
  });

  it("requires a category and a business name", () => {
    const r = validateService({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const fields = r.errors.map((e) => e.field);
      expect(fields).toContain("category");
      expect(fields).toContain("businessName");
    }
  });

  it("rejects an unknown category", () => {
    const r = validateService({ ...base(), category: "astrology" });
    expect(r.ok).toBe(false);
  });

  it("bounds the description", () => {
    const r = validateService({
      ...base(),
      shortDescription: "x".repeat(SERVICE_LIMITS.descriptionMax + 1),
    });
    expect(r.ok).toBe(false);
  });

  it("keeps the member's own words for an Other category", () => {
    const r = validateService({
      ...base(),
      category: "other",
      categoryOtherLabel: "Dance Medicine Consulting",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.categoryOtherLabel).toBe("Dance Medicine Consulting");
  });

  it("drops an Other label when the category is not Other", () => {
    const r = validateService({ ...base(), categoryOtherLabel: "Ignore me" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.categoryOtherLabel).toBeNull();
  });

  // ---- Safety -------------------------------------------------------------

  it("strips markup from member-entered text", () => {
    const r = validateService({
      ...base(),
      businessName: "Bodywork<script>alert(1)</script>",
      shortDescription: "Recovery <iframe src='evil'></iframe> work",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.businessName).not.toContain("<");
      expect(r.value.shortDescription).not.toContain("<");
    }
  });

  it("rejects a javascript: link instead of coercing it to https", () => {
    const r = validateService({ ...base(), websiteUrl: "javascript:alert(1)" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field)).toContain("websiteUrl");
  });

  it("rejects a data: link", () => {
    const r = validateService({ ...base(), socialUrl: "data:text/html;base64,PHNjcmlwdD4=" });
    expect(r.ok).toBe(false);
  });

  it("upgrades a bare domain to https", () => {
    const r = validateService({ ...base(), websiteUrl: "mcareebodywork.com" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.websiteUrl).toBe("https://mcareebodywork.com");
  });

  it("rejects an invalid email", () => {
    const r = validateService({ ...base(), businessEmail: "not-an-email" });
    expect(r.ok).toBe(false);
  });

  // ---- Contact privacy ----------------------------------------------------

  it("stores contact details without publishing them by default", () => {
    const r = validateService({
      ...base(),
      businessEmail: "hello@mcareebodywork.com",
      businessPhone: "(212) 555-0134",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.businessEmail).toBe("hello@mcareebodywork.com");
      expect(r.value.businessPhone).toBe("(212) 555-0134");
      expect(r.value.showEmail).toBe(false);
      expect(r.value.showPhone).toBe(false);
    }
  });

  it("publishes contact details only when the member opts in", () => {
    const r = validateService({
      ...base(),
      businessEmail: "hello@mcareebodywork.com",
      showEmail: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.showEmail).toBe(true);
  });

  it("cannot turn on a display toggle with nothing to display", () => {
    const r = validateService({ ...base(), showEmail: true, showPhone: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.showEmail).toBe(false);
      expect(r.value.showPhone).toBe(false);
    }
  });

  // ---- Accompanist branch -------------------------------------------------

  it("keeps accompanist fields for an accompanist", () => {
    const r = validateService({
      ...base(),
      category: "accompanist",
      businessName: "Class Piano with Sam",
      instrument: "piano",
      accompanistFor: ["ballet", "modern", "auditions"],
      rateDisplay: "$60 / class",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.instrument).toBe("piano");
      expect(r.value.accompanistFor).toEqual(["ballet", "modern", "auditions"]);
      expect(r.value.rateDisplay).toBe("$60 / class");
    }
  });

  it("ignores accompanist fields for a non-accompanist category", () => {
    const r = validateService({
      ...base(),
      instrument: "piano",
      accompanistFor: ["ballet"],
      rateDisplay: "$60",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.instrument).toBeNull();
      expect(r.value.accompanistFor).toEqual([]);
      expect(r.value.rateDisplay).toBeNull();
    }
  });

  it("drops unknown accompanist-for values rather than failing the save", () => {
    const r = validateService({
      ...base(),
      category: "accompanist",
      accompanistFor: ["ballet", "tap-dancing-on-the-moon"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.accompanistFor).toEqual(["ballet"]);
  });

  it("lets Contact-for-rate win over a typed amount", () => {
    const r = validateService({
      ...base(),
      category: "accompanist",
      rateDisplay: "$60",
      rateContact: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.rateContact).toBe(true);
      expect(r.value.rateDisplay).toBeNull();
    }
  });
});

describe("deriveServiceCta", () => {
  // Bookings happen ON Relevé (2026-08-15). There is no external booking path.
  it("offers Book on Relevé, disabled, until the booking rail is live", () => {
    const cta = deriveServiceCta({ bookingEnabled: true, websiteUrl: "https://example.com" });
    expect(cta).toEqual({ action: "releve_booking", label: "Book on Relevé", enabled: false });
  });

  it("enables Book on Relevé once the rail is live", () => {
    const cta = deriveServiceCta({ bookingEnabled: true, bookingLive: true });
    expect(cta).toEqual({ action: "releve_booking", label: "Book on Relevé", enabled: true });
  });

  it("never labels an outbound link as Book, even with a stored override", () => {
    const cta = deriveServiceCta({ ctaLabel: "book", websiteUrl: "https://example.com" });
    expect(cta).toEqual({
      action: "link",
      label: "Visit Website",
      href: "https://example.com",
    });
  });

  it("falls back to Visit Website", () => {
    const cta = deriveServiceCta({ websiteUrl: "https://example.com" });
    expect(cta.action).toBe("link");
    if (cta.action === "link") expect(cta.label).toBe("Visit Website");
  });

  it("falls back to Contact when only published contact info exists", () => {
    const cta = deriveServiceCta({ businessEmail: "a@b.com", showEmail: true });
    expect(cta).toEqual({ action: "contact", label: "Contact", href: "mailto:a@b.com" });
  });

  it("never links contact info the member kept private", () => {
    const cta = deriveServiceCta({ businessEmail: "a@b.com", businessPhone: "212-555-0134" });
    expect(cta.action).toBe("none");
  });

  it("uses the phone only when the phone is the published one", () => {
    const cta = deriveServiceCta({ businessPhone: "(212) 555-0134", showPhone: true });
    expect(cta).toEqual({ action: "contact", label: "Contact", href: "tel:2125550134" });
  });

  it("renders no button when there is nothing to point at", () => {
    expect(deriveServiceCta({}).action).toBe("none");
  });

  it("lets a label override change the words but not the destination", () => {
    const cta = deriveServiceCta({ ctaLabel: "learn_more", websiteUrl: "https://example.com" });
    expect(cta).toEqual({
      action: "link",
      label: "Learn More",
      href: "https://example.com",
    });
  });
});

describe("cardImageHref", () => {
  it("links the business card to the website", () => {
    expect(cardImageHref({ websiteUrl: "https://w.com" })).toBe("https://w.com");
  });

  it("leaves the card unclickable when there is no destination", () => {
    expect(cardImageHref({})).toBeNull();
  });
});

describe("public projection", () => {
  const row: ServiceRow = {
    id: "1",
    category: "massage_therapy",
    category_other_label: null,
    business_name: "McAree Bodywork",
    short_description: null,
    location: "New York",
    service_type: "mobile",
    website_url: null,
    social_url: null,
    business_email: "private@example.com",
    business_phone: "212-555-0134",
    show_email: false,
    show_phone: false,
    image_url: null,
    cta_label: null,
    instrument: null,
    instrument_other: null,
    accompanist_for: [],
    rate_display: null,
    rate_contact: false,
    media_url: null,
    status: "active",
    moderation_status: "ok",
    sort_order: 0,
  };

  it("withholds contact details the member did not publish", () => {
    const pub = toPublicService(row);
    expect(pub.business_email).toBeNull();
    expect(pub.business_phone).toBeNull();
  });

  it("passes through contact details the member did publish", () => {
    const pub = toPublicService({ ...row, show_email: true });
    expect(pub.business_email).toBe("private@example.com");
    expect(pub.business_phone).toBeNull();
  });

  it("hides a service that is not displayed or has been moderated away", () => {
    expect(isPubliclyVisible(row)).toBe(true);
    expect(isPubliclyVisible({ ...row, status: "hidden" })).toBe(false);
    expect(isPubliclyVisible({ ...row, moderation_status: "removed" })).toBe(false);
    // 'flagged' is a note to the founder, not a takedown.
    expect(isPubliclyVisible({ ...row, moderation_status: "flagged" })).toBe(true);
  });
});

describe("display helpers", () => {
  it("shows the member's own words for an Other category", () => {
    expect(categoryLabel("other", "Dance Medicine")).toBe("Dance Medicine");
    expect(categoryLabel("other", null)).toBe("Other professional service");
    expect(categoryLabel("pilates")).toBe("Pilates");
  });

  it("builds the location line", () => {
    expect(locationLine("New York", "mobile")).toBe("New York / Mobile");
    expect(locationLine("New York", null)).toBe("New York");
    expect(locationLine(null, null)).toBeNull();
  });

  it("builds the rate line", () => {
    expect(rateLine({ rateDisplay: "$60 / class" })).toBe("$60 / class");
    expect(rateLine({ rateContact: true })).toBe("Contact for rate");
    expect(rateLine({})).toBeNull();
  });
});

describe("primitives", () => {
  it("normalizeUrl", () => {
    expect(normalizeUrl("https://a.com")).toBe("https://a.com");
    expect(normalizeUrl("a.com")).toBe("https://a.com");
    expect(normalizeUrl("  ")).toBeNull();
    expect(normalizeUrl("ftp://a.com")).toBeNull();
  });

  it("sanitizeText leaves ordinary prose alone", () => {
    expect(sanitizeText("  Sports Massage - Recovery  ")).toBe("Sports Massage - Recovery");
  });

  it("sanitizePhone keeps only phone-shaped characters", () => {
    expect(sanitizePhone("(212) 555-0134 x12")).toBe("(212) 555-0134 x12");
    expect(sanitizePhone("<b>212</b>")).toBe("212");
    expect(sanitizePhone("abc")).toBeNull();
  });
});
