import { describe, it, expect, vi, beforeEach } from "vitest";

// The four-essential integrity rule, proven at the SERVER ACTION.
//
// These tests call saveProfile directly with a hand-built FormData. That IS the
// UI bypass: no disabled button, no client validation, no editor — just the
// request a determined caller could send. If the rule lives only in the
// component, every one of these fails.

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
let updates: Row[] = [];

function fakeDb() {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => {
          rows = rows.filter((r) => r[c] === v);
          return q;
        },
        in: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () => ({ data: rows[0] ?? null, error: null }),
        upsert: async () => ({ error: null }),
        insert: async () => ({ error: null }),
        delete: () => ({ eq: async () => ({ error: null }) }),
        update: (payload: Row) => {
          if (table === "talent_profiles") updates.push(payload);
          return { eq: async () => ({ error: null }) };
        },
        then: (res: (v: unknown) => void) => res({ data: rows, error: null }),
      };
      return q;
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "x" } }) }) },
  };
}

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    ...fakeDb(),
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "m@example.com" } } }) },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeDb() }));

const { saveProfile } = await import("./actions");

/** A LIVE profile that currently has all four essentials. */
const livingProfile = {
  user_id: "u1",
  profile_id: "p1",
  public_slug: "ada",
  headshot_url: "https://abc.supabase.co/storage/v1/object/public/headshots/a.jpg",
  gallery_urls: [],
  resume_url: null,
  visibility: "public",
};

/** A complete, publishing submission. Individual fields get blanked per test. */
function form(overrides: Record<string, string> = {}, opts: { publish?: boolean; intent?: string } = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    display_name: "Ada Lovelace",
    bio: "Twenty years in the studio.",
    primary_role: "teacher",
    city: "Montclair",
    state_province: "NJ",
    country: "United States",
    public_slug: "ada",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  if (opts.publish !== false) fd.set("publish", "on");
  if (opts.intent) fd.set("intent", opts.intent);
  return fd;
}

const state = { ok: false, message: "" };

beforeEach(() => {
  tables = { users: [{ user_id: "u1", account_type: "talent" }], talent_profiles: [livingProfile] };
  updates = [];
});

