// The financial canon for the $499 Signature Experience, in one place.
//
// Rule (docs/STRIPE-CONNECT-499-LICENSING.md + CLAUDE.md §1): on a licensing
// sale the ARTIST keeps 80% and Relevé takes 20% as an application fee. This is
// a marketplace take on a *product* (the choreography), NOT a cut of anyone's
// wage — so it does not violate the no-tax-on-labor guardrail.

/** Default list price of a Signature Experience: $499.00. */
export const SIGNATURE_PRICE_CENTS = 49_900;

/** Relevé's platform share, in basis points. 2000 bps = 20%. */
export const PLATFORM_FEE_BPS = 2_000;

/** Relevé's 20% application fee for a given sale amount (rounded to whole cents). */
export function platformFeeCents(amountCents: number): number {
  return Math.round((amountCents * PLATFORM_FEE_BPS) / 10_000);
}

/** The artist's 80% transfer for a given sale amount (the remainder). */
export function artistTransferCents(amountCents: number): number {
  return amountCents - platformFeeCents(amountCents);
}

// ---------------------------------------------------------------------------
// The site's own base URL (F5, 2026-08-18)
// ---------------------------------------------------------------------------
//
// ── The failure this exists to prevent ──
// This helper used to return `http://localhost:3000` whenever
// NEXT_PUBLIC_SITE_URL was unset. That value is the success URL and the cancel
// URL of every Stripe Checkout session, and the return URL of the billing
// portal. If the variable were ever missing or wrong in production, the card
// would be charged, the webhook would grant the membership — and the member
// would be redirected to a machine that isn't theirs. Nothing would appear in
// any log. We would learn about it from a confused member.
//
// So a missing or nonsensical value is now a LOUD failure instead of a silent
// wrong answer. Local development is unchanged: no variable, no complaint.
//
// ── Why it does not throw at module import ──
// This module is imported by route files that Next collects during
// `next build`, where the environment may legitimately not carry the variable
// yet. Throwing at import would turn a configuration gap into a broken build,
// which is its own kind of outage. Instead the check runs when the value is
// actually NEEDED (at call time, in the server runtime) and again at boot
// (src/instrumentation.ts), which is early enough to fail a deploy before any
// member ever reaches Checkout.

/** The development fallback. Only ever returned outside production. */
export const LOCAL_SITE_URL = "http://localhost:3000";

/** Just enough of `process.env` to resolve the site URL. Injectable, for tests. */
export type SiteUrlEnv = {
  NEXT_PUBLIC_SITE_URL?: string;
  NODE_ENV?: string;
  /** Next sets this to "phase-production-build" while `next build` is running. */
  NEXT_PHASE?: string;
};

/** Thrown when production is missing a usable NEXT_PUBLIC_SITE_URL. */
export class SiteUrlNotConfiguredError extends Error {
  constructor(detail: string) {
    super(
      `NEXT_PUBLIC_SITE_URL ${detail}. Every Stripe redirect (Checkout success, ` +
        `Checkout cancel, billing-portal return) is built from it, so a wrong ` +
        `value sends paying members to a page that does not exist. Set it to the ` +
        `site's own origin — e.g. https://releveconnect.com — in the Vercel ` +
        `project environment, then redeploy.`,
    );
    this.name = "SiteUrlNotConfiguredError";
  }
}

/**
 * Pure resolver: given an environment, what is the site's base URL?
 * Extracted so the guard can be unit-tested without a server and without
 * mutating the real `process.env` (CLAUDE.md guardrail #6 — the same pattern
 * `lib/membership/access.ts` follows).
 *
 * Rules:
 *   · a usable absolute http(s) URL always wins, in every environment;
 *   · outside production, no variable means the localhost default;
 *   · in production, missing / blank / relative / non-http / localhost THROWS —
 *     except during `next build`, which must not be broken by a variable that
 *     will be present at runtime.
 */
export function resolveSiteUrl(env: SiteUrlEnv): string {
  const raw = (env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  const isProduction = env.NODE_ENV === "production";
  const isBuild = env.NEXT_PHASE === "phase-production-build";
  const enforced = isProduction && !isBuild;

  if (!raw) {
    if (enforced) throw new SiteUrlNotConfiguredError("is not set");
    return LOCAL_SITE_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    if (enforced) {
      throw new SiteUrlNotConfiguredError(`is not an absolute URL (got "${raw}")`);
    }
    return LOCAL_SITE_URL;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    if (enforced) {
      throw new SiteUrlNotConfiguredError(`must be an http(s) URL (got "${raw}")`);
    }
    return LOCAL_SITE_URL;
  }

  // A localhost value in production is the exact silent failure this guards
  // against — it is *set*, so a presence check would pass, and it is *wrong*,
  // so every member who pays lands nowhere.
  if (enforced && isLoopbackHost(parsed.hostname)) {
    throw new SiteUrlNotConfiguredError(
      `points at ${parsed.hostname}, which is a local address (got "${raw}")`,
    );
  }

  return raw.replace(/\/$/, "");
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "::1" || h === "0.0.0.0" || h.startsWith("127.");
}

/** The site's own base URL, for building Stripe redirect (success/return) links. */
export function siteUrl(): string {
  return resolveSiteUrl(process.env as SiteUrlEnv);
}

/**
 * Boot-time assertion. Called once from `src/instrumentation.ts` so a
 * misconfigured production deploy fails at start-up — visibly, in the deploy
 * log — rather than at the moment a member hands us their card. A no-op
 * outside production, and deliberately silent on success.
 */
export function assertSiteUrlConfigured(env: SiteUrlEnv = process.env as SiteUrlEnv): void {
  resolveSiteUrl(env);
}
