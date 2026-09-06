import { beforeEach, describe, expect, it, vi } from "vitest";

// This file tests the `resend_live_email` action in full, plus (2026-09-06
// diagnostic) the one new behavior added to `publish`: surfacing the welcome
// email's send result instead of discarding it. Everything else about
// approve/publish/unpublish/set_details is pre-existing, untested, and out of
// scope for this change.

const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin }));

const { sendStudioLive } = vi.hoisted(() => ({
  sendStudioLive: vi.fn().mockResolvedValue({ sent: true, id: "test-message-id" }),
}));
vi.mock("@/lib/notifications", () => ({ sendStudioLive }));

const { createAdminClient, updateSpy, setProfile } = vi.hoisted(() => {
  let profile: Record<string, unknown> | null = null;
  const updateSpy = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

  const createAdminClient = vi.fn(() => ({
    from(table: string) {
      if (table === "employer_profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () =>
                profile ? { data: profile, error: null } : { data: null, error: { message: "not found" } },
            }),
          }),
          // Present (unlike the pure-function test's db double) so we can
          // assert it is never CALLED for this action — proof at the route's
          // own db handle, in addition to the structural proof in
          // resend-live-email.test.ts.
          update: updateSpy,
        };
      }
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { email: "madeline@manhattan.edu" }, error: null }),
            }),
          }),
        };
      }
      // founding_studio_invites (or anything else) should never be touched by
      // this action — surface it loudly if it ever is.
      throw new Error(`resend_live_email must not touch table "${table}"`);
    },
  }));

  return { createAdminClient, updateSpy, setProfile: (p: Record<string, unknown> | null) => (profile = p) };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { PATCH } from "./route";

function patchRequest(action: string) {
  return new Request("https://releveconnect.com/api/admin/studios/emp-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}
const ctx = { params: Promise.resolve({ id: "emp-1" }) };

const MANHATTAN_ROW = {
  employer_id: "emp-1",
  name: "Manhattan University Dance Team",
  status: "live",
  owner_user_id: "owner-1",
  public_slug: "manhattan-university-dance-team",
  org_type: "dance_team",
  member_label: "Dancers",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_URL = "https://releveconnect.com";
  setProfile(MANHATTAN_ROW);
});

describe("PATCH /api/admin/studios/[id] — resend_live_email authorization", () => {
  it("a denied admin gate blocks the action before the database is ever touched", async () => {
    requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Admins only." }), { status: 403 }),
    });

    const res = await PATCH(patchRequest("resend_live_email"), ctx);

    expect(res.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(sendStudioLive).not.toHaveBeenCalled();
  });

  it("an unauthenticated caller (401 from requireAdmin) is blocked the same way", async () => {
    requireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Sign in as an admin to do that." }), { status: 401 }),
    });

    const res = await PATCH(patchRequest("resend_live_email"), ctx);

    expect(res.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(sendStudioLive).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/studios/[id] — resend_live_email behavior (admin authorized)", () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
  });

  it("rejects an org that is not live yet, and never calls sendStudioLive or update", async () => {
    setProfile({ ...MANHATTAN_ROW, status: "approved" });

    const res = await PATCH(patchRequest("resend_live_email"), ctx);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toMatch(/already live/i);
    expect(sendStudioLive).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("Manhattan University Dance Team: resends the v2 email and calls update zero times", async () => {
    const res = await PATCH(patchRequest("resend_live_email"), ctx);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, message_id: "test-message-id" });
    expect(sendStudioLive).toHaveBeenCalledTimes(1);
    expect(sendStudioLive).toHaveBeenCalledWith({
      to: "madeline@manhattan.edu",
      studioName: "Manhattan University Dance Team",
      profileUrl: "https://releveconnect.com/studios/manhattan-university-dance-team",
      orgType: "dance_team",
      memberLabel: "Dancers",
    });
    // The proof that matters most to this change: no write of any kind
    // happened on employer_profiles (or anywhere else — the mock throws if
    // any other table is touched) while resending the email.
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejects an unknown action the same way it always has", async () => {
    const res = await PATCH(patchRequest("not_a_real_action"), ctx);
    expect(res.status).toBe(400);
    expect(sendStudioLive).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // ── 2026-09-06 diagnostic: the route must NOT report success when the vendor
  // didn't confirm the send. This is the exact incident this fix closes — the
  // admin UI said "resent" while Resend's own log showed nothing for it.
  it("never returns 200/ok:true when the email vendor is not configured", async () => {
    sendStudioLive.mockResolvedValueOnce({ sent: false, reason: "not_configured" });

    const res = await PATCH(patchRequest("resend_live_email"), ctx);
    const data = await res.json();

    expect(res.status).not.toBe(200);
    expect(data.ok).not.toBe(true);
    expect(data.error).toMatch(/not_configured/);
  });

  it("never returns 200/ok:true when the email vendor rejects the send", async () => {
    sendStudioLive.mockResolvedValueOnce({ sent: false, reason: "rejected", detail: "HTTP 401" });

    const res = await PATCH(patchRequest("resend_live_email"), ctx);
    const data = await res.json();

    expect(res.status).not.toBe(200);
    expect(data.ok).not.toBe(true);
    expect(data.error).toMatch(/rejected/);
  });

  it("never returns 200/ok:true on a network/send error", async () => {
    sendStudioLive.mockResolvedValueOnce({ sent: false, reason: "error", detail: "fetch failed" });

    const res = await PATCH(patchRequest("resend_live_email"), ctx);
    const data = await res.json();

    expect(res.status).not.toBe(200);
    expect(data.ok).not.toBe(true);
    expect(data.error).toMatch(/error/);
  });
});

describe("PATCH /api/admin/studios/[id] — publish surfaces the welcome-email result", () => {
  // A dedicated, minimal admin-client double for just this action: the profile
  // is already approved (so `transition` succeeds) and already has a
  // public_slug (so the slug-minting branch is never exercised — out of scope
  // here). Covers exactly the tables `publish` actually touches.
  function publishDb() {
    return {
      from(table: string) {
        if (table === "employer_profiles") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { ...MANHATTAN_ROW, status: "approved" },
                  error: null,
                }),
              }),
            }),
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        if (table === "founding_studio_invites") {
          return { update: () => ({ eq: async () => ({ error: null }) }) };
        }
        if (table === "users") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { email: "madeline@manhattan.edu" }, error: null }),
              }),
            }),
          };
        }
        throw new Error(`publish must not touch table "${table}" in this test`);
      },
    };
  }

  beforeEach(() => {
    requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
  });

  it("publish still succeeds, and reports welcome_email_sent: true, on a normal successful send", async () => {
    createAdminClient.mockReturnValueOnce(publishDb() as unknown as ReturnType<typeof createAdminClient>);

    const res = await PATCH(patchRequest("publish"), ctx);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toMatchObject({ ok: true, status: "live", welcome_email_sent: true });
  });

  it("publish still succeeds (the transition is never rolled back), but reports welcome_email_sent: false when the vendor doesn't confirm — never silently discarded", async () => {
    sendStudioLive.mockResolvedValueOnce({ sent: false, reason: "not_configured" });
    createAdminClient.mockReturnValueOnce(publishDb() as unknown as ReturnType<typeof createAdminClient>);

    const res = await PATCH(patchRequest("publish"), ctx);
    const data = await res.json();

    // The org IS live — a failed welcome email must never undo a real publish.
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.status).toBe("live");
    // But the failure is surfaced, not swallowed into an indistinguishable "ok".
    expect(data.welcome_email_sent).toBe(false);
  });
});
