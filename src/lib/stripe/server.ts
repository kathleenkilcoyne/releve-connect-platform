// Server-side Stripe client — SERVER ONLY. Never import this into browser code
// (it uses the secret key). Used by the Connect onboarding routes, the checkout
// route, and the webhook.

import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add your Stripe test secret key (sk_test_…) " +
        "to .env.local — see docs/STRIPE-CONNECT-499-LICENSING.md §1.",
    );
  }

  // No apiVersion pinned on purpose: we use the account's default pinned version
  // so a founder-owned test build never breaks on a version-string mismatch.
  // Pin it later (in the Stripe dashboard) before going live if you want.
  cached = new Stripe(key);
  return cached;
}
