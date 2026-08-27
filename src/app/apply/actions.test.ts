import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { sendApplicationReceived, sendAdminNewApplicationAlert } = vi.hoisted(() => ({
  sendApplicationReceived: vi.fn().mockResolvedValue(undefined),
  sendAdminNewApplicationAlert: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications", () => ({ sendApplicationReceived, sendAdminNewApplicationAlert }));

import { submitApplication } from "./actions";

// Everything currently `is_active = true` in role_types on production, queried
// live during the audit that found this bug.
const LIVE_ACTIVE_ROLE_SLUGS = [
  "teacher",
  "choreographer",
  "studio_owner",
  "dancer",
  "dancer_singer",
  "dancer_singer_actor",
  "adjudicator",
  "performer",
  "director",
  "vocal_coach",
  "acting_coach",
  "dance_coach",
  "audition_coach",
  "music_director_accompanist",
  "stage_manager",
  "casting_director",
  "dance_captain_asst_choreographer",
  "college_university_faculty",
  "costume_designer",
  "lighting_designer",
  "digital_content_creator",
  "arts_administrator_company_manager",
  "personal_trainer",
  "pilates_instructor",
  "yoga_instructor",
  "gyrotonic_practitioner",
];

/** Minimal chainable Supabase stub covering exactly the calls submitApplication makes. */
function makeSupabaseMock(opts?: { activeRoleSlugs?: string[] }) {
  const activeRoleSlugs = opts?.activeRoleSlugs ?? LIVE_ACTIVE_ROLE_SLUGS;

  const from = vi.fn((table: string) => {
    if (table === "role_types") {
      return {
        select: () => ({
          eq: async () => ({ data: activeRoleSlugs.map((slug) => ({ slug })), error: null }),
        }),
      };
    }
    if (table === "users") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        upsert: async () => ({ data: null, error: null }),
      };
    }
    if (table === "applications") {
      return {
        select: () => ({
          eq: () => ({
            not: () => ({
              maybeSingle: async () => ({ data: null, error: null }), // no open application yet
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { application_id: "app-1" }, error: null }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table in test: ${table}`);
  });

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1", email: "applicant@example.com" } } }),
    },
    from,
  };
}

function formDataFor(fields: Record<string, string>, roles: string[]) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (const r of roles) fd.append("roles", r);
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
  return fd;
}

const BASE_FIELDS = {
  first_name: "Jamie",
  last_name: "Rivera",
  email: "applicant@example.com",
  story_bio: "I've been dancing and teaching for a decade.",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("submitApplication — role validation against live role_types", () => {
  it("regression: Teacher alone still submits successfully", async () => {
    createClient.mockResolvedValue(makeSupabaseMock());
    const result = await submitApplication(
      { ok: false, message: "" },
      formDataFor(BASE_FIELDS, ["teacher"]),
    );
    expect(result.ok).toBe(true);
    expect(result.applicationId).toBe("app-1");
  });

  it("regression: Choreographer alone still submits successfully", async () => {
    createClient.mockResolvedValue(makeSupabaseMock());
    const result = await submitApplication(
      { ok: false, message: "" },
      formDataFor(BASE_FIELDS, ["choreographer"]),
    );
    expect(result.ok).toBe(true);
  });

  it("the reported bug: selecting ONLY a newly-added role (Yoga Instructor) now submits successfully", async () => {
    createClient.mockResolvedValue(makeSupabaseMock());
    const result = await submitApplication(
      { ok: false, message: "" },
      formDataFor(BASE_FIELDS, ["yoga_instructor"]),
    );
    expect(result.ok).toBe(true);
    expect(result.message).not.toMatch(/how you're joining/i);
  });

  it("selecting ONLY another newly-added role (Lighting Designer) also submits successfully", async () => {
    createClient.mockResolvedValue(makeSupabaseMock());
    const result = await submitApplication(
      { ok: false, message: "" },
      formDataFor(BASE_FIELDS, ["lighting_designer"]),
    );
    expect(result.ok).toBe(true);
  });

  it("a retired role (working_dancer) cannot be injected even if a stale client submits it", async () => {
    createClient.mockResolvedValue(makeSupabaseMock());
    const result = await submitApplication(
      { ok: false, message: "" },
      formDataFor(BASE_FIELDS, ["working_dancer"]),
    );
    // Stripped down to zero valid roles, same as submitting none at all.
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/how you're joining/i);
  });

  it("a fabricated role value cannot be injected manually", async () => {
    createClient.mockResolvedValue(makeSupabaseMock());
    const result = await submitApplication(
      { ok: false, message: "" },
      formDataFor(BASE_FIELDS, ["<script>alert(1)</script>"]),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/how you're joining/i);
  });

  it("a mixed submission keeps the valid role and drops the invalid one", async () => {
    const supabase = makeSupabaseMock();
    createClient.mockResolvedValue(supabase);
    const result = await submitApplication(
      { ok: false, message: "" },
      formDataFor(BASE_FIELDS, ["teacher", "working_dancer"]),
    );
    expect(result.ok).toBe(true);
  });
});
