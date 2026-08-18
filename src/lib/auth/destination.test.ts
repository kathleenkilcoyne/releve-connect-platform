import { describe, it, expect, vi, beforeEach } from "vitest";

// Post-sign-in routing, with the REAL activation service running against a fake
// database. Only the environment is mocked (cookies, the admin client factory,
// org lookup, the founding claim) — the eligibility rules themselves are the
// genuine ones from @/lib/profile/activate, so these tests fail if the Profile V2
// gate is ever loosened.

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
const inserts: Record<string, Row[]> = {};

function fakeDb() {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const q = {
        select: () => q,
        order: () => q,
        eq: (c: string, v: unknown) => {
          rows = rows.filter((r) => r[c] === v);
          return q;
        },
        is: (c: string, v: unknown) => {
          rows = rows.filter((r) => (v === null ? r[c] == null : r[c] === v));
          return q;
        },
        in: (c: string, v: unknown[]) => {
          rows = rows.filter((r) => v.includes(r[c]));
          return q;
        },
        limit: (n: number) => {
          rows = rows.slice(0, n);
          return q;
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () => ({ data: rows[0] ?? null, error: null }),
        insert: (payload: Row | Row[]) => {
          const list = Array.isArray(payload) ? payload : [payload];
          inserts[table] = [...(inserts[table] ?? []), ...list];
          // Reflect the insert so a later read in the same run sees it.
          tables[table] = [...(tables[table] ?? []), ...list];
          const ins = {
            select: () => ins,
            single: async () => ({
              data: { profile_id: "new-profile", public_slug: "zz-slug" },
              error: null,
            }),
            then: (res: (v: unknown) => void) => res({ data: list, error: null }),
          };
          return ins;
        },
        then: (res: (v: unknown) => void) => res({ data: rows, error: null }),
      };
      return q;
    },
  };
}

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeDb() }));
vi.mock("@/lib/studio/access", () => ({ resolveStudioForUser: async () => null }));
vi.mock("@/lib/founding/founding-professional", () => ({
  claimFoundingProfessionalOnSignIn: async () => {},
}));

const { resolveSignedInDestination } = await import("./destination");