describe("a live profile may never be left without an essential", () => {
  const cases: Array<[string, Record<string, string>, string]> = [
    ["your story", { bio: "" }, "your story"],
    ["what you do", { primary_role: "" }, "what you do"],
    ["where you are", { city: "" }, "where you are"],
  ];

  for (const [name, override, expected] of cases) {
    it(`refuses the save when ${name} is removed`, async () => {
      const res = await saveProfile(state, form(override));
      expect(res.ok).toBe(false);
      expect(res.message.toLowerCase()).toContain(expected);
      expect(res.missingEssentials?.map((m) => m.label.toLowerCase())).toContain(expected);
      // Nothing was written — the live profile is untouched.
      expect(updates).toHaveLength(0);
    });
  }

  it("refuses the save when the headshot is missing", async () => {
    // The stored profile has no headshot and none is being uploaded.
    tables.talent_profiles = [{ ...livingProfile, headshot_url: null }];
    const res = await saveProfile(state, form());
    expect(res.ok).toBe(false);
    expect(res.missingEssentials?.map((m) => m.key)).toContain("headshot");
    expect(updates).toHaveLength(0);
  });

  it("names EVERY missing essential, not just the first", async () => {
    tables.talent_profiles = [{ ...livingProfile, headshot_url: null }];
    const res = await saveProfile(state, form({ bio: "", primary_role: "", city: "" }));
    expect(res.missingEssentials?.map((m) => m.key).sort()).toEqual(
      ["bio", "headshot", "location", "role"].sort(),
    );
  });

  it("treats whitespace as missing — a space is not a story", async () => {
    const res = await saveProfile(state, form({ bio: "    " }));
    expect(res.ok).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("does not silently demote the profile to draft", async () => {
    const res = await saveProfile(state, form({ bio: "" }));
    expect(res.ok).toBe(false);
    // No write at all, so profile_status is untouched and it is still live.
    expect(updates).toHaveLength(0);
    expect(res.message).toMatch(/Unpublish and save as draft/);
  });
});

describe("the member is never trapped", () => {
  it("'Unpublish and save as draft' keeps the edit and takes the profile offline", async () => {
    const res = await saveProfile(state, form({ bio: "" }, { intent: "unpublish_and_save" }));
    expect(res.ok).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0].profile_status).toBe("draft");
    // The edit really was kept.
    expect(updates[0].bio).toBeNull();
  });

  it("reports what ACTUALLY happened, not what the checkbox asked for", async () => {
    // Caught in the browser test: the publish box is still ticked when the member
    // presses "Unpublish and save as draft", and the confirmation used to read
    // "you're on the Relevé Roster. Your public page is live." — in the same
    // breath as taking them off it.
    const res = await saveProfile(state, form({ bio: "" }, { intent: "unpublish_and_save" }));
    expect(res.published).toBe(false);
    expect(res.message).not.toMatch(/on the Relevé Roster|page is live/);
    expect(res.message).toMatch(/draft/i);
    expect(res.message).toMatch(/changes are kept/i);
  });

  it("saving as a draft is always allowed, however incomplete", async () => {
    const res = await saveProfile(
      state,
      form({ bio: "", primary_role: "", city: "" }, { publish: false }),
    );
    expect(res.ok).toBe(true);
    expect(updates[0].profile_status).toBe("draft");
  });

  it("unchecking publish is itself a voluntary unpublish and is never blocked", async () => {
    const res = await saveProfile(state, form({ bio: "" }, { publish: false }));
    expect(res.ok).toBe(true);
    expect(updates[0].profile_status).toBe("draft");
  });
});

describe("the rule does not get in the way of anything else", () => {
  it("a complete live profile saves normally and stays published", async () => {
    const res = await saveProfile(state, form());
    expect(res.ok).toBe(true);
    expect(updates[0].profile_status).toBe("published");
  });

  it("a public → unlisted privacy change on a COMPLETE profile is unaffected", async () => {
    const fd = form();
    fd.set("visibility", "unlisted");
    const res = await saveProfile(state, fd);
    expect(res.ok).toBe(true);
    expect(updates[0].visibility).toBe("unlisted");
    expect(updates[0].profile_status).toBe("published");
  });

  it("still refuses to write a trust signal, whatever the form sends", async () => {
    // Slice 2's guarantee, re-asserted now that this action has new branches.
    const fd = form();
    for (const f of ["verification_flag", "honorifics", "choreographer_tier", "founder_distinction"])
      fd.set(f, "true");
    const res = await saveProfile(state, fd);
    expect(res.ok).toBe(true);
    for (const f of ["verification_flag", "honorifics", "choreographer_tier", "founder_distinction"])
      expect(updates[0]).not.toHaveProperty(f);
  });

  it("still refuses to create a profile when none exists", async () => {
    tables.talent_profiles = [];
    const res = await saveProfile(state, form());
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/couldn't find your profile/i);
    expect(updates).toHaveLength(0);
  });
});

describe("one definition of the four essentials", () => {
  it("the publish gate and the save rule read the same list", async () => {
    const { ESSENTIALS, buildChecklist } = await import("@/lib/profile/review");
    const checklistEssentials = buildChecklist(
      {
        display_name: null, headshot_url: null, bio: null, primary_role: null, city: null,
        teaching_reel_url: null, resume_url: null, social_links: null, gallery_urls: null,
        profile_status: "draft", visibility: "public",
      },
      { styles: 0, levels: 0 },
    )
      .filter((i) => i.essential)
      .map((i) => i.key);
    expect(checklistEssentials).toEqual(ESSENTIALS.map((e) => e.key));
  });
});
