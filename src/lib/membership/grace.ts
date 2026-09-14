// The 14-day failed-renewal grace period (founder-approved 2026-09-13).
//
// A renewal payment failure on an already-active paid membership starts a
// 14-day window during which access is preserved; a brand-new customer whose
// FIRST payment never succeeded gets none. The window is enforced by reading
// `grace_until` at access-check time (see lib/membership/access.ts) — nothing
// flips membership_status automatically when the 14 days elapse; that would
// need a webhook Stripe has no reason to send on exactly day 14.
//
// Pure decision logic lives here, dependency-free, so the rules that must not
// silently break (CLAUDE.md guardrail #6) are unit-testable without a database
// or the Stripe SDK — same shape as lib/membership/access.ts and
// lib/profile/activation.ts. The two DB-effect functions below are the only
// I/O; the webhook route calls them and does nothing else.

export const GRACE_PERIOD_DAYS = 14;

/** `now` + 14 days, as an ISO string ready to store in `grace_until`. */
export function graceUntilFrom(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + GRACE_PERIOD_DAYS);
  return d.toISOString();
}

/**
 * Should THIS invoice.payment_failed event start a grace period? Only when
 * all three hold:
 *   - the membership is currently `active` — a brand-new, never-activated
 *     `pending` row gets no grace; its first payment simply never succeeded.
 *   - the invoice's billing_reason is `subscription_cycle` — a renewal, not
 *     the subscription's first invoice (belt-and-suspenders alongside the
 *     status check above).
 *   - no grace is already in effect — a second or third retry against the
 *     SAME failed cycle must not push the window further out.
 */
export function shouldStartGrace(input: {
  membershipStatus: string;
  billingReason: string | null | undefined;
  graceAlreadySet: boolean;
}): boolean {
  return (
    input.membershipStatus === "active" &&
    input.billingReason === "subscription_cycle" &&
    !input.graceAlreadySet
  );
}

/* ─────────────────────────  DB-effect (thin I/O)  ────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (table: string) => any };

type GraceRow = { membership_id: string; membership_status: string; grace_until: string | null };

/**
 * Apply an invoice.payment_failed event to whichever membership (if any) owns
 * this Stripe subscription. No-op if no row matches — a complimentary/founding
 * membership never carries a stripe_subscription_id, so it can never be found
 * here — or if `shouldStartGrace` says this particular event shouldn't start one.
 */
export async function applyInvoicePaymentFailed(
  db: SupabaseLike,
  input: { stripeSubscriptionId: string; billingReason: string | null | undefined; now?: Date },
): Promise<{ started: boolean }> {
  const { data } = await db
    .from("memberships")
    .select("membership_id, membership_status, grace_until")
    .eq("stripe_subscription_id", input.stripeSubscriptionId)
    .maybeSingle();
  const row = data as GraceRow | null;
  if (!row) return { started: false };

  const start = shouldStartGrace({
    membershipStatus: row.membership_status,
    billingReason: input.billingReason,
    graceAlreadySet: row.grace_until !== null,
  });
  if (!start) return { started: false };

  await db
    .from("memberships")
    .update({ grace_until: graceUntilFrom(input.now), updated_at: new Date().toISOString() })
    .eq("membership_id", row.membership_id);
  return { started: true };
}

/**
 * Apply an invoice.paid event: clear any grace period on the owning
 * membership. No-op if no row matches, or if none was in grace.
 */
export async function applyInvoicePaid(
  db: SupabaseLike,
  input: { stripeSubscriptionId: string },
): Promise<{ cleared: boolean }> {
  const { data } = await db
    .from("memberships")
    .select("membership_id, grace_until")
    .eq("stripe_subscription_id", input.stripeSubscriptionId)
    .maybeSingle();
  const row = data as { membership_id: string; grace_until: string | null } | null;
  if (!row || row.grace_until === null) return { cleared: false };

  await db
    .from("memberships")
    .update({ grace_until: null, updated_at: new Date().toISOString() })
    .eq("membership_id", row.membership_id);
  return { cleared: true };
}
