import { describe, it, expect, vi, beforeEach } from "vitest";

// submitApplication's role list used to be validated against a hardcoded
// VALID_ROLES array that only knew about the original 4 roles. Every role
// added to role_types since then (2026-08-19 through 2026-08-21 — 13 of
// them) was selectable on the /apply form but silently dropped on submit.
// The fix reads active role_types live, the same source of truth the form
// itself queries to render the checkboxes. These tests run the REAL
// submitApplication against a fake database — only the DB/auth/email
// boundaries are mocked.

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
const inserts: Record<string, Row[]> = {};
const upserts: Record<string, Row[]> = {};

const USER = { id: "user-1", email: "zz-applicant@example.com" };

function fakeDb() {
  return {
    auth: { getUser: async () => ({ data: { user: USER } }) },
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const q = {
        select: () => q,
        order: () => q,
        eq: (c: string, v: unknown) => {
          rows = rows.filter((r) => r[c] === v);
          return q;
        },
        not: () => q,
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () => ({ data: rows[0] ?? null, error: null }),
        upsert: (payload: Row) => {
          upserts[table] = [...(upserts[table] ?? []), payload];
          return { then: (res: (v: unknown) => void) => res({ data: payload, error: null }) };
        },
        insert: (payload: Row | Row[]) => {
          const list = Array.isArray(payload) ? payload : [payload];
          inserts[table] = [...(inserts[table] ?? []), ...list];
          const ins = {
            select: () => ins,
            single: async () => ({ data: { application_id: "app-new" }, error: null }),
            then: (res: (v: unknown) => void) => res({ data: list, error: null }),
          };
          return ins;
        },
        update: (payload: Row) => {
          const upd = {
            eq: () => upd,
            then: (res: (v: unknown) => void) => res({ data: payload, error: null }),
          };
          return upd;
        },
        then: (res: (v: unknown) => void) => res({ data: rows, error: null }),
      };
      return q;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeDb() }));
vi.mock("@/lib/notifications", () => ({
  sendApplicationReceived: vi.fn(async () => {}),
  sendAdminNewApplicationAlert: vi.fn(async () => {}),
}));

const { submitApplication } = await import("./actions");

// Mirrors the live role_types table: the original 4 (working_dancer now
// soft-retired, is_active = false) plus a sample of roles added since.
const ROLE_TYPES: Row[] = [
  { slug: "teacher", is_active: true },
  { slug: "studio_owner", is_active: true },
  { slug: "choreographer", is_active: true },
  { slug: "working_dancer", is_active: false },
  { slug: "dancer", is_active: true },
  { slug: "audition_coach", is_active: true },
  { slug: "college_university_faculty", is_active: true },
];

function baseFormData(overrides: Record<string, string | string[]> = {}) {
  const fd = new FormData();
  fd.set("first_name", "Zz");
  fd.set("last_name", "Applicant");
  fd.set("story_bio", "A little about my journey.");
  for (const c of [
    "terms",
    "privacy",
    "media_release",
    "contact",
    "review_understanding",
    "code_of_conduct",
  ]) {
    fd.set(`consent_${c}`, "on");
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (Array.isArray(v)) {
      for (const item of v) fd.append(k, item);
    } else {
      fd.set(k, v);
    }
  }
  return fd;
}

beforeEach(() => {
  tables = { role_types: ROLE_TYPES, users: [], applications: [] };
  for (const k of Object.keys(inserts)) delete inserts[k];
  for (const k of Object.keys(upserts)) delete upserts[k];
});

describe("submitApplication — role validation reads role_types live", () => {
  it("accepts a role added long after the old hardcoded list (audition_coach)", async () => {
    const fd = baseFormData({ roles: ["audition_coach"], primary_role: "audition_coach" });
    const result = await submitApplication({ ok: false, message: "" }, fd);

    expect(result.ok).toBe(true);
    expect(inserts.applications).toHaveLength(1);
    expect(inserts.applications[0].roles).toEqual(["audition_coach"]);
  });

  it("accepts another newly-added role (college_university_faculty) alongside an original role", async () => {
    const fd = baseFormData({
      roles: ["teacher", "college_university_faculty"],
      primary_role: "teacher",
    });
    const result = await submitApplication({ ok: false, message: "" }, fd);

    expect(result.ok).toBe(true);
    expect(inserts.applications[0].roles).toEqual(["teacher", "college_university_faculty"]);
  });

  it("still accepts the surviving original roles (teacher, studio_owner, choreographer)", async () => {
    const fd = baseFormData({
      roles: ["teacher", "studio_owner", "choreographer"],
      primary_role: "teacher",
    });
    const result = await submitApplication({ ok: false, message: "" }, fd);

    expect(result.ok).toBe(true);
    expect(inserts.applications[0].roles).toEqual(["teacher", "studio_owner", "choreographer"]);
  });

  it("filters out a soft-retired role (working_dancer) rather than reviving it", async () => {
    const fd = baseFormData({
      roles: ["teacher", "working_dancer"],
      primary_role: "teacher",
    });
    const result = await submitApplication({ ok: false, message: "" }, fd);

    expect(result.ok).toBe(true);
    expect(inserts.applications[0].roles).toEqual(["teacher"]);
  });

  it("filters out a role slug that doesn't exist in role_types at all (tampering/defense)", async () => {
    const fd = baseFormData({
      roles: ["teacher", "not_a_real_role"],
      primary_role: "teacher",
    });
    const result = await submitApplication({ ok: false, message: "" }, fd);

    expect(result.ok).toBe(true);
    expect(inserts.applications[0].roles).toEqual(["teacher"]);
  });

  it("rejects the submission when every submitted role is invalid", async () => {
    const fd = baseFormData({ roles: ["not_a_real_role"], primary_role: "not_a_real_role" });
    const result = await submitApplication({ ok: false, message: "" }, fd);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/how you're joining/i);
    expect(inserts.applications).toBeUndefined();
  });

  it("still branches the role-specific answer sections for a newly-added role's original co-role", async () => {
    // audition_coach has no dedicated section (like the original 4 do), so it
    // should ride along in `roles` without ever populating teaching/choreographer/etc.
    const fd = baseFormData({
      roles: ["choreographer", "audition_coach"],
      primary_role: "choreographer",
    });
    await submitApplication({ ok: false, message: "" }, fd);

    const saved = inserts.applications[0] as { answers: Record<string, unknown> };
    expect(saved.answers.choreographer).not.toBeNull();
    expect(saved.answers.teaching).toBeNull();
    expect(saved.answers.working_dancer).toBeNull();
  });
});
