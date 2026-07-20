// "This Week" — turning compensation rows into the card's pay badge.
//
// Two different questions, and the card answers whichever applies:
//
//   "What WAS I paid?"    → a teaching_earnings row exists for this session.
//                           Show the actual amount and its real status.
//   "What WILL this pay?" → no earning yet (the class hasn't happened, or
//                           payroll hasn't run). Fall back to the AGREED rate
//                           from the engagement, shown as unpaid.
//
// Never recompute a past earning from the current rate — that is the whole
// reason the ledger snapshots it. If an earning exists, it wins, full stop.
//
// ── Privacy ──
// Nothing here decides who may see pay; RLS already did that (a teacher sees
// their own, a studio admin sees their studio's, nobody else sees anything). But
// the CALLER still must not attach pay to a student's card — see
// `buildPayMap`'s note. Defence in depth: the query returns nothing to an
// unauthorised viewer, and the view layer never asks in the first place.

import type { EarningRow, EngagementRow, SessionWithClass } from "./queries";
import type { PayInfo, PaymentStatus } from "./types";

/** Cents → "$65" / "$81.25". Whole amounts drop the trailing ".00". */
export function formatMoney(cents: number, currency = "USD"): string {
  const symbol = currency === "USD" ? "$" : `${currency} `;
  const value = cents / 100;
  return `${symbol}${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}`;
}

/** "$65/hr" · "$65/class" · "$65/student". */
export function formatRate(
  cents: number,
  unit: EngagementRow["rate_unit"],
  currency = "USD",
): string {
  const suffix =
    unit === "hourly" ? "/hr" : unit === "per_session" ? "/class" : "/student";
  return `${formatMoney(cents, currency)}${suffix}`;
}

/**
 * The TypeScript mirror of `resolve_teaching_rate()`: most specific wins.
 *
 * A class-scoped engagement beats the studio-wide default; among equals, the
 * most recently effective one wins. Kept in sync with the SQL function on
 * purpose — the DB version serves reporting, this one serves the calendar
 * without an RPC round-trip per session.
 */
export function resolveEngagement(
  engagements: EngagementRow[],
  employerId: string,
  classId: string,
  onDate: Date,
): EngagementRow | null {
  const day = onDate.toISOString().slice(0, 10); // YYYY-MM-DD

  const candidates = engagements.filter(
    (e) =>
      e.employer_id === employerId &&
      e.status === "active" &&
      e.effective_from <= day &&
      (e.effective_to === null || e.effective_to >= day) &&
      (e.class_id === null || e.class_id === classId),
  );

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    // Class-specific before studio-wide.
    const specificity = Number(b.class_id !== null) - Number(a.class_id !== null);
    if (specificity !== 0) return specificity;
    // Then most recently effective.
    return b.effective_from.localeCompare(a.effective_from);
  });

  return candidates[0];
}

/** Ledger status → the three states the badge renders. */
function toPaymentStatus(status: EarningRow["status"]): PaymentStatus {
  switch (status) {
    case "paid":
      return "paid";
    case "approved":
    case "pending":
      return "pending";
    case "void":
    default:
      // A voided line is money that will not arrive — showing it as anything
      // other than unpaid would misrepresent it.
      return "unpaid";
  }
}

/**
 * Build session_id → PayInfo for the week.
 *
 * ⚠️ CALL THIS ONLY FOR THE TEACHER'S OWN VIEW. Pay must never be attached to a
 * student's or guardian's card: a parent looking at their child's class has no
 * business seeing what the teacher is paid for it. The view layer enforces this
 * by only passing a pay map when the relation is "teacher".
 */
export function buildPayMap(
  sessions: SessionWithClass[],
  engagements: EngagementRow[],
  earnings: EarningRow[],
): Map<string, PayInfo> {
  const bySession = new Map<string, EarningRow>();
  for (const e of earnings) {
    if (e.session_id) bySession.set(e.session_id, e);
  }

  const out = new Map<string, PayInfo>();

  for (const item of sessions) {
    const sessionId = item.session.session_id;
    const earned = bySession.get(sessionId);

    // 1. An actual earning exists — the snapshotted truth wins.
    if (earned) {
      out.set(sessionId, {
        rate: formatMoney(earned.amount_cents, earned.currency),
        status: toPaymentStatus(earned.status),
      });
      continue;
    }

    // 2. Otherwise fall back to the agreed rate for that day.
    const engagement = resolveEngagement(
      engagements,
      item.klass.employer_id,
      item.klass.class_id,
      new Date(item.session.starts_at),
    );
    if (!engagement) continue; // No agreement on file → no badge, rather than $0.

    out.set(sessionId, {
      rate: formatRate(
        engagement.rate_amount_cents,
        engagement.rate_unit,
        engagement.currency,
      ),
      status: "unpaid",
    });
  }

  return out;
}
