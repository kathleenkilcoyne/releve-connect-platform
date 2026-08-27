import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { saveProfile } from "./actions";

// Everything currently `is_active = true` in role_types on production, queried
// live during the audit that found this class of bug on the application form.
const LIVE_ACTIVE_ROLE_SLUGS = [
  "teacher",
  "choreographer",
  "studio_owner",
  "dancer",
  "yoga_instructor",
  "lighting_designer",
];

/** A no-op join-table stub: delete succeeds, insert succeeds. Enough for any
 * tag facet the test doesn't submit values for (replaceJoin returns right
 * after the delete when there's nothing to insert). */
function noopJoinTable() {
  return {
    delete: () => ({ eq: async () => ({ error: null }) }),
    insert: async () => ({ error: null }),
  };
}

/** role_types serves two different query shapes in saveProfile: the live
 * active-slug validation, and replaceJoin's slug->id lookup for profile_roles. */
function roleTypesTable(activeRoleSlugs: string[]) {
  return {
    select: (cols: string) => {
      if (cols === "slug") {
        return { eq: async () => ({ data: activeRoleSlugs.map((slug) => ({ slug })), error: null }) };
      }
      return {
        in: async (_col: string, slugs: string[]) => ({
          data: activeRoleSlugs.filter((s) => slugs.includes(s)).map((slug) => ({ id: `role-id-${slug}`, slug })),
          error: null,
        }),
      };
    },
  };
}

type ExistingProfile = {
  profile_id: string;
  public_slug: string;
  headshot_url: string | null;
  gallery_urls: string[];
  resume_url: string | null;
} | null;

/**
 * The cookie-based (RLS) client, covering exactly the calls saveProfile makes
 * for the UPDATE path — editing a profile that already exists.
 */
function makeSupabaseMockForUpdate(opts: {
  activeRoleSlugs?: string[];
  existingProfile?: ExistingProfile;
  updateSpy?: (row: Record<string, unknown>) => void;
}) {
  const activeRoleSlugs = opts.activeRoleSlugs ?? LIVE_ACTIVE_ROLE_SLUGS;
  const existingProfile: ExistingProfile =
    opts.existingProfile ??
    { profile_id: "profile-1", public_slug: "jamie-rivera", headshot_url: null, gallery_urls: [], resume_url: null };

  const from = vi.fn((table: string) => {
    if (table === "role_types") return roleTypesTable(activeRoleSlugs);
    if (table === "users") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        upsert: async () => ({ data: null, error: null }),
      };
    }
    if (table === "talent_profiles") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: existingProfile, error: null }) }),
        }),
        update: (row: Record<string, unknown>) => {
          opts.updateSpy?.(row);
          return { eq: async () => ({ error: null }) };
        },
      };
    }
    if (
      table === "profile_roles" ||
      table === "profile_styles" ||
      table === "profile_levels" ||
      table === "profile_focus_areas" ||
      table === "profile_certifications"
    ) {
      return noopJoinTable();
    }
    throw new Error(`Unexpected table in test (cookie client, update path): ${table}`);
  });

  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "pro@example.com" } } }) },
    from,
  };
}

/** The cookie-based client for the CREATE path — no profile exists yet. */
function makeSupabaseMockForCreate(opts: {
  activeRoleSlugs?: string[];
  newProfileId?: string;
  insertSpy?: (row: Record<string, unknown>) => void;
}) {
  const activeRoleSlugs = opts.activeRoleSlugs ?? LIVE_ACTIVE_ROLE_SLUGS;
  const newProfileId = opts.newProfileId ?? "new-profile-1";

  const from = vi.fn((table: string) => {
    if (table === "role_types") return roleTypesTable(activeRoleSlugs);
    if (table === "users") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        upsert: async () => ({ data: null, error: null }),
      };
    }
    if (table === "talent_profiles") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        insert: (row: Record<string, unknown>) => {
          opts.insertSpy?.(row);
          return { select: () => ({ single: async () => ({ data: { profile_id: newProfileId }, error: null }) }) };
        },
      };
    }
    if (
      table === "profile_roles" ||
      table === "profile_styles" ||
      table === "profile_levels" ||
      table === "profile_focus_areas" ||
      table === "profile_certifications"
    ) {
      return noopJoinTable();
    }
    throw new Error(`Unexpected table in test (cookie client, create path): ${table}`);
  });

  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-2", email: "new-pro@example.com" } } }) },
    from,
  };
}

/** The admin (service-role) client — the slug-collision check every save
 * does, plus (create path only) the applications / founding-grant lookups. */
function makeAdminMock(opts?: { isCreatePath?: boolean }) {
  const from = vi.fn((table: string) => {
    if (table === "talent_profiles") {
      return { select: () => ({ or: async () => ({ data: [], error: null }) }) };
    }
    if (opts?.isCreatePath && table === "applications") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
            }),
          }),
        }),
      };
    }
    if (opts?.isCreatePath && table === "founding_professional_grants") {
      return { select: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
    }
    throw new Error(`Unexpected table in test (admin client): ${table}`);
  });
  return { from, storage: { from: vi.fn() } };
}

