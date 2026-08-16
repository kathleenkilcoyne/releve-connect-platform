// Professional Services — ADMIN surface tests.
//
// What these pin: the admin console is an ALLOWLIST, not a spread. Adding a
// column to professional_services must never silently surface it to a reviewer.
//
// On contact fields specifically: the admin projection DOES carry
// business_email / business_phone regardless of the member's show_* toggles.
// That is deliberate and admin-only (the console is gated on
// users.account_type = 'admin'; a signed-in non-admin gets a 404), because
// reviewing an application means reading what the member actually wrote. These
// tests assert that rule explicitly rather than leaving it implied — and assert,
// alongside it, that the PUBLIC projection of the same row never carries them.
// If the rule should change so that admins also respect show_*, these are the
// tests that will fail and say so.

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

describe("contact fields — admin-only allowance", () => {
  it("ADMIN: sees contact details even when the member kept them private", () => {
    // Deliberate and admin-gated. If this ever needs to respect show_*, change
    // toAdminService and this test together.
    const out = toAdminService(privateContactRow());
    expect(out.business_email).toBe("private@example.com");
    expect(out.business_phone).toBe("(212) 555-0134");
  });

  it("PUBLIC: the very same row exposes neither", () => {
    const pub = toPublicService(privateContactRow());
    expect(pub.business_email).toBeNull();
    expect(pub.business_phone).toBeNull();
  });

  it("PUBLIC: exposes only what the member opted into, field by field", () => {
    const emailOnly = toPublicService(privateContactRow({ show_email: true }));
    expect(emailOnly.business_email).toBe("private@example.com");
    expect(emailOnly.business_phone).toBeNull();

    const phoneOnly = toPublicService(privateContactRow({ show_phone: true }));
    expect(phoneOnly.business_email).toBeNull();
    expect(phoneOnly.business_phone).toBe("(212) 555-0134");
  });

  it("the two projections disagree ONLY about contact fields", () => {
    // Guards against a future edit that quietly widens the public projection to
    // match the admin one.
    const row = privateContactRow();
    const admin = toAdminService(row);
    const pub = toPublicService(row);
    expect(admin.business_email).not.toBe(pub.business_email);
    expect(pub.business_email).toBeNull();
    expect(pub.business_phone).toBeNull();
  });
});
