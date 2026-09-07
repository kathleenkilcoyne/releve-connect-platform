import { beforeEach, describe, expect, it, vi } from "vitest";

// `redirect()` really does throw in Next.js to interrupt execution — the
// action's own validation (`if (!x) redirect(...)`, no explicit `return`,
// matching /welcome/team's existing convention) depends on that. Mocking it
// as a no-op here would silently let a failed-validation test fall through
// into the insert/send calls it's supposed to prevent, masking a real bug —
// so the mock throws too, exactly like the real thing.
const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { insert, from, createAdminClient } = vi.hoisted(() => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ insert }));
  return { insert, from, createAdminClient: vi.fn(() => ({ from })) };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const { sendTeamInterestAlert } = vi.hoisted(() => ({
  sendTeamInterestAlert: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications", () => ({ sendTeamInterestAlert }));

import { submitDanceTeamInterest } from "./actions";

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const VALID = {
  team_name: "Manhattan University Dance Team",
  coach_name: "Madeline Donohue",
  email: "coach@example.edu",
  team_level: "college",
};

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ error: null });
});

describe("submitDanceTeamInterest — the public, no-login doorway (2026-09-07)", () => {
  it("writes an anonymous row into the EXISTING team_interest table (user_id: null)", async () => {
    await expect(submitDanceTeamInterest(fd(VALID))).rejects.toThrow("NEXT_REDIRECT");

    expect(from).toHaveBeenCalledWith("team_interest");
    expect(insert).toHaveBeenCalledWith({
      user_id: null,
      team_name: "Manhattan University Dance Team",
      coach_name: "Madeline Donohue",
      email: "coach@example.edu",
      team_level: "college",
      message: null,
    });
  });

  it("uses the SAME sendTeamInterestAlert as /welcome/team — no second email system", async () => {
    await expect(
      submitDanceTeamInterest(fd({ ...VALID, message: "We run a competition program." })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(sendTeamInterestAlert).toHaveBeenCalledTimes(1);
    expect(sendTeamInterestAlert).toHaveBeenCalledWith({
      teamName: "Manhattan University Dance Team",
      schoolOrg: null,
      teamLevel: "college",
      coachName: "Madeline Donohue",
      email: "coach@example.edu",
      cityState: null,
      useCase: null,
      message: "We run a competition program.",
    });
  });

  it("redirects to ?sent=1 on success", async () => {
    await expect(submitDanceTeamInterest(fd(VALID))).rejects.toThrow(
      "NEXT_REDIRECT:/dance-teams?sent=1#interest",
    );
  });

  it.each([
    ["team_name", { ...VALID, team_name: "" }],
    ["coach_name", { ...VALID, coach_name: "" }],
    ["email", { ...VALID, email: "" }],
    ["team_level", { ...VALID, team_level: "" }],
  ])("refuses and writes NOTHING when %s is missing", async (_field, fields) => {
    await expect(submitDanceTeamInterest(fd(fields))).rejects.toThrow(
      "NEXT_REDIRECT:/dance-teams?error=1#interest",
    );
    expect(insert).not.toHaveBeenCalled();
    expect(sendTeamInterestAlert).not.toHaveBeenCalled();
  });

  // 2026-09-07: "Competition Team" added as a sixth team_level option, stored
  // value 'competition' (matching the widened DB check constraint exactly).
  it("accepts 'competition' as a valid team type and stores it verbatim", async () => {
    await expect(
      submitDanceTeamInterest(fd({ ...VALID, team_level: "competition" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dance-teams?sent=1#interest");

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ team_level: "competition" }));
    expect(sendTeamInterestAlert).toHaveBeenCalledWith(
      expect.objectContaining({ teamLevel: "competition" }),
    );
  });

  it("rejects a team_level outside the DB check constraint rather than writing an invalid row", async () => {
    await expect(
      submitDanceTeamInterest(fd({ ...VALID, team_level: "not-a-real-level" })),
    ).rejects.toThrow("NEXT_REDIRECT:/dance-teams?error=1#interest");
    expect(insert).not.toHaveBeenCalled();
  });

  it("trims whitespace and stores an empty optional message as null, not an empty string", async () => {
    await expect(
      submitDanceTeamInterest(fd({ ...VALID, team_name: "  Padded Name  ", message: "   " })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ team_name: "Padded Name", message: null }));
  });
});