function formDataFor(fields: Record<string, string>, roles: string[]) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (const r of roles) fd.append("roles", r);
  return fd;
}

const BASE_FIELDS = { display_name: "Jamie Rivera" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveProfile — role validation and saving against live role_types", () => {
  it("regression: a single-role profile (Teacher) still saves successfully", async () => {
    createClient.mockResolvedValue(makeSupabaseMockForUpdate({}));
    createAdminClient.mockReturnValue(makeAdminMock());

    const result = await saveProfile(
      { ok: false, message: "" },
      formDataFor(BASE_FIELDS, ["teacher"]),
    );

    expect(result.ok).toBe(true);
  });

  it("a multi-role profile saves ALL submitted active roles, not just one — primary_role is preserved as a display designation", async () => {
    const updateSpy = vi.fn();
    createClient.mockResolvedValue(makeSupabaseMockForUpdate({ updateSpy }));
    createAdminClient.mockReturnValue(makeAdminMock());

    const result = await saveProfile(
      { ok: false, message: "" },
      formDataFor({ ...BASE_FIELDS, primary_role: "teacher" }, ["teacher", "choreographer", "yoga_instructor"]),
    );

    expect(result.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ primary_role: "teacher" }));
  });

  it("a newly-approved professional building a multi-role profile for the first time saves all of them", async () => {
    const insertSpy = vi.fn();
    createClient.mockResolvedValue(makeSupabaseMockForCreate({ insertSpy }));
    createAdminClient.mockReturnValue(makeAdminMock({ isCreatePath: true }));

    const result = await saveProfile(
      { ok: false, message: "" },
      formDataFor({ ...BASE_FIELDS, primary_role: "choreographer" }, ["choreographer", "lighting_designer"]),
    );

    expect(result.ok).toBe(true);
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ primary_role: "choreographer" }));
  });

  it("an invited professional (also routed through the create path) can build a multi-role profile the same way", async () => {
    const insertSpy = vi.fn();
    createClient.mockResolvedValue(makeSupabaseMockForCreate({ insertSpy }));
    createAdminClient.mockReturnValue(makeAdminMock({ isCreatePath: true }));

    const result = await saveProfile(
      { ok: false, message: "" },
      formDataFor({ ...BASE_FIELDS, primary_role: "teacher" }, ["teacher", "dancer"]),
    );

    expect(result.ok).toBe(true);
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ primary_role: "teacher" }));
  });

  it("a retired role (working_dancer) cannot be newly selected — rejected even if a stale client submits it alone", async () => {
    createClient.mockResolvedValue(makeSupabaseMockForUpdate({}));
    createAdminClient.mockReturnValue(makeAdminMock());

    const result = await saveProfile(
      { ok: false, message: "" },
      formDataFor(BASE_FIELDS, ["working_dancer"]),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/select at least one professional role/i);
  });

  it("a mixed submission keeps the active role and drops the retired one", async () => {
    createClient.mockResolvedValue(makeSupabaseMockForUpdate({}));
    createAdminClient.mockReturnValue(makeAdminMock());

    const result = await saveProfile(
      { ok: false, message: "" },
      formDataFor(BASE_FIELDS, ["teacher", "working_dancer"]),
    );

    expect(result.ok).toBe(true);
  });

  it("rejects a save with zero valid roles, with a clear message", async () => {
    createClient.mockResolvedValue(makeSupabaseMockForUpdate({}));
    createAdminClient.mockReturnValue(makeAdminMock());

    const result = await saveProfile({ ok: false, message: "" }, formDataFor(BASE_FIELDS, []));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/select at least one professional role/i);
  });

  it("falls back to the first checked role when primary_role isn't one of the submitted roles", async () => {
    const updateSpy = vi.fn();
    createClient.mockResolvedValue(makeSupabaseMockForUpdate({ updateSpy }));
    createAdminClient.mockReturnValue(makeAdminMock());

    const result = await saveProfile(
      { ok: false, message: "" },
      formDataFor({ ...BASE_FIELDS, primary_role: "studio_owner" }, ["teacher", "yoga_instructor"]),
    );

    expect(result.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ primary_role: "teacher" }));
  });

  it("a stale client still POSTing the removed 'availability' field is harmless — save still succeeds", async () => {
    createClient.mockResolvedValue(makeSupabaseMockForUpdate({}));
    createAdminClient.mockReturnValue(makeAdminMock());

    const fd = formDataFor(BASE_FIELDS, ["teacher"]);
    fd.append("availability", "weekends");

    const result = await saveProfile({ ok: false, message: "" }, fd);
    expect(result.ok).toBe(true);
  });
});