const USER = "user-1";
const supabaseStub = {
  auth: { getUser: async () => ({ data: { user: { id: USER, email: "zz@example.com" } } }) },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const go = () => resolveSignedInDestination(supabaseStub, null);

const baseTables = (): Record<string, Row[]> => ({
  users: [{ user_id: USER, email: "zz@example.com", account_type: "talent", display_name: "ZZ" }],
  talent_profiles: [],
  applications: [],
  memberships: [],
  founding_professional_grants: [],
  family_accounts: [],
  guardianships: [],
  styles: [],
  levels: [],
  focus_areas: [],
  role_types: [],
  open_to_badges: [],
});

const approvedApp = {
  user_id: USER,
  application_id: "app-1",
  state: "approved",
  honorifics: [],
  approved_tier: null,
  answers: { identity: { first_name: "ZZ" }, story: { bio: "Hello." } },
};
const activeMembership = { user_id: USER, tier: "professional", membership_status: "active" };

beforeEach(() => {
  tables = baseTables();
  for (const k of Object.keys(inserts)) delete inserts[k];
});

describe("post-sign-in routing — the /welcome misrouting and its fix", () => {
  it("approved + active + NO profile → activates and lands on the review screen", () => {
    // The bug found in the browser test: this person used to land on /welcome,
    // the cold-user gateway, having already applied, been accepted, and paid.
    tables.applications = [approvedApp];
    tables.memberships = [activeMembership];

    return go().then((dest) => {
      expect(dest).toBe("/profile/review");
      // Activation really ran — a profile row was created as a DRAFT.
      expect(inserts.talent_profiles).toHaveLength(1);
      expect(inserts.talent_profiles[0].profile_status).toBe("draft");
    });
  });

  it("an applicant still in review is NOT activated and is not given a profile", async () => {
    tables.applications = [{ ...approvedApp, state: "in-review" }];
    tables.memberships = [activeMembership];

    expect(await go()).toBe("/welcome");
    expect(inserts.talent_profiles).toBeUndefined();
  });

  it("an active membership WITHOUT approval creates no professional profile", async () => {
    // Paying does not make someone a Relevé Professional.
    tables.memberships = [activeMembership];

    expect(await go()).toBe("/welcome");
    expect(inserts.talent_profiles).toBeUndefined();
  });

  it("approved but NOT activated creates nothing — approval alone is insufficient", async () => {
    tables.applications = [approvedApp];

    expect(await go()).toBe("/welcome");
    expect(inserts.talent_profiles).toBeUndefined();
  });

  it("a Live Pass holder is not activated", async () => {
    tables.applications = [approvedApp];
    tables.memberships = [{ user_id: USER, tier: "live_pass", membership_status: "active" }];

    expect(await go()).toBe("/welcome");
    expect(inserts.talent_profiles).toBeUndefined();
  });

  it("an existing DRAFT profile goes straight to review without re-activating", async () => {
    tables.talent_profiles = [
      { user_id: USER, profile_id: "p1", profile_status: "draft" },
    ];

    expect(await go()).toBe("/profile/review");
    expect(inserts.talent_profiles).toBeUndefined();
  });

  it("an existing PUBLISHED profile keeps the normal professional destination", async () => {
    tables.talent_profiles = [
      { user_id: USER, profile_id: "p1", profile_status: "published" },
    ];

    expect(await go()).toBe("/profile/edit");
    expect(inserts.talent_profiles).toBeUndefined();
  });

  it("a true cold user still reaches the onboarding gateway", async () => {
    expect(await go()).toBe("/welcome");
    expect(inserts.talent_profiles).toBeUndefined();
  });

  it("an invited Founding Professional with a comp membership activates too", async () => {
    // They never applied, so the approved-application branch cannot help them —
    // the grant is their basis.
    tables.memberships = [activeMembership];
    tables.founding_professional_grants = [
      { id: "g1", email: "zz@example.com", revoked_at: null },
    ];

    expect(await go()).toBe("/profile/review");
    expect(inserts.talent_profiles?.[0].founder_distinction).toBe("founding_professional");
    expect(inserts.talent_profiles?.[0].profile_status).toBe("draft");
  });
});

describe("existing precedence is unchanged", () => {
  it("an admin still goes to the vetting queue", async () => {
    tables.users = [{ user_id: USER, email: "zz@example.com", account_type: "admin" }];
    tables.applications = [approvedApp];
    tables.memberships = [activeMembership];

    expect(await go()).toBe("/admin/applications");
    expect(inserts.talent_profiles).toBeUndefined();
  });

  it("a family guardian still goes to This Week, and is not activated on the way", async () => {
    // The activation attempt sits AFTER the family check on purpose, so this
    // person's routing and query cost are untouched.
    tables.guardianships = [{ guardian_user_id: USER, student_id: "s1" }];
    tables.applications = [approvedApp];
    tables.memberships = [activeMembership];

    expect(await go()).toBe("/this-week");
    expect(inserts.talent_profiles).toBeUndefined();
  });

  it("an explicit ?next= is still honoured above everything", async () => {
    expect(await resolveSignedInDestination(supabaseStub, "/roster")).toBe("/roster");
  });

  it("a chosen onboarding intent still routes to that flow", async () => {
    tables.users = [
      { user_id: USER, email: "zz@example.com", account_type: "talent", onboarding_intent: "studio" },
    ];
    expect(await go()).toBe("/studios/join");
  });
});

describe("there is only ONE profile-creation path", () => {
  it("destination.ts calls the shared activation service, not its own insert", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/lib/auth/destination.ts"), "utf8");
    expect(src).toContain("activateProfessionalProfile(admin, user.id)");
    expect(src).not.toContain("talent_profiles\").insert");
    expect(src).not.toContain("verification_flag");
  });
});
