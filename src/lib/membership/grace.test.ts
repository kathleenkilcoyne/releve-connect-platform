import { describe, it, expect } from "vitest";
import { graceUntilFrom, shouldStartGrace, applyInvoicePaymentFailed, applyInvoicePaid } from "./grace";

/* ────────────────────────  a tiny fake Supabase  ─────────────────────────── */
// Just enough of the query builder for grace.ts's own two DB-effect functions:
// chainable eq(), a terminal maybeSingle(), and update(). Records every update
// so tests can assert exactly what was written (same shape as
// lib/profile/activate.test.ts's makeDb).

type Row = Record<string, unknown>;

function makeDb(tables: Record<string, Row[]>) {
  const updates: Row[] = [];
  const db = {
    updates,
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          rows = rows.filter((r) => r[col] === val);
          return q;
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        update: (payload: Row) => {
          const u = {
            eq: (col: string, val: unknown) => {
              updates.push({ table, col, val, payload });
              return Promise.resolve({ data: null, error: null });
            },
          };
          return u;
        },
      };
      return q;
    },
  };
  return db;
}

describe("graceUntilFrom", () => {
  it("is exactly 14 days after the given time", () => {
    expect(graceUntilFrom(new Date("2026-09-13T12:00:00Z"))).toBe("2026-09-27T12:00:00.000Z");
  });
});

// Pure decision logic — the rule that must not silently break (CLAUDE.md
// guardrail #6): who gets a grace period, and who never does.
describe("shouldStartGrace", () => {
  it("renewal failure on an active membership starts grace", () => {
    expect(
      shouldStartGrace({ membershipStatus: "active", billingReason: "subscription_cycle", graceAlreadySet: false }),
    ).toBe(true);
  });

  it("a repeat failure on an already-graced membership does not extend it", () => {
    expect(
      shouldStartGrace({ membershipStatus: "active", billingReason: "subscription_cycle", graceAlreadySet: true }),
    ).toBe(false);
  });

  it("a failed INITIAL payment (never activated) never gets grace", () => {
    expect(
      shouldStartGrace({ membershipStatus: "pending", billingReason: "subscription_create", graceAlreadySet: false }),
    ).toBe(false);
  });

  it("a failure with billing_reason other than subscription_cycle never gets grace, even if active", () => {
    for (const reason of ["subscription_create", "subscription_update", null, undefined]) {
      expect(
        shouldStartGrace({ membershipStatus: "active", billingReason: reason, graceAlreadySet: false }),
      ).toBe(false);
    }
  });

  it("a lapsed or canceled membership never gets grace", () => {
    for (const status of ["lapsed", "canceled", "pending"]) {
      expect(
        shouldStartGrace({ membershipStatus: status, billingReason: "subscription_cycle", graceAlreadySet: false }),
      ).toBe(false);
    }
  });
});

describe("applyInvoicePaymentFailed", () => {
  it("starts grace once on an active, paid Stripe membership's renewal failure", async () => {
    const db = makeDb({
      memberships: [
        { membership_id: "m1", membership_status: "active", grace_until: null, stripe_subscription_id: "sub_1" },
      ],
    });
    const result = await applyInvoicePaymentFailed(db, {
      stripeSubscriptionId: "sub_1",
      billingReason: "subscription_cycle",
      now: new Date("2026-09-13T00:00:00Z"),
    });
    expect(result).toEqual({ started: true });
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].payload).toMatchObject({ grace_until: "2026-09-27T00:00:00.000Z" });
  });

  it("does not extend an already-active grace period on a repeat retry failure", async () => {
    const db = makeDb({
      memberships: [
        {
          membership_id: "m1",
          membership_status: "active",
          grace_until: "2026-09-15T00:00:00.000Z",
          stripe_subscription_id: "sub_1",
        },
      ],
    });
    const result = await applyInvoicePaymentFailed(db, {
      stripeSubscriptionId: "sub_1",
      billingReason: "subscription_cycle",
      now: new Date("2026-09-20T00:00:00Z"),
    });
    expect(result).toEqual({ started: false });
    expect(db.updates).toHaveLength(0);
  });

  it("never grants grace to a brand-new customer whose first payment failed", async () => {
    const db = makeDb({
      memberships: [
        { membership_id: "m1", membership_status: "pending", grace_until: null, stripe_subscription_id: "sub_1" },
      ],
    });
    const result = await applyInvoicePaymentFailed(db, {
      stripeSubscriptionId: "sub_1",
      billingReason: "subscription_create",
    });
    expect(result).toEqual({ started: false });
    expect(db.updates).toHaveLength(0);
  });

  it("a complimentary/founding membership can never be found here — it has no stripe_subscription_id", async () => {
    const db = makeDb({
      memberships: [
        {
          membership_id: "comp-1",
          membership_status: "active",
          grace_until: null,
          stripe_subscription_id: null,
          source: "founding_comp",
        },
      ],
    });
    const result = await applyInvoicePaymentFailed(db, {
      stripeSubscriptionId: "sub_does_not_exist",
      billingReason: "subscription_cycle",
    });
    expect(result).toEqual({ started: false });
    expect(db.updates).toHaveLength(0);
  });
});

describe("applyInvoicePaid", () => {
  it("clears an in-progress grace period on a successful later payment", async () => {
    const db = makeDb({
      memberships: [
        {
          membership_id: "m1",
          membership_status: "active",
          grace_until: "2026-09-27T00:00:00.000Z",
          stripe_subscription_id: "sub_1",
        },
      ],
    });
    const result = await applyInvoicePaid(db, { stripeSubscriptionId: "sub_1" });
    expect(result).toEqual({ cleared: true });
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].payload).toMatchObject({ grace_until: null });
  });

  it("no-ops when the membership has no grace period to clear", async () => {
    const db = makeDb({
      memberships: [
        { membership_id: "m1", membership_status: "active", grace_until: null, stripe_subscription_id: "sub_1" },
      ],
    });
    const result = await applyInvoicePaid(db, { stripeSubscriptionId: "sub_1" });
    expect(result).toEqual({ cleared: false });
    expect(db.updates).toHaveLength(0);
  });

  it("no-ops when no membership matches the subscription", async () => {
    const db = makeDb({ memberships: [] });
    const result = await applyInvoicePaid(db, { stripeSubscriptionId: "sub_unknown" });
    expect(result).toEqual({ cleared: false });
    expect(db.updates).toHaveLength(0);
  });
});
