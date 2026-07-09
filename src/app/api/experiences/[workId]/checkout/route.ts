// Flow B — buy the $499 Signature Experience (destination charge).
//
// POST /api/experiences/<workId>/checkout
//
// Creates a Stripe Checkout Session for one published signature_work and a
// matching `pending` experience_purchase row. Two paths:
//   • Split path (default): destination charge — 80% routes to the artist's
//     connected account, 20% stays with Relevé as an application_fee. Requires
//     the artist to have finished Express onboarding (payouts_enabled = true).
//   • Founder no-split path: for works whose artist profile id is listed in
//     FOUNDER_PROFILE_ID (Kathleen is artist AND platform — she keeps 100%).
//     This is the path the spec's build order proves first.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { platformFeeCents, artistTransferCents, siteUrl } from "@/lib/stripe/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Profile ids that sell WITHOUT a Connect split (founder is artist + platform). */
function isFounderProfile(profileId: string): boolean {
  const list = (process.env.FOUNDER_PROFILE_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(profileId);
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ workId: string }> },
) {
  const { workId } = await ctx.params;
  const base = siteUrl();
  const stripe = getStripe();
  const db = createAdminClient();

  // Load the work + its artist (need the connected account + payout status).
  // The Supabase client is untyped (no generated Database types), so we cast the
  // embedded-join result to an explicit shape.
  type ArtistJoin = {
    profile_id: string;
    display_name: string | null;
    stripe_account_id: string | null;
    payouts_enabled: boolean;
  };
  type WorkRow = {
    id: string;
    title: string;
    price_cents: number;
    status: string;
    profile_id: string;
    talent_profiles: ArtistJoin | ArtistJoin[];
  };

  const { data, error } = await db
    .from("signature_works")
    .select(
      "id, title, price_cents, status, profile_id, " +
        "talent_profiles!inner(profile_id, display_name, stripe_account_id, payouts_enabled)",
    )
    .eq("id", workId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Signature work not found." }, { status: 404 });
  }
  const work = data as unknown as WorkRow;
  if (work.status !== "published") {
    return NextResponse.json({ error: "This work is not published for sale." }, { status: 409 });
  }

  // supabase returns the joined row as an object (or array); normalize.
  const artist = Array.isArray(work.talent_profiles)
    ? work.talent_profiles[0]
    : work.talent_profiles;

  const founder = isFounderProfile(work.profile_id);
  const amount = work.price_cents as number;

  // Guardrail: no one but the founder can sell until payouts are enabled.
  if (!founder && !artist?.payouts_enabled) {
    return NextResponse.json(
      { error: "This artist hasn't finished connecting payouts yet." },
      { status: 409 },
    );
  }
  if (!founder && !artist?.stripe_account_id) {
    return NextResponse.json(
      { error: "This artist has no connected payout account." },
      { status: 409 },
    );
  }

  const applicationFee = founder ? 0 : platformFeeCents(amount);
  const artistTransfer = founder ? amount : artistTransferCents(amount);

  // 1) Create the pending purchase row first, so its id can travel in metadata
  //    and the webhook can find it deterministically.
  const { data: insData, error: insErr } = await db
    .from("experience_purchases")
    .insert({
      signature_work_id: work.id,
      amount_cents: amount,
      application_fee_cents: applicationFee,
      artist_transfer_cents: artistTransfer,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !insData) {
    return NextResponse.json({ error: "Could not start the purchase." }, { status: 500 });
  }
  const purchase = insData as unknown as { id: string };

  // 2) Create the Checkout Session.
  const paymentIntentData = founder
    ? undefined
    : {
        application_fee_amount: applicationFee,
        transfer_data: { destination: artist!.stripe_account_id as string },
      };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: { name: `Signature Experience — ${work.title}` },
        },
        quantity: 1,
      },
    ],
    ...(paymentIntentData ? { payment_intent_data: paymentIntentData } : {}),
    client_reference_id: purchase.id,
    success_url: `${base}/experiences/${work.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/experiences/${work.id}?canceled=1`,
    metadata: {
      experience_purchase_id: purchase.id,
      signature_work_id: work.id,
      artist_profile_id: work.profile_id,
    },
  });

  // 3) Record the session id on the pending row.
  await db
    .from("experience_purchases")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", purchase.id);

  return NextResponse.json({ url: session.url });
}
