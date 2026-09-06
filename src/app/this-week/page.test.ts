// "This Week" — the signed-in-but-nothing-to-show branch.
//
// Root cause this guards against: `payload.isEmpty && !payload.professional
// && !payload.family` used to fall straight to the fabricated sample week
// (mode="demo") for EVERY signed-in viewer with nothing scheduled — including
// a real studio owner / Team Director who simply hasn't built out their
// calendar yet. A live organisation must never be shown Kathleen's invented
// sample week under their own login.
//
// These tests exercise the REAL `ThisWeekPage` server component against a
// fake Supabase/admin boundary and a mocked `buildLiveWeek` — only the
// DB/auth edges are faked, same pattern as `app/apply/actions.test.ts`.
// `ThisWeekScreen` is mocked to a trivial passthrough so the returned React
// element's props can be asserted on directly, without needing a DOM/render
// environment this repo's test suite doesn't set up.

import { describe, it, expect, vi, beforeEach } from "vitest";

const USER = { id: "user-1" };

let currentUser: { id: string } | null = USER;
let resolveStudioForUserMock = vi.fn<(userId: string) => Promise<string | null>>();
let buildLiveWeekMock = vi.fn();
let employerRow: { name: string | null; org_type: string | null } | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "employer_profiles") throw new Error(`unexpected table ${table}`);
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: employerRow }),
      };
      return q;
    },
  }),
}));

vi.mock("@/lib/studio/access", () => ({
  resolveStudioForUser: (userId: string) => resolveStudioForUserMock(userId),
}));

vi.mock("@/lib/this-week/live", () => ({
  buildLiveWeek: (...args: unknown[]) => buildLiveWeekMock(...args),
}));

vi.mock("@/lib/this-week/daily-message", () => ({
  messageForDay: () => "You matter here.",
}));

vi.mock("@/lib/this-week/music", () => ({
  getCurrentTrack: async () => null,
}));

// Trivial passthrough — never rendered, only its `type`/`props` are inspected
// on the element `ThisWeekPage` returns, so it needs no real implementation
// (and importing the real client component would drag in next/navigation
// hooks and a CSS import this test's node environment has no reason to load).
vi.mock("@/components/this-week/ThisWeekScreen", () => ({
  ThisWeekScreen: () => null,
}));

const { default: ThisWeekPage } = await import("./page");

function render(searchParams: Record<string, string> = {}) {
  return ThisWeekPage({ searchParams: Promise.resolve(searchParams) }) as unknown as Promise<{
    props: Record<string, unknown>;
  }>;
}

const EMPTY_PAYLOAD = { professional: null, family: null, isEmpty: true };

beforeEach(() => {
  currentUser = USER;
  resolveStudioForUserMock = vi.fn(async () => null);
  buildLiveWeekMock = vi.fn(async () => EMPTY_PAYLOAD);
  employerRow = null;
});

describe("ThisWeekPage — signed-in, nothing to show", () => {
  it("signed out still gets the sample week (unaffected by this fix)", async () => {
    currentUser = null;
    const el = await render();
    expect(el.props.mode).toBe("demo");
    expect(buildLiveWeekMock).not.toHaveBeenCalled();
  });

  it("a signed-in member with no org, no professional week and no family week keeps the sample (existing demo behavior)", async () => {
    resolveStudioForUserMock = vi.fn(async () => null);
    const el = await render();
    expect(el.props.mode).toBe("demo");
    expect(el.props.orgHome).toBeUndefined();
  });

  it("a signed-in studio owner with an empty calendar NEVER gets the fabricated demo week", async () => {
    resolveStudioForUserMock = vi.fn(async () => "employer-1");
    employerRow = { name: "Bergen Ballet", org_type: "studio" };

    const el = await render();

    expect(el.props.mode).toBe("live");
    expect(el.props.orgHome).toEqual({ name: "Bergen Ballet", isTeam: false });
    // The real (empty) payload is still threaded through — no fabricated data.
    expect(el.props.payload).toBe(EMPTY_PAYLOAD);
  });

  it("a signed-in Team Director (dance_team org_type) never gets the fabricated demo week, and is labeled as a team", async () => {
    resolveStudioForUserMock = vi.fn(async () => "employer-2");
    employerRow = { name: "Manhattan University Dance Team", org_type: "dance_team" };

    const el = await render();

    expect(el.props.mode).toBe("live");
    expect(el.props.orgHome).toEqual({
      name: "Manhattan University Dance Team",
      isTeam: true,
    });
  });

  it("a studio staff admin (not the owner) is resolved the same way and also never sees demo data", async () => {
    // resolveStudioForUser itself covers owner-vs-staff; the page only needs
    // to trust whatever employer id it returns.
    resolveStudioForUserMock = vi.fn(async () => "employer-3");
    employerRow = { name: null, org_type: "studio" };

    const el = await render();

    expect(el.props.mode).toBe("live");
    // No name on the row yet — falls back to a generic, still-real label.
    expect(el.props.orgHome).toEqual({ name: "Your studio", isTeam: false });
  });

  it("an org owner who DOES have a professional or family week is unaffected (not the empty branch at all)", async () => {
    resolveStudioForUserMock = vi.fn(async () => "employer-4");
    buildLiveWeekMock = vi.fn(async () => ({
      professional: { viewer: {}, week: {}, events: [{ id: "e1" }], rollups: [] },
      family: null,
      isEmpty: false,
    }));

    const el = await render();

    expect(el.props.mode).toBe("live");
    expect(el.props.orgHome).toBeUndefined();
    // resolveOrgHome must not even be consulted off the normal render path.
    expect(resolveStudioForUserMock).not.toHaveBeenCalled();
  });
});
