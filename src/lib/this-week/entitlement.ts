// "This Week" — the SINGLE family-entitlement rule (free-pilot aware).
//
// Both the live path (live.ts · resolveFamilyAccess) and the demo path (data.ts ·
// hasFamilyAccess) call this one function, so the rule can never drift between
// them. It is pure (imports only types) — safe on the server and in the client
// bundle, and unit-testable.
//
// THE RULE (free pilot Aug–Dec 2026, then paid in January):
//   · "active"   → always entitled (a real paid plan).
//   · "trialing" → entitled ONLY while the trial has not ended — trial_ends_at is
//                  null (open-ended) or still in the FUTURE. Pilot families join
//                  trialing with trial_ends_at = 2026-12-31, so they are entitled
//                  for free through the pilot and the paywall turns on BY ITSELF
//                  in January when the trial lapses. No manual flip.
//   · anything else (none/past_due/canceled) → not entitled.
//
// A null status is NOT a denial: it means the family_accounts row was unreadable
// because the guardian lacks the 'billing' permission. A parent who can see the
// calendar but not the invoice still sees the calendar (resolves to reason
// "none" while access is granted on the calendar permission they hold).

import type { AccessResult, SubscriptionStatus } from "./types";

export function familyAccessFrom(
  status: string | null,
  trialEndsAt: string | null,
  now: number = Date.now(),
): AccessResult {
  if (status === null) return { allowed: true, reason: "none" };

  const reason = status as SubscriptionStatus;
  if (reason === "active") return { allowed: true, reason };

  if (reason === "trialing") {
    const parsed = trialEndsAt ? Date.parse(trialEndsAt) : NaN;
    // No end date, or an unparseable one, keeps the trial open; a real date gates
    // on whether it is still in the future.
    const stillTrialing = !trialEndsAt || Number.isNaN(parsed) || parsed > now;
    return { allowed: stillTrialing, reason };
  }

  return { allowed: false, reason };
}
