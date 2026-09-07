import { beforeEach, describe, expect, it, vi } from "vitest";

// Covers the 2026-09-07 autosend addition to grant creation. The pre-existing
// grantFoundingProfessional() logic itself is unit-tested separately
// (founding-professional.test.ts) — this file is about what the ROUTE does
// with the flag and the send result, not the grant mechanics.

const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin }));

const { sendFoundingProfessionalInvitation } = vi.hoisted(() => ({
  sendFoundingProfessionalInvitation: vi.fn(),
}));
vi.mock("@/lib/notifications", () => ({ sendFoundingProfessionalInvitation }));

const { grantFoundingProfessional, recordInvitationSendAttempt, recordedSends } = vi.hoisted(() => ({
  grantFoundingProfessional: vi.fn(),
  recordInvitationSendAttempt: vi.fn(),
  recordedSends: [] as unknown[],
}));
vi.mock("@/lib/founding/founding-professional", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/founding/founding-professional")>();
  return {
    ...actual,
    grantFoundingProfessional,
    recordInvitationSendAttempt: (...args: unknown[]) => {
      recordedSends.push(args);
      return recordInvitationSendAttempt(...args);
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://releveconnect.com/api/admin/founding-professionals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  recordedSends.length = 0;
  requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
  grantFoundingProfessional.mockResolvedValue({ ok: true, grantId: "grant-1", materialized: false });
  delete process.env.FOUNDING_PROFESSIONAL_AUTOSEND_ENABLED;
});

describe("POST /api/admin/founding-professionals — autosend OFF (default)", () => {
  it("creates the grant, sends NO email, and logs NOTHING", async () => {
    const res = await POST(req({ email: "founder@example.com", entitlement_kind: "permanent" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({ ok: true, grantId: "grant-1", autosend_enabled: false, invitation_sent: null });
    expect(sendFoundingProfessionalInvitation).not.toHaveBeenCalled();
    expect(recordedSends).toHaveLength(0);
  });
});

describe("POST /api/admin/founding-professionals — autosend ON", () => {
  beforeEach(() => {
    process.env.FOUNDING_PROFESSIONAL_AUTOSEND_ENABLED = "true";
  });

  it("sends the invitation via the code-generated link and logs a successful attempt", async () => {
    sendFoundingProfessionalInvitation.mockResolvedValue({ sent: true, id: "msg-1" });

    const res = await POST(req({ email: "founder@example.com", entitlement_kind: "permanent" }));
    const data = await res.json();

    expect(sendFoundingProfessionalInvitation).toHaveBeenCalledTimes(1);
    const [sendArgs] = sendFoundingProfessionalInvitation.mock.calls[0];
    expect(sendArgs.to).toBe("founder@example.com");
    expect(sendArgs.inviteLink).toContain("/login?next=%2Fprofile%2Fedit&email=founder%40example.com");
    expect(sendArgs.inviteLink).not.toContain("/apply");

    expect(recordedSends).toHaveLength(1);
    expect(data).toMatchObject({ ok: true, autosend_enabled: true, invitation_sent: true });
  });

  it("still creates the grant and reports invitation_sent:false if the vendor rejects it — never fails the whole request", async () => {
    sendFoundingProfessionalInvitation.mockResolvedValue({ sent: false, reason: "rejected", detail: "HTTP 403" });

    const res = await POST(req({ email: "founder@example.com", entitlement_kind: "permanent" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({ ok: true, invitation_sent: false });
    expect(recordedSends).toHaveLength(1);
  });

  it("does not attempt a send at all if the grant itself failed", async () => {
    grantFoundingProfessional.mockResolvedValue({ ok: false, error: "That email already has an active Founding Professional grant." });

    const res = await POST(req({ email: "founder@example.com", entitlement_kind: "permanent" }));

    expect(res.status).toBe(409);
    expect(sendFoundingProfessionalInvitation).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/founding-professionals — auth/validation, unchanged", () => {
  it("rejects an unauthenticated request before touching the grant or email logic", async () => {
    requireAdmin.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const res = await POST(req({ email: "founder@example.com", entitlement_kind: "permanent" }));
    expect(res.status).toBe(401);
    expect(grantFoundingProfessional).not.toHaveBeenCalled();
  });
});
