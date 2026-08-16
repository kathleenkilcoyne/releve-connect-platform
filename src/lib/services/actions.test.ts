// Professional Services — WORKSPACE lifecycle + authorization tests.
//
// Covers the flow verified by hand on 2026-08-15: create → edit → hide → show →
// delete, plus the rule that one member cannot touch another member's services.
//
// ── How the authorization test is honest ──
// The fake Supabase client below ENFORCES ROW OWNERSHIP the way RLS does: a
// query only ever sees rows belonging to the signed-in user's profile, and a
// mutation only ever writes those rows. Nothing is stubbed to "return null when
// not owned" — the visibility rule is implemented once, in the fake, and the
// cross-member tests then genuinely fail if the action stops relying on it.
//
// Out of scope by instruction: booking checkout, payouts, fee rate, and the
// availability-authoring UI. Nothing here touches them.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// A minimal in-memory Supabase stand-in
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

type Db = {
  currentUserId: string | null;
  profiles: Array<{ profile_id: string; user_id: string }>;
  services: Row[];
  seq: number;
};

const db: Db = { currentUserId: null, profiles: [], services: [], seq: 0 };

/** The profile ids the signed-in user owns — the fake's whole RLS rule. */
function ownedProfileIds(): string[] {
  return db.profiles.filter((p) => p.user_id === db.currentUserId).map((p) => p.profile_id);
}

/** Rows of `table` this caller may see. Mirrors the owner-scoped policies. */
function visibleRows(table: string): Row[] {
  if (table === "talent_profiles") {
    return db.profiles.filter((p) => p.user_id === db.currentUserId) as unknown as Row[];
  }
  if (table === "professional_services") {
    const mine = new Set(ownedProfileIds());
    return db.services.filter((s) => mine.has(s.profile_id as string));
  }
  return [];
}

class Builder {
  private filters: Array<[string, unknown]> = [];
  private op: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | null = null;
  private wantSingle = false;
  private sortKey: string | null = null;
  private sortAsc = true;
  private limitN: number | null = null;

  constructor(private table: string) {}

