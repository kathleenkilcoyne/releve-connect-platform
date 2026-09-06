import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendStudioLive } = vi.hoisted(() => ({
  sendStudioLive: vi.fn().mockResolvedValue({ sent: true, id: "test-message-id" }),
}));
vi.mock("@/lib/notifications", () => ({ sendStudioLive }));

import { resendStudioLiveEmail, type ResendLiveEmailProfile } from "./resend-live-email";

const LIVE_PROFILE: ResendLiveEmailProfile = {
  name: "Manhattan University Dance Team",
  status: "live",
  owner_user_id: "owner-1",
  public_slug: "manhattan-university-dance-team",
  org_type: "dance_team",
  member_label: "Dancers",
};

/** A db double with NO `.update`/`.insert`/`.delete` of any kind — if the
 *  function under test ever tried to mutate, this throws a TypeError, not a
 *  silently-ignored no-op. That's the structural proof of "cannot mutate,"
 *  independent of any behavioral assertion below. */
function readOnlyDb(email: string | null): Parameters<typeof resendStudioLiveEmail>[0] {
  return {
    from(table: "users") {
      if (table !== "users") throw new Error(`resend must only read "users", tried "${table}"`);
      return {
        select: (columns: "email") => {
          if (columns !== "email") throw new Error(`expected to select "email", got "${columns}"`);
          return {
            eq: (column: "user_id", value: string) => {
              if (column !== "user_id") throw new Error(`expected to filter by "user_id"`);
              return { maybeSingle: async () => ({ data: value ? { email } : null, error: null }) };
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof resendStudioLiveEmail>[0];
}

/** A db double that throws the instant anything is queried at all — for
 *  assertions that a rejection happens before any read. */
const dbThatMustNotBeQueried = {
  from(): never {
    throw new Error("resend must not query the database when it rejects before that point");
  },
} as unknown as Parameters<typeof resendStudioLiveEmail>[0];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_URL = "https://releveconnect.com";
});

describe("resendStudioLiveEmail — no mutation, live-only, admin-gated by its caller", () => {
  it("rejects an org that isn't live yet, without querying anything or emailing", async () => {
    const result = await resendStudioLiveEmail(dbThatMustNotBeQueried, {
      ...LIVE_PROFILE,
      status: "approved",
    });

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'Can only resend the live email for an org that is already live (this one is "approved").',
    });
    expect(sendStudioLive).not.toHaveBeenCalled();
  });

  it("rejects a live org with no owner account, without querying anything or emailing", async () => {
    const result = await resendStudioLiveEmail(dbThatMustNotBeQueried, {
      ...LIVE_PROFILE,
      owner_user_id: null,
    });

    expect(result).toEqual({ ok: false, status: 422, error: "This org has no owner account to email." });
    expect(sendStudioLive).not.toHaveBeenCalled();
  });

  it("rejects when the owner has no email on file, without emailing", async () => {
    const result = await resendStudioLiveEmail(readOnlyDb(null), LIVE_PROFILE);

    expect(result).toEqual({ ok: false, status: 422, error: "This org's owner has no email on file." });
    expect(sendStudioLive).not.toHaveBeenCalled();
  });

  it("Manhattan University Dance Team: resends the exact v2 copy via sendStudioLive, using a db with no write capability at all", async () => {
    const db = readOnlyDb("madeline@manhattan.edu");

    const result = await resendStudioLiveEmail(db, LIVE_PROFILE);

    expect(result).toEqual({ ok: true, messageId: "test-message-id" });
    expect(sendStudioLive).toHaveBeenCalledTimes(1);
    expect(sendStudioLive).toHaveBeenCalledWith({
      to: "madeline@manhattan.edu",
      studioName: "Manhattan University Dance Team",
      profileUrl: "https://releveconnect.com/studios/manhattan-university-dance-team",
      orgType: "dance_team",
      memberLabel: "Dancers",
    });
  });

  it("falls back to '/studios' when there is no public_slug (should not happen for a live org, handled anyway)", async () => {
    const db = readOnlyDb("owner@example.com");

    await resendStudioLiveEmail(db, { ...LIVE_PROFILE, public_slug: null });

    expect(sendStudioLive).toHaveBeenCalledWith(
      expect.objectContaining({ profileUrl: "https://releveconnect.com/studios" }),
    );
  });

  // ── 2026-09-06 diagnostic: the vendor result must actually be checked ──────
  // Before this fix, every one of these three would have returned `{ ok: true }`
  // — the same as the genuine success case above — because the SendResult was
  // discarded rather than inspected. This is the regression these tests guard.

  it("reports failure (never ok:true) when the email vendor is not configured", async () => {
    sendStudioLive.mockResolvedValueOnce({ sent: false, reason: "not_configured" });
    const db = readOnlyDb("madeline@manhattan.edu");

    const result = await resendStudioLiveEmail(db, LIVE_PROFILE);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect((result as { error: string }).error).toMatch(/not_configured/);
  });

  it("reports failure (never ok:true) when the email vendor rejects the send", async () => {
    sendStudioLive.mockResolvedValueOnce({
      sent: false,
      reason: "rejected",
      detail: "HTTP 401",
    });
    const db = readOnlyDb("madeline@manhattan.edu");

    const result = await resendStudioLiveEmail(db, LIVE_PROFILE);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect((result as { error: string }).error).toMatch(/rejected/);
    expect((result as { error: string }).error).toMatch(/HTTP 401/);
  });

  it("reports failure (never ok:true) on a network/send error", async () => {
    sendStudioLive.mockResolvedValueOnce({
      sent: false,
      reason: "error",
      detail: "fetch failed",
    });
    const db = readOnlyDb("madeline@manhattan.edu");

    const result = await resendStudioLiveEmail(db, LIVE_PROFILE);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect((result as { error: string }).error).toMatch(/error/);
    expect((result as { error: string }).error).toMatch(/fetch failed/);
  });
});
