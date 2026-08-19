// Professional Services — ADMIN surface tests.
//
// What these pin: the admin console is an ALLOWLIST, not a spread. Adding a
// column to professional_services must never silently surface it to a reviewer.
//
// On contact fields specifically (founder decision, 2026-08-15): the admin
// projection shows business_email / business_phone ONLY when the member ticked
// the matching "show this on my public profile" box. `show_*` means the same
// thing on every surface — a detail the member kept private is private from the
// reviewer too. The admin still sees more than the public in the ways that
// matter for review: hidden services, and the moderation state.

import { describe, it, expect } from "vitest";
import { toAdminService, ADMIN_SERVICE_KEYS } from "./admin";
import { toPublicService, type ServiceRow } from "./services";

/** A row with BOTH contact fields set and BOTH display toggles OFF. */
function privateContactRow(over: Partial<ServiceRow> = {}): ServiceRow {
  return {
    id: "svc-1",
    category: "massage_therapy",
    category_other_label: null,
    business_name: "McAree Bodywork",
    short_description: "Sports Massage",
    location: "New York",
    service_type: "mobile",
    website_url: "https://example.com",
    social_url: "https://instagram.com/example",
    business_email: "private@example.com",
    business_phone: "(212) 555-0134",
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
    ...over,
  };
}

describe("toAdminService — the allowlist", () => {
  it("emits exactly the documented keys and nothing else", () => {
    const out = toAdminService(privateContactRow());
    expect(Object.keys(out).sort()).toEqual([...ADMIN_SERVICE_KEYS].sort());
  });

  it("does not leak a NEW column added to the row", () => {
    // Simulates a future migration adding something sensitive. A spread-based
    // projection would carry it straight into the console; an allowlist cannot.
    const withNewColumn = {
      ...privateContactRow(),
      internal_risk_note: "should never reach the console",
      stripe_account_id: "acct_123",
    } as unknown as ServiceRow;

    const out = toAdminService(withNewColumn);
    expect(JSON.stringify(out)).not.toContain("should never reach the console");
    expect(JSON.stringify(out)).not.toContain("acct_123");
    expect(Object.keys(out).sort()).toEqual([...ADMIN_SERVICE_KEYS].sort());
  });

  it("never carries raw enum values the console shouldn't print", () => {
    const out = toAdminService(privateContactRow({ category: "other", category_other_label: "Dance Medicine" }));
    // Category is resolved to a human label, not the stored slug.
    expect(out.category).toBe("Dance Medicine");
    expect(JSON.stringify(out)).not.toContain("massage_therapy");
  });

  it("reports display state without exposing the raw status column", () => {
    expect(toAdminService(privateContactRow({ status: "active" })).shown_publicly).toBe(true);
    expect(toAdminService(privateContactRow({ status: "hidden" })).shown_publicly).toBe(false);
    expect(toAdminService(privateContactRow())).not.toHaveProperty("status");
  });

  it("surfaces a hidden service to the reviewer", () => {
    // A member can hide a service from the public; the reviewer still sees it.
    const out = toAdminService(privateContactRow({ status: "hidden" }));
    expect(out.business_name).toBe("McAree Bodywork");
    expect(out.shown_publicly).toBe(false);
  });

  it("carries the moderation seam through", () => {
    expect(toAdminService(privateContactRow({ moderation_status: "flagged" })).moderation_status).toBe(
      "flagged",
    );
  });
});

describe("contact fields — show_* means the same thing everywhere", () => {
  it("ADMIN: withholds contact details the member kept private", () => {
    const out = toAdminService(privateContactRow());
    expect(out.business_email).toBeNull();
    expect(out.business_phone).toBeNull();
  });

  it("PUBLIC: the very same row exposes neither", () => {
    const pub = toPublicService(privateContactRow());
    expect(pub.business_email).toBeNull();
    expect(pub.business_phone).toBeNull();
  });

  it("ADMIN: shows only what the member opted into, field by field", () => {
    const emailOnly = toAdminService(privateContactRow({ show_email: true }));
    expect(emailOnly.business_email).toBe("private@example.com");
    expect(emailOnly.business_phone).toBeNull();

    const phoneOnly = toAdminService(privateContactRow({ show_phone: true }));
    expect(phoneOnly.business_email).toBeNull();
    expect(phoneOnly.business_phone).toBe("(212) 555-0134");
  });

  it("PUBLIC: exposes only what the member opted into, field by field", () => {
    const emailOnly = toPublicService(privateContactRow({ show_email: true }));
    expect(emailOnly.business_email).toBe("private@example.com");
    expect(emailOnly.business_phone).toBeNull();

    const phoneOnly = toPublicService(privateContactRow({ show_phone: true }));
    expect(phoneOnly.business_email).toBeNull();
    expect(phoneOnly.business_phone).toBe("(212) 555-0134");
  });

  it("the two projections now AGREE on every contact field", () => {
    // The property that would break first if someone re-widened the admin view.
    for (const over of [
      {},
      { show_email: true },
      { show_phone: true },
      { show_email: true, show_phone: true },
    ] as const) {
      const row = privateContactRow(over);
      const admin = toAdminService(row);
      const pub = toPublicService(row);
      expect(admin.business_email).toBe(pub.business_email);
      expect(admin.business_phone).toBe(pub.business_phone);
    }
  });

  it("the admin still sees what review actually needs: hidden services and moderation state", () => {
    const row = privateContactRow({ status: "hidden", moderation_status: "flagged" });
    const admin = toAdminService(row);
    expect(admin.business_name).toBe("McAree Bodywork");
    expect(admin.shown_publicly).toBe(false);
    expect(admin.moderation_status).toBe("flagged");
  });
});
