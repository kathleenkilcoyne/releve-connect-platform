// Flow A (helper) — the Account Link "refresh_url".
//
// GET /api/connect/refresh?profile=<id>
//
// Stripe sends the artist here if the single-use onboarding link expired before
// they finished. We simply mint a fresh onboarding link and redirect them back
// into it.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { siteUrl } from "@/lib/stripe/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const profileId = new URL(req.url).searchParams.get("profile");
  const base = siteUrl();

  if (!profileId) {
    return NextResponse.redirect(`${base}/connect/payouts?error=missing_profile`);
  }

  const stripe = getStripe();
  const db = createAdminClient();

  const { data: profile } = await db
    .from("talent_profiles")
    .select("profile_id, stripe_account_id")
    .eq("profile_id", profileId)
    .single();

  if (!profile?.stripe_account_id) {
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