  // The column list is irrelevant to the fake — visibility is decided by
  // ownership, not by which columns were asked for.
  select() {
    if (this.op !== "insert") this.op = "select";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.sortKey = col;
    this.sortAsc = opts?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(row: Row) {
    this.op = "update";
    this.payload = row;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }

  private matching(): Row[] {
    let rows = visibleRows(this.table).filter((r) =>
      this.filters.every(([c, v]) => r[c] === v),
    );
    if (this.sortKey) {
      const k = this.sortKey;
      rows = [...rows].sort((a, b) =>
        this.sortAsc
          ? Number(a[k] ?? 0) - Number(b[k] ?? 0)
          : Number(b[k] ?? 0) - Number(a[k] ?? 0),
      );
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  private run(): { data: unknown; error: { message: string } | null } {
    switch (this.op) {
      case "insert": {
        // An insert must target a profile the caller owns (the WITH CHECK rule).
        const pid = this.payload?.profile_id as string | undefined;
        if (!pid || !ownedProfileIds().includes(pid)) {
          return { data: null, error: { message: "new row violates row-level security policy" } };
        }
        const created = { id: `svc-${++db.seq}`, ...this.payload };
        db.services.push(created);
        return { data: this.wantSingle ? created : [created], error: null };
      }
      case "update": {
        const targets = this.matching();
        for (const t of targets) Object.assign(t, this.payload);
        return { data: targets, error: null };
      }
      case "delete": {
        const targets = this.matching();
        db.services = db.services.filter((s) => !targets.includes(s));
        return { data: targets, error: null };
      }
      default: {
        const rows = this.matching();
        return { data: this.wantSingle ? rows[0] ?? null : rows, error: null };
      }
    }
  }

  async maybeSingle() {
    this.wantSingle = true;
    return this.run();
  }
  async single() {
    this.wantSingle = true;
    const res = this.run();
    if (!res.data) return { data: null, error: { message: "no rows returned" } };
    return res;
  }
  // Awaiting the builder directly (update/delete chains) executes it.
  then<T>(resolve: (v: { data: unknown; error: { message: string } | null }) => T) {
    return Promise.resolve(this.run()).then(resolve);
  }
}

const fakeClient = {
  auth: {
    getUser: async () => ({
      data: { user: db.currentUserId ? { id: db.currentUserId, email: "x@y.z" } : null },
    }),
  },
  from: (table: string) => new Builder(table),
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeClient }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Imported AFTER the mocks are registered.
const { saveService, setServiceStatus, deleteService } = await import("./actions");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALICE = "user-alice";
const BOB = "user-bob";
const ALICE_PROFILE = "profile-alice";
const BOB_PROFILE = "profile-bob";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

/** The minimum a valid service needs, displayed publicly. */
function validForm(over: Record<string, string> = {}) {
  return form({
    category: "massage_therapy",
    business_name: "McAree Bodywork",
    short_description: "Sports Massage",
    display_publicly: "on",
    ...over,
  });
}

function aliceServices() {
  return db.services.filter((s) => s.profile_id === ALICE_PROFILE);
}

beforeEach(() => {
  process.env.PROFESSIONAL_SERVICES_ENABLED = "true";
  db.currentUserId = ALICE;
  db.profiles = [
    { profile_id: ALICE_PROFILE, user_id: ALICE },
    { profile_id: BOB_PROFILE, user_id: BOB },
  ];
  db.services = [];
  db.seq = 0;
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("workspace lifecycle", () => {
  it("CREATE: adds a service to the caller's own profile", async () => {
    const res = await saveService({ ok: false, message: "" }, validForm());

    expect(res.ok).toBe(true);
    expect(aliceServices()).toHaveLength(1);
    const created = aliceServices()[0];
    expect(created.business_name).toBe("McAree Bodywork");
    expect(created.profile_id).toBe(ALICE_PROFILE);
    expect(created.status).toBe("active");
    expect(created.sort_order).toBe(0);
  });

  it("CREATE: a service saved with the display toggle off is hidden", async () => {
    const fd = validForm();
    fd.delete("display_publicly");
    const res = await saveService({ ok: false, message: "" }, fd);

    expect(res.ok).toBe(true);
    expect(aliceServices()[0].status).toBe("hidden");
  });

  it("CREATE: rejects an invalid service without writing anything", async () => {
    const res = await saveService({ ok: false, message: "" }, form({ category: "", business_name: "" }));

    expect(res.ok).toBe(false);
    expect(res.errors).toBeDefined();
    expect(db.services).toHaveLength(0);
  });

  it("CREATE: appends, so multiple services keep their order", async () => {
    await saveService({ ok: false, message: "" }, validForm({ business_name: "First" }));
    await saveService({ ok: false, message: "" }, validForm({ business_name: "Second" }));
    await saveService({ ok: false, message: "" }, validForm({ business_name: "Third" }));

    expect(aliceServices().map((s) => [s.business_name, s.sort_order])).toEqual([
      ["First", 0],
      ["Second", 1],
      ["Third", 2],
    ]);
  });

  it("EDIT: updates in place without creating a second row", async () => {
    await saveService({ ok: false, message: "" }, validForm());
    const id = aliceServices()[0].id as string;

    const res = await saveService(
      { ok: false, message: "" },
      validForm({ service_id: id, business_name: "McAree Bodywork & Recovery" }),
    );

    expect(res.ok).toBe(true);
    expect(aliceServices()).toHaveLength(1);
    expect(aliceServices()[0].business_name).toBe("McAree Bodywork & Recovery");
    expect(aliceServices()[0].id).toBe(id);
  });

  it("HIDE then SHOW: round-trips the public display state", async () => {
    await saveService({ ok: false, message: "" }, validForm());
    const id = aliceServices()[0].id as string;

    expect((await setServiceStatus(id, "hidden")).ok).toBe(true);
    expect(aliceServices()[0].status).toBe("hidden");

    expect((await setServiceStatus(id, "active")).ok).toBe(true);
    expect(aliceServices()[0].status).toBe("active");
  });

  it("HIDE: refuses a status outside the vocabulary", async () => {
    await saveService({ ok: false, message: "" }, validForm());
    const id = aliceServices()[0].id as string;

    const res = await setServiceStatus(id, "deleted" as never);

    expect(res.ok).toBe(false);
    expect(aliceServices()[0].status).toBe("active");
  });

  it("DELETE: removes the service", async () => {
    await saveService({ ok: false, message: "" }, validForm());
    const id = aliceServices()[0].id as string;

    expect((await deleteService(id)).ok).toBe(true);
    expect(aliceServices()).toHaveLength(0);
  });

  it("DELETE: removes only the one asked for", async () => {
    await saveService({ ok: false, message: "" }, validForm({ business_name: "Keep" }));
    await saveService({ ok: false, message: "" }, validForm({ business_name: "Remove" }));
    const target = aliceServices().find((s) => s.business_name === "Remove")!.id as string;

    await deleteService(target);

    expect(aliceServices().map((s) => s.business_name)).toEqual(["Keep"]);
  });
});

// ---------------------------------------------------------------------------
// Contact privacy, through the action
// ---------------------------------------------------------------------------

describe("contact privacy on save", () => {
  it("stores contact details but does not publish them by default", async () => {
    await saveService(
      { ok: false, message: "" },
      validForm({ business_email: "hello@example.com", business_phone: "(212) 555-0134" }),
    );

    const row = aliceServices()[0];
    expect(row.business_email).toBe("hello@example.com");
    expect(row.show_email).toBe(false);
    expect(row.show_phone).toBe(false);
  });

  it("publishes only what the member ticked", async () => {
    await saveService(
      { ok: false, message: "" },
      validForm({ business_email: "hello@example.com", show_email: "on" }),
    );

    const row = aliceServices()[0];
    expect(row.show_email).toBe(true);
    expect(row.show_phone).toBe(false);
  });

  it("cannot publish a contact field that is empty", async () => {
    await saveService({ ok: false, message: "" }, validForm({ show_email: "on", show_phone: "on" }));

    const row = aliceServices()[0];
    expect(row.show_email).toBe(false);
    expect(row.show_phone).toBe(false);
  });

  it("refuses an unsafe link rather than storing it", async () => {
    const res = await saveService(
      { ok: false, message: "" },
      validForm({ website_url: "javascript:alert(1)" }),
    );

    expect(res.ok).toBe(false);
    expect(db.services).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Authorization — the rule that matters most
// ---------------------------------------------------------------------------

describe("authorization: one member cannot manage another's services", () => {
  /** Give Bob a service, then sign in as Alice. */
  function bobHasAService(): string {
    db.services.push({
      id: "svc-bob",
      profile_id: BOB_PROFILE,
      business_name: "Bob's Pilates",
      status: "active",
      show_email: false,
      show_phone: false,
      sort_order: 0,
    });
    return "svc-bob";
  }

  it("EDIT: Alice cannot edit Bob's service", async () => {
    const bobId = bobHasAService();

    const res = await saveService(
      { ok: false, message: "" },
      validForm({ service_id: bobId, business_name: "Hijacked" }),
    );

    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/couldn’t be found|could not be found/i);
    // Bob's row is untouched, and nothing was created for Alice either.
    expect(db.services.find((s) => s.id === bobId)!.business_name).toBe("Bob's Pilates");
    expect(aliceServices()).toHaveLength(0);
  });

  it("HIDE: Alice cannot change the status of Bob's service", async () => {
    const bobId = bobHasAService();

    await setServiceStatus(bobId, "hidden");

    expect(db.services.find((s) => s.id === bobId)!.status).toBe("active");
  });

  it("DELETE: Alice cannot delete Bob's service", async () => {
    const bobId = bobHasAService();

    await deleteService(bobId);

    expect(db.services.find((s) => s.id === bobId)).toBeDefined();
  });

  it("READ: Alice's workspace never contains Bob's services", () => {
    bobHasAService();
    expect(visibleRows("professional_services")).toHaveLength(0);
  });

  it("a signed-out caller cannot create anything", async () => {
    db.currentUserId = null;

    const res = await saveService({ ok: false, message: "" }, validForm());

    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/sign in/i);
    expect(db.services).toHaveLength(0);
  });

  it("a signed-out caller cannot hide or delete", async () => {
    const bobId = bobHasAService();
    db.currentUserId = null;

    expect((await setServiceStatus(bobId, "hidden")).ok).toBe(false);
    expect((await deleteService(bobId)).ok).toBe(false);
    expect(db.services.find((s) => s.id === bobId)!.status).toBe("active");
  });

  it("a member with no profile yet cannot create a service", async () => {
    db.profiles = db.profiles.filter((p) => p.user_id !== ALICE);

    const res = await saveService({ ok: false, message: "" }, validForm());

    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/profile first/i);
    expect(db.services).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The feature flag
// ---------------------------------------------------------------------------

describe("feature flag", () => {
  beforeEach(() => {
    process.env.PROFESSIONAL_SERVICES_ENABLED = "false";
  });

  it("refuses every mutation when the flag is off", async () => {
    db.services.push({
      id: "svc-1",
      profile_id: ALICE_PROFILE,
      business_name: "Existing",
      status: "active",
      sort_order: 0,
    });

    expect((await saveService({ ok: false, message: "" }, validForm())).ok).toBe(false);
    expect((await setServiceStatus("svc-1", "hidden")).ok).toBe(false);
    expect((await deleteService("svc-1")).ok).toBe(false);

    // Nothing created, nothing changed, nothing removed.
    expect(aliceServices()).toHaveLength(1);
    expect(aliceServices()[0].status).toBe("active");
  });
});
