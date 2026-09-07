import { beforeEach, describe, expect, it, vi } from "vitest";

// Covers the new `resend_invitation` action (2026-09-07) plus a smoke check
// that the pre-existing change_entitlement/revoke branches are untouched.

const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin }));

const { sendFoundingProfessionalInvitation } = vi.hoisted(() => ({
  sendFoundingProfessionalInvitation: vi.fn(),
}));
vi.mock("@/lib/notifications", () => ({ sendFoundingProfessionalInvitation }));

type Grant = { id: string; email: string; claimed_at: string | null; revoked_at: string | null; user_id: string | null };

const { changeEntitlement, revokeFoundingProfessional, recordInvitationSendAttempt, recordedSends } = vi.hoisted(
  () => ({
    changeEntitlement: vi.fn().mockResolvedValue({ ok: true }),
    revokeFoundingProfessional: vi.fn().mockResolvedValue({ ok: true }),
    recordInvitationSendAttempt: vi.fn(),
    recordedSends: [] as unknown[],
  }),
);

vi.mock("@/lib/founding/founding-professional", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/founding/founding-professional")>();
  return {
    ...actual,
    changeEntitlement,
    revokeFoundingProfessional,
    recordInvitationSendAttempt: (...args: unknown[]) => {
      recordedSends.push(args);
      return recordInvitationSendAttempt(...args);
    },
  };
});

let currentGrant: Grant | null = null;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table !== "founding_professional_grants") throw new Error(`unexpected table "${table}"`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: currentGrant, error: null }),
          }),
        }),
      };
    },
  })),
}));

import { PATCH } from "./route";

function req(body: unknown) {
  return new Request("https://releveconnect.com/api/admin/founding-professionals/grant-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "grant-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  recordedSends.length = 0;
  requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
  currentGrant = { id: "grant-1", email: "founder@example.com", claimed_at: null, revoked_at: null, user_id: null };
  delete process.env.FOUNDING_PROFESSIONAL_AUTOSEND_ENABLED;
});

describe("PATCH .../[id] — resend_invitation", () => {
  it("refuses when autosend is disabled, with a clear message pointing at copy-link", async () => {
    const res = await PATCH(req({ action: "resend_invitation" }), ctx);
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toMatch(/disabled/i);
    expect(sendFoundingProfessionalInvitation).not.toHaveBeenCalled();
  });

  describe("with autosend enabled", () => {
    beforeEach(() => {
      process.env.FOUNDING_PROFESSIONAL_AUTOSEND_ENABLED = "true";
    });

    it("resends via the code-generated link and logs the attempt", async () => {
      sendFoundingProfessionalInvitation.mockResolvedValue({ sent: true, id: "msg-9" });

      const res = await PATCH(req({ action: "resend_invitation" }), ctx);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toMatchObject({ ok: true, action: "resend_invitation", message_id: "msg-9" });
      const [sendArgs] = sendFoundingProfessionalInvitation.mock.calls[0];
      expect(sendArgs.to).toBe("founder@example.com");
      expect(sendArgs.inviteLink).not.toContain("/apply");
      expect(recordedSends).toHaveLength(1);
    });

    it("refuses to resend an already-claimed grant", async () => {
      currentGrant = { ...currentGrant!, claimed_at: "2026-08-18T00:00:00Z" };
      const res = await PATCH(req({ action: "resend_invitation" }), ctx);
      expect(res.status).toBe(409);
      expect(sendFoundingProfessionalInvitation).not.toHaveBeenCalled();
    });

    it("refuses to resend a revoked grant", async () => {
      currentGrant = { ...currentGrant!, revoked_at: "2026-08-20T00:00:00Z" };
      const res = await PATCH(req({ action: "resend_invitation" }), ctx);
      expect(res.status).toBe(409);
      expect(sendFoundingProfessionalInvitation).not.toHaveBeenCalled();
    });

    it("404s for a nonexistent grant", async () => {
      currentGrant = null;
      const res = await PATCH(req({ action: "resend_invitation" }), ctx);
      expect(res.status).toBe(404);
    });

    it("surfaces a 502 with the vendor's reason when the send fails, and still logs it", async () => {
      sendFoundingProfessionalInvitation.mockResolvedValue({ sent: false, reason: "rejected", detail: "HTTP 403" });
      const res = await PATCH(req({ action: "resend_invitation" }), ctx);
      const data = await res.json();
      expect(res.status).toBe(502);
      expect(data.error).toMatch(/rejected/);
      expect(recordedSends).toHaveLength(1);
    });
  });
});

describe("PATCH .../[id] — pre-existing actions are untouched", () => {
  it("change_entitlement still works exactly as before", async () => {
    const res = await PATCH(req({ action: "change_entitlement", entitlement_kind: "comp_12mo" }), ctx);
    expect(res.status).toBe(200);
    expect(changeEntitlement).toHaveBeenCalledWith(expect.anything(), "grant-1", "comp_12mo");
  });

  it("revoke still works exactly as before", async () => {
    const res = await PATCH(req({ action: "revoke" }), ctx);
    expect(res.status).toBe(200);
    expect(revokeFoundingProfessional).toHaveBeenCalledWith(expect.anything(), "grant-1", "admin-1");
  });

  it("an unknown action still 400s with the (now updated) list of valid actions", async () => {
    const res = await PATCH(req({ action: "nonsense" }), ctx);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("resend_invitation");
  });
});
