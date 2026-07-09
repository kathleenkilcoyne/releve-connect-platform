// Flow A (step 1) — start Stripe Express onboarding for an artist.
//
// POST /api/connect/onboard   body: { profileId: string }
//
// Creates (once) the artist's Express connected account, stores the acct_… id on
// their talent_profile, then returns a single-use hosted-onboarding URL for the
// browser to redirect to. The artist enters their own bank/tax details on
// Stripe's page — Relevé never sees them. See spec §3.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { siteUrl } from "@/lib/stripe/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let profileId: string | undefined;
  try {
    ({ profileId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Expected JSON body { profileId }." }, { status: 400 });
  }
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required." }, { status: 400 });
  }

  const stripe = getStripe();
  const db = createAdminClient();

  // Look up the artist.
  const { data: profile, error } = await db
    .from("talent_profiles")
    .select("profile_id, display_name, stripe_account_id, payouts_enabled")
    .eq("profile_id", profileId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Talent profile not found." }, { status: 404 });
  }

  // Create the Express account once, then reuse it on subsequent visits.
  let accountId = profile.stripe_account_id as string | null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      business_type: "individual",
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      metadata: { profile_id: profile.profile_id },
    });
    accountId = account.id;

    const { error: saveErr } = await db
      .from("talent_profiles")
      .update({ stripe_account_id: accountId })
      .eq("profile_id", profile.profile_id);
    if (saveErr) {
      return NextResponse.json(
        { error: "Could not save the connected account id." },
        { status: 500 },
      );
    }
  }

  // Account Links are single-use. refresh_url is hit if the link expires before
  // they finish; return_url is where Stripe sends them when done.
  const base = siteUrl();
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${base}/api/connect/refresh?profile=${profile.profile_id}`,
    return_url: `${base}/api/connect/return?profile=${profile.profile_id}`,
  });

  return NextResponse.json({ url: accountLink.url });
}
