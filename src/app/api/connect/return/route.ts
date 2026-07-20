// Flow A (helper) — the Account Link "return_url".
//
// GET /api/connect/return?profile=<id>
//
// Where Stripe sends the artist when they finish (or leave) hosted onboarding.
// Returning here does NOT by itself mean they're ready — the source of truth is
// the account.updated webhook, which flips payouts_enabled. But we proactively
// re-fetch the account so the status is fresh even if the webhook is a moment
// behind (or, in local dev, not running).

// AUTH: the caller must be signed in and own the profile. This route is less
// dangerous than the other two (it only refreshes status from Stripe), but it
// writes payouts_enabled with the service-role client, so it is gated the same
// way rather than left as the odd one out.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { siteUrl } from "@/lib/stripe/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfileOwner } from "@/lib/connect/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const profileId = new URL(req.url).searchParams.get("profile");
  const base = siteUrl();

  if (!profileId) {
    return NextResponse.redirect(`${base}/connect/payouts?error=missing_profile`);
  }

  // ── Ownership gate ────────────────────────────────────────────────────────
  const auth = await requireProfileOwner(profileId);
  if (!auth.ok) {
    const error = auth.status === 401 ? "signin_required" : "not_authorized";
    return NextResponse.redirect(`${base}/connect/payouts?error=${error}`);
  }
  const profile = auth.profile;

  const stripe = getStripe();
  const db = createAdminClient();

  let ready = Boolean(profile.payouts_enabled);

  if (profile?.stripe_account_id) {
    try {
      const account = await stripe.accounts.retrieve(profile.stripe_account_id);
      ready = Boolean(account.charges_enabled && account.payouts_enabled);
      if (ready && !profile.payouts_enabled) {
        await db
          .from("talent_profiles")
          .update({ payouts_enabled: true })
          .eq("profile_id", profile.profile_id);
      }
    } catch {
      // Non-fatal: fall back to whatever the DB already had.
    }
  }

  return NextResponse.redirect(
    `${base}/connect/payouts?profile=${profileId}&status=${ready ? "ready" : "pending"}`,
  );
}
