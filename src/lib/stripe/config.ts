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

/** The site's own base URL, for building Stripe redirect (success/return) links. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
}
