// Membership activation — the PURE, family-aware state machine.
//
// One generalized ledger (`activations`) serves every membership family:
//   professional · studio · team   (Team reserved; flow not built yet)
//
// The $30 (ACTIVATION_FEE_CENTS) is the FIRST money toward membership. It opens a
// CONFIGURABLE access window — standardized at 60 days across all families today
// (see ACCESS_PERIOD_DAYS_BY_FAMILY) — with the clock starting at PAYMENT. The $30
// is a fixed, PRICE-AGNOSTIC credit toward the continuing subscription: applied
// ONLY if the member continues WITHIN the window, and FORFEITED if it lapses. It
// is never a cash balance.
//
// Two decoupled lifecycles carried by one activation row:
//   status       : pending → active → converted | expired
//   creditStatus : available → applied | forfeited
//
// PURE and dependency-free: no DB, no Stripe, and no ambient clock (callers pass
// `now`), so every rule is unit-provable. Wiring (checkout, webhook, membership
// grant, the continuing-subscription discount) lands in later slices BEHIND these
// functions.

/* ─────────────────────────────  Families + config  ───────────────────────── */

/** The membership families the ledger serves. `team` is reserved (no flow yet). */
export type MembershipFamily = "professional" | "studio" | "team";

/** Standardized initial paid-access period, in days (2026-08-12: 60 across the
 *  board; the earlier professional "30" was retired). */
export const DEFAULT_ACCESS_PERIOD_DAYS = 60;

/** Per-family access period — the single source of truth. Change here to tune a
 *  family (or all of them) without touching any logic. */
export const ACCESS_PERIOD_DAYS_BY_FAMILY: Record<MembershipFamily, number> = {
  professional: 60,
  studio: 60,
  team: 60,
};

/** Days of access the $30 buys for a family (falls back to the default). */
export function accessPeriodDays(family: MembershipFamily): number {
  return ACCESS_PERIOD_DAYS_BY_FAMILY[family] ?? DEFAULT_ACCESS_PERIOD_DAYS;
}

/** The one-time activation charge, in cents ($30). Also the credit amount. */
export const ACTIVATION_FEE_CENTS = 3000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* ───────────────────────────────  Types  ─────────────────────────────────── */

export type ActivationStatus = "pending" | "active" | "converted" | "expired";
export type CreditStatus = "available" | "applied" | "forfeited";

/** The fields the pure rules reason over. */
export interface ActivationState {
  status: ActivationStatus;
  creditStatus: CreditStatus;
  /** Set once paid; null while pending. */
  accessExpiresAt: Date | null;
}

/* ─────────────────────────────  Window math  ─────────────────────────────── */

/** When an access window that started at `startedAt` ends, for a given family. */
export function accessExpiresAt(startedAt: Date, family: MembershipFamily): Date {
  return new Date(startedAt.getTime() + accessPeriodDays(family) * MS_PER_DAY);
}

/** Is `now` still inside the window? Inclusive of the exact expiry instant. Null
 *  expiry (never paid) is never "within". */
export function isWithinAccessWindow(now: Date, expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return now.getTime() <= expiresAt.getTime();
}

/** Whole days remaining (ceiling), clamped at 0. Drives reminders and "N days
 *  left" copy. */
export function daysRemaining(now: Date, expiresAt: Date | null): number {
  if (!expiresAt) return 0;
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / MS_PER_DAY);
}

/* ────────────────────────────  Transitions  ──────────────────────────────── */

/** Successful $30 payment: pending → active, window opens (family-sized), credit
 *  becomes available. */
export function onPaid(
  paidAt: Date,
  family: MembershipFamily,
): {
  status: "active";
  creditStatus: "available";
  accessStartedAt: Date;
  accessExpiresAt: Date;
} {
  return {
    status: "active",
    creditStatus: "available",
    accessStartedAt: paidAt,
    accessExpiresAt: accessExpiresAt(paidAt, family),
  };
}

/** May the $30 credit be redeemed right now? Only while active, still available,
 *  and inside the window. The single gate the continuing-subscription slice calls
 *  before attaching the discount. */
export function isCreditRedeemable(state: ActivationState, now: Date): boolean {
  return (
    state.status === "active" &&
    state.creditStatus === "available" &&
    isWithinAccessWindow(now, state.accessExpiresAt)
  );
}

/** The credit to apply at continuation, in cents. FIXED and price-agnostic — the
 *  $30 they paid, never a function of the (configurable) subscription price. 0
 *  when not redeemable. */
export function creditToApplyCents(state: ActivationState, now: Date): number {
  return isCreditRedeemable(state, now) ? ACTIVATION_FEE_CENTS : 0;
}

/** Continue (subscribe) within the window: active → converted, credit
 *  available → applied. Null if not redeemable (they may still subscribe, just
 *  with no credit). */
export function onContinue(
  state: ActivationState,
  now: Date,
): { status: "converted"; creditStatus: "applied"; creditAppliedCents: number } | null {
  if (!isCreditRedeemable(state, now)) return null;
  return { status: "converted", creditStatus: "applied", creditAppliedCents: ACTIVATION_FEE_CENTS };
}

/** Window-lapse check: an active activation whose window has closed becomes
 *  expired and forfeits its credit. Null (no change) otherwise — safe to run
 *  repeatedly (idempotent) from a lazy check or a cron. */
export function resolveExpiry(
  state: ActivationState,
  now: Date,
): { status: "expired"; creditStatus: "forfeited" } | null {
  if (state.status !== "active") return null;
  if (isWithinAccessWindow(now, state.accessExpiresAt)) return null;
  return { status: "expired", creditStatus: "forfeited" };
}

/* ─────────────────────────────  Labels  ──────────────────────────────────── */

export const ACTIVATION_STATUS_LABEL: Record<ActivationStatus, string> = {
  pending: "Payment started",
  active: "Active — access period",
  converted: "Continuing subscriber",
  expired: "Access expired",
};
