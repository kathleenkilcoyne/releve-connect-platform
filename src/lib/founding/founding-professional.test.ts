import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/email/send", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/send")>();
  return { ...actual, emailSiteUrl: () => "https://releveconnect.com" };
});

import {
  entitlementTerms,
  isEntitlementKind,
  entitlementLabel,
  normalizeEmail,
  foundingProfessionalInviteLink,
  recordInvitationSendAttempt,
  latestInvitationSends,
  authAccountStates,
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

describe("foundingProfessionalInviteLink — the canonical, code-generated link (2026-09-07)", () => {
  it("always points at /login?next=/profile/edit, never /apply", () => {
    const link = foundingProfessionalInviteLink("founder@example.com");
    expect(link).toBe("https://releveconnect.com/login?next=%2Fprofile%2Fedit&email=founder%40example.com");
    expect(link).not.toContain("/apply");
  });

  it("normalizes the email into the link (trim + lowercase), matching the claim lookup", () => {
    const link = foundingProfessionalInviteLink("  Founder@Example.COM ");
    expect(link).toContain("email=founder%40example.com");
  });
});

describe("recordInvitationSendAttempt + latestInvitationSends", () => {
  function fakeDb() {
    const inserted: Array<Record<string, unknown>> = [];
    const rows: Array<{
      grant_id: string;
      sent_at: string;
      status: string;
      provider_message_id: string | null;
      error_detail: string | null;
    }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = {
      from(table: string) {
        if (table !== "founding_professional_invitation_sends") throw new Error(`unexpected table "${table}"`);
        return {
          insert: async (row: Record<string, unknown>) => {
            inserted.push(row);
            rows.push({
              grant_id: row.grant_id as string,
              sent_at: new Date().toISOString(),
              status: row.status as string,
              provider_message_id: (row.provider_message_id as string) ?? null,
              error_detail: (row.error_detail as string) ?? null,
            });
            return { error: null };
          },
          select: () => ({
            in: (_col: string, ids: string[]) => ({
              order: async () => ({
                data: rows
                  .filter((r) => ids.includes(r.grant_id))
                  .sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1)),
                error: null,
              }),
            }),
          }),
        };
      },
    };
    return { db, inserted, rows };
  }

  it("logs a successful send with its message id", async () => {
    const { db, inserted } = fakeDb();
    await recordInvitationSendAttempt(db, {
      grantId: "g1",
      sentBy: "admin-1",
      recipientEmail: "Founder@Example.com",
      result: { sent: true, id: "msg-123" },
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      grant_id: "g1",
      sent_by: "admin-1",
      recipient_email: "founder@example.com", // normalized
      status: "sent",
      provider_message_id: "msg-123",
      error_detail: null,
    });
  });

  it("logs a failed send with its reason as the status and the detail preserved", async () => {
    const { db, inserted } = fakeDb();
    await recordInvitationSendAttempt(db, {
      grantId: "g1",
      sentBy: "admin-1",
      recipientEmail: "founder@example.com",
      result: { sent: false, reason: "rejected", detail: "HTTP 403" },
    });
    expect(inserted[0]).toMatchObject({
      status: "rejected",
      provider_message_id: null,
      error_detail: "HTTP 403",
    });
  });

  it("never throws even if the insert itself fails", async () => {
    const db = {
      from: () => ({
        insert: async () => ({ error: { message: "boom" } }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await expect(
      recordInvitationSendAttempt(db, {
        grantId: "g1",
        sentBy: null,
        recipientEmail: "founder@example.com",
        result: { sent: true, id: "x" },
      }),
    ).resolves.toBeUndefined();
  });

  it("latestInvitationSends returns only the newest row per grant", async () => {
    const { db } = fakeDb();
    await recordInvitationSendAttempt(db, {
      grantId: "g1",
      sentBy: null,
      recipientEmail: "founder@example.com",
      result: { sent: false, reason: "error", detail: "first try" },
    });
    await recordInvitationSendAttempt(db, {
      grantId: "g1",
      sentBy: null,
      recipientEmail: "founder@example.com",
      result: { sent: true, id: "msg-2" },
    });

    const out = await latestInvitationSends(db, ["g1"]);
    expect(out.get("g1")).toMatchObject({ status: "sent", providerMessageId: "msg-2" });
  });

  it("returns an empty map for an empty grant-id list without querying", async () => {
    const { db } = fakeDb();
    const out = await latestInvitationSends(db, []);
    expect(out.size).toBe(0);
  });
});

describe("authAccountStates", () => {
  it("matches Supabase Auth users by normalized email and reports first/last sign-in", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          { email: "Founder@Example.com", created_at: "2026-08-18T00:00:00Z", last_sign_in_at: "2026-08-19T00:00:00Z" },
          { email: "someone-else@example.com", created_at: "2026-01-01T00:00:00Z", last_sign_in_at: null },
        ],
      },
      error: null,
    });
    const db = { auth: { admin: { listUsers } } } as unknown as Parameters<typeof authAccountStates>[0];

    const out = await authAccountStates(db, ["founder@example.com", "unrelated@example.com"]);

    expect(out.get("founder@example.com")).toEqual({
      exists: true,
      createdAt: "2026-08-18T00:00:00Z",
      lastSignInAt: "2026-08-19T00:00:00Z",
    });
    expect(out.has("unrelated@example.com")).toBe(false); // no auth user for this one
    expect(out.has("someone-else@example.com")).toBe(false); // not in the requested set
  });

  it("returns an empty map for an empty email list without calling listUsers", async () => {
    const listUsers = vi.fn();
    const db = { auth: { admin: { listUsers } } } as unknown as Parameters<typeof authAccountStates>[0];
    const out = await authAccountStates(db, []);
    expect(out.size).toBe(0);
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("never throws if listUsers errors — returns an empty map", async () => {
    const listUsers = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const db = { auth: { admin: { listUsers } } } as unknown as Parameters<typeof authAccountStates>[0];
    const out = await authAccountStates(db, ["founder@example.com"]);
    expect(out.size).toBe(0);
  });
});
