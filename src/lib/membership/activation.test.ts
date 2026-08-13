// Membership activation — the pure, family-aware state machine. Pins the locked
// policy: the $30 opens a CONFIGURABLE window (60 days across all families today),
// the credit is redeemable ONLY inside that window and FORFEITED once it lapses
// (never a persisting balance), and it's fixed at $30 regardless of the (future)
// subscription price.

import { describe, expect, it } from "vitest";

import {
  ACCESS_PERIOD_DAYS_BY_FAMILY,
  ACTIVATION_FEE_CENTS,
  DEFAULT_ACCESS_PERIOD_DAYS,
  accessExpiresAt,
  accessPeriodDays,
  creditToApplyCents,
  daysRemaining,
  isCreditRedeemable,
  isWithinAccessWindow,
  onContinue,
  onPaid,
  resolveExpiry,
  type ActivationState,
  type MembershipFamily,
} from "./activation";

const PAID = new Date("2026-08-12T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const FAMILIES: MembershipFamily[] = ["professional", "studio", "team"];

// An active, credit-available activation for a family, paid at PAID.
function activeState(family: MembershipFamily = "professional"): ActivationState {
  return { status: "active", creditStatus: "available", accessExpiresAt: accessExpiresAt(PAID, family) };
}

describe("access period — standardized 60 and configurable per family", () => {
  it("defaults to 60 days", () => {
    expect(DEFAULT_ACCESS_PERIOD_DAYS).toBe(60);
  });

  it("is 60 for every family today (60/60/60)", () => {
    for (const f of FAMILIES) {
      expect(accessPeriodDays(f)).toBe(60);
      expect(ACCESS_PERIOD_DAYS_BY_FAMILY[f]).toBe(60);
    }
  });

  it("accessExpiresAt honors the family's configured period", () => {
    for (const f of FAMILIES) {
      expect(accessExpiresAt(PAID, f).getTime()).toBe(PAID.getTime() + accessPeriodDays(f) * DAY);
    }
    // Professional is now 60 days, not the retired 30.
    expect(accessExpiresAt(PAID, "professional").getTime()).toBe(PAID.getTime() + 60 * DAY);
  });
});

describe("isWithinAccessWindow — inclusive of the expiry instant", () => {
  const exp = accessExpiresAt(PAID, "studio");
  it("within on payment day and mid-window; out one ms past expiry", () => {
    expect(isWithinAccessWindow(PAID, exp)).toBe(true);
    expect(isWithinAccessWindow(new Date(PAID.getTime() + 30 * DAY), exp)).toBe(true);
    expect(isWithinAccessWindow(exp, exp)).toBe(true);
    expect(isWithinAccessWindow(new Date(exp.getTime() + 1), exp)).toBe(false);
  });
  it("never within a null (unpaid) window", () => {
    expect(isWithinAccessWindow(PAID, null)).toBe(false);
  });
});

describe("daysRemaining", () => {
  const exp = accessExpiresAt(PAID, "professional");
  it("is the full 60 on payment day, counts down, clamps at 0", () => {
    expect(daysRemaining(PAID, exp)).toBe(60);
    expect(daysRemaining(new Date(PAID.getTime() + 55 * DAY), exp)).toBe(5);
    expect(daysRemaining(new Date(exp.getTime() + DAY), exp)).toBe(0);
    expect(daysRemaining(PAID, null)).toBe(0);
  });
});

describe("onPaid — payment opens a family-sized window", () => {
  it("goes active, credit available, clock at payment, 60-day expiry", () => {
    for (const f of FAMILIES) {
      const r = onPaid(PAID, f);
      expect(r.status).toBe("active");
      expect(r.creditStatus).toBe("available");
      expect(r.accessStartedAt).toEqual(PAID);
      expect(r.accessExpiresAt.getTime()).toBe(PAID.getTime() + accessPeriodDays(f) * DAY);
    }
  });
});

describe("credit redeemability — time-boxed to the window", () => {
  it("redeemable while active + available + within window (each family)", () => {
    for (const f of FAMILIES) {
      const midWindow = new Date(PAID.getTime() + 40 * DAY);
      expect(isCreditRedeemable(activeState(f), midWindow)).toBe(true);
      expect(creditToApplyCents(activeState(f), midWindow)).toBe(ACTIVATION_FEE_CENTS);
    }
  });

  it("NOT redeemable after the window lapses (forfeit territory)", () => {
    const after = new Date(accessExpiresAt(PAID, "professional").getTime() + DAY);
    expect(isCreditRedeemable(activeState(), after)).toBe(false);
    expect(creditToApplyCents(activeState(), after)).toBe(0);
  });

  it("NOT redeemable once already applied, or once expired", () => {
    const now = new Date(PAID.getTime() + 5 * DAY);
    const applied: ActivationState = { ...activeState(), creditStatus: "applied" };
    const expired: ActivationState = { status: "expired", creditStatus: "forfeited", accessExpiresAt: accessExpiresAt(PAID, "professional") };
    expect(isCreditRedeemable(applied, now)).toBe(false);
    expect(isCreditRedeemable(expired, now)).toBe(false);
  });

  it("the credit is FIXED at $30 — never a function of any subscription price", () => {
    expect(creditToApplyCents(activeState(), PAID)).toBe(3000);
  });
});

describe("onContinue — continue within the window converts + applies the credit", () => {
  it("active + within window → converted, credit applied, $30", () => {
    const r = onContinue(activeState(), new Date(PAID.getTime() + 45 * DAY));
    expect(r).toEqual({ status: "converted", creditStatus: "applied", creditAppliedCents: 3000 });
  });

  it("null after the window (they may still subscribe, but with no credit)", () => {
    const after = new Date(accessExpiresAt(PAID, "professional").getTime() + DAY);
    expect(onContinue(activeState(), after)).toBeNull();
  });
});

describe("resolveExpiry — lapse forfeits the credit, idempotently", () => {
  it("active + past window → expired + forfeited", () => {
    const after = new Date(accessExpiresAt(PAID, "professional").getTime() + 1);
    expect(resolveExpiry(activeState(), after)).toEqual({ status: "expired", creditStatus: "forfeited" });
  });

  it("no change while still within the window", () => {
    expect(resolveExpiry(activeState(), new Date(PAID.getTime() + 59 * DAY))).toBeNull();
  });

  it("no change (idempotent) for pending / converted / already-expired", () => {
    const after = new Date(accessExpiresAt(PAID, "professional").getTime() + DAY);
    const pending: ActivationState = { status: "pending", creditStatus: "available", accessExpiresAt: null };
    const converted: ActivationState = { status: "converted", creditStatus: "applied", accessExpiresAt: accessExpiresAt(PAID, "professional") };
    const expired: ActivationState = { status: "expired", creditStatus: "forfeited", accessExpiresAt: accessExpiresAt(PAID, "professional") };
    expect(resolveExpiry(pending, after)).toBeNull();
    expect(resolveExpiry(converted, after)).toBeNull();
    expect(resolveExpiry(expired, after)).toBeNull();
  });
});
