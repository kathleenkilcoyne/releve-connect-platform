import { beforeEach, describe, expect, it, vi } from "vitest";

// Covers ONLY the new ATTACH-mode branch (body carries `employer_id`) — the
// pre-existing create-new-org / resend-by-email branch is untouched code and
// out of scope for this change.

const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin }));

const { sendStudioInvitation } = vi.hoisted(() => ({
  sendStudioInvitation: vi.fn().mockResolvedValue({ sent: true, id: "test" }),
}));
vi.mock("@/lib/notifications", () => ({ sendStudioInvitation }));

type Org = { employer_id: string; owner_user_id: string | null; org_type: string | null; member_label: string | null };
type Invite = { invite_id: string; employer_id: string; email: string; token: string; redeemed_by: string | null };

const {
  createAdminClient,
  setOrg,
  setInvites,
  getInvites,
  updateCalls,
  insertCalls,
} = vi.hoisted(() => {
  let org: Org | null = null;
  let invites: Invite[] = [];
  const updateCalls: Array<{ invite_id: string; patch: Record<string, unknown> }> = [];
  const insertCalls: Array<Record<string, unknown>> = [];

  const createAdminClient = vi.fn(() => ({
    from(table: string) {
      if (table === "employer_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: org, error: null }),
            }),
          }),
        };
      }
      if (table === "founding_studio_invites") {
        return {
          select: (_cols: string) => ({
            // .ilike("email", email).maybeSingle() — the cross-org email-collision check
            ilike: (_col: string, email: string) => ({
              maybeSingle: async () => {
                const hit = invites.find((i) => i.email.toLowerCase() === email.toLowerCase());
                return { data: hit ?? null, error: null };
              },
            }),
            // .eq("employer_id", id).maybeSingle() — the by-org existing-invite lookup
            eq: (_col: string, employerId: string) => ({
              maybeSingle: async () => {
                const hit = invites.find((i) => i.employer_id === employerId);
                return { data: hit ?? null, error: null };
              },
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, inviteId: string) => {
              updateCalls.push({ invite_id: inviteId, patch });
              const idx = invites.findIndex((i) => i.invite_id === inviteId);
              if (idx >= 0) invites[idx] = { ...invites[idx], ...(patch as Partial<Invite>) };
              return { error: null };
            },
          }),
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                insertCalls.push(row);
                const created: Invite = {
                  invite_id: "new-invite-1",
                  employer_id: row.employer_id as string,
                  email: row.email as string,
                  token: row.token as string,
                  redeemed_by: null,
                };
                invites.push(created);
                return { data: { invite_id: created.invite_id }, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table "${table}"`);
    },
  }));

  return {
    createAdminClient,
    setOrg: (o: Org | null) => (org = o),
    setInvites: (i: Invite[]) => (invites = i),
    getInvites: () => invites,
    updateCalls,
    insertCalls,
  };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { POST } from "./route";

function attachRequest(employerId: string, email: string) {
  return new Request("https://releveconnect.com/api/admin/studio-invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, employer_id: employerId }),
  });
}

const MANHATTAN: Org = {
  employer_id: "manhattan-1",
  owner_user_id: null,
  org_type: "dance_team",
  member_label: "Dancers",
};

beforeEach(() => {
  vi.clearAllMocks();
  updateCalls.length = 0;
  insertCalls.length = 0;
  requireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
  process.env.NEXT_PUBLIC_SITE_URL = "https://releveconnect.com";
});

describe("POST /api/admin/studio-invites — attach mode (employer_id in body)", () => {
  it("creates the missing invite for an existing, unclaimed org — never a second org", async () => {
    setOrg(MANHATTAN);
    setInvites([]);

    const res = await POST(attachRequest("manhattan-1", "madeline@manhattan.edu"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.resent).toBe(false);
    expect(data.employer_id).toBe("manhattan-1"); // the EXISTING org, not a new one
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({ employer_id: "manhattan-1", email: "madeline@manhattan.edu" });

    // Copy is read from the ORG's own org_type/member_label, never re-guessed.
    expect(sendStudioInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ orgType: "dance_team", memberLabel: "Dancers", to: "madeline@manhattan.edu" }),
    );
  });

  it("redirects an existing unclaimed invite to a new email and regenerates the token", async () => {
    setOrg(MANHATTAN);
    setInvites([
      { invite_id: "inv-1", employer_id: "manhattan-1", email: "placeholder@example.com", token: "old-token", redeemed_by: null },
    ]);

    const res = await POST(attachRequest("manhattan-1", "madeline@manhattan.edu"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.resent).toBe(true);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].invite_id).toBe("inv-1");
    expect(updateCalls[0].patch.email).toBe("madeline@manhattan.edu");
    expect(updateCalls[0].patch.token).not.toBe("old-token");
    expect(insertCalls).toHaveLength(0); // never a second row for the same org
  });

  it("refuses when the org already has an owner", async () => {
    setOrg({ ...MANHATTAN, owner_user_id: "already-bound-user" });
    setInvites([]);

    const res = await POST(attachRequest("manhattan-1", "madeline@manhattan.edu"));
    expect(res.status).toBe(409);
    expect(sendStudioInvitation).not.toHaveBeenCalled();
  });

  it("refuses when the target email is already invited to a DIFFERENT org", async () => {
    setOrg(MANHATTAN);
    setInvites([
      { invite_id: "inv-2", employer_id: "some-other-org", email: "madeline@manhattan.edu", token: "t", redeemed_by: null },
    ]);

    const res = await POST(attachRequest("manhattan-1", "madeline@manhattan.edu"));
    expect(res.status).toBe(409);
    expect(sendStudioInvitation).not.toHaveBeenCalled();
    expect(updateCalls).toHaveLength(0);
  });

  it("refuses (defensively) when the org's existing invite is already marked claimed", async () => {
    setOrg(MANHATTAN); // owner_user_id null, but the invite disagrees — inconsistent state
    setInvites([
      { invite_id: "inv-3", employer_id: "manhattan-1", email: "old@manhattan.edu", token: "t", redeemed_by: "someone" },
    ]);

    const res = await POST(attachRequest("manhattan-1", "madeline@manhattan.edu"));
    expect(res.status).toBe(409);
    expect(sendStudioInvitation).not.toHaveBeenCalled();
  });

  it("404s when the org id doesn't exist", async () => {
    setOrg(null);
    setInvites([]);

    const res = await POST(attachRequest("no-such-org", "madeline@manhattan.edu"));
    expect(res.status).toBe(404);
    expect(sendStudioInvitation).not.toHaveBeenCalled();
  });
});
