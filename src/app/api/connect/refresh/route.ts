// Flow A (helper) — the Account Link "refresh_url".
//
// GET /api/connect/refresh?profile=<id>
//
// Stripe sends the artist here if the single-use onboarding link expired before
// they finished. We simply mint a fresh onboarding link and redirect them back
// into it.
//
// AUTH: minting an onboarding link for an ALREADY-CONNECTED account is the most
// dangerous operation in this flow — it can be used to change the bank details
// on file. The caller must be signed in and own the profile. Stripe returns the
// artist here by top-level browser navigation, so their session cookie is sent
// normally and the check is invisible to a legitimate user.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { siteUrl } from "@/lib/stripe/config";
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

  if (!profile.stripe_account_id) {
    return NextResponse.redirect(`${base}/connect/payouts?profile=${profileId}&error=no_account`);
  }

  const accountLink = await stripe.accountLinks.create({
    account: profile.stripe_account_id,
    type: "account_onboarding",
    refresh_url: `${base}/api/connect/refresh?profile=${profile.profile_id}`,
    return_url: `${base}/api/connect/return?profile=${profile.profile_id}`,
  });

  return NextResponse.redirect(accountLink.url);
}
