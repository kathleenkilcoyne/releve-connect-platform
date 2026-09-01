// Professional Services transaction rail, Phase 1 (2026-09-01).
//
// POST /api/bookings/<availabilityId>/checkout
//
// Books ONE open service_availability window for a bookable My Service
// (professional_offerings.type in service|session, with a real price_cents) and
// creates a matching Stripe Checkout Session. Modeled directly on the working
// Signature Experience flow (/api/experiences/[workId]/checkout) — same
// destination-charge shape, same "founder pays no split" escape hatch does NOT
// apply here (there is no founder-no-split case for services; every
// Professional's own labor pays them, always).
//
// ── The split (founder-ratified 2026-09-01) ──
// Buyer is charged price_cents + the Relevé booking fee (service_platform_fee_bps,
// currently 300 = 3%), ON TOP of the Professional's price — never a cut of it.
// application_fee_amount = the fee only; transfer_data.destination + on_behalf_of
// mean the Professional's connected account settles the full price_cents, with
// Stripe's own processing fee coming out of THEIR settlement (existing policy,
// same as Signature Experience) — Relevé's fee is a clean pass-through, not
// diluted by card processing on either side.
//
// ── No double-booking ──
// The window is atomically transitioned open → held via an UPDATE …WHERE
// status='open', so two buyers racing for the same slot: only one wins the row;
// the loser gets a clear "no longer available" instead of a silent double-sell.
// A held-but-abandoned checkout is released by the webhook's
// checkout.session.expired handler (Stripe's own 24h default), or immediately by
// GET /api/bookings/cancel/<bookingId> when the buyer clicks Cancel.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { siteUrl } from "@/lib/stripe/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServicePlatformFeeBps } from "@/lib/bookings/config";
import { isOfferingBookable, computeServiceFeeBreakdown, type OfferingType } from "@/lib/offerings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WindowRow = {
  id: string;
  profile_id: string;
  offering_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
};

type OfferingRow = {
  id: string;
  type: OfferingType;
  title: string;
  price_cents: number | null;
  status: string;
};

type ArtistRow = {
  profile_id: string;
  user_id: string;
  display_name: string | null;
  public_slug: string | null;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
};

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ availabilityId: string }> },
) {
  const { availabilityId } = await ctx.params;
  const base = siteUrl();

  // ── AUTH: booking on Relevé requires a signed-in buyer ─────────────────────
  const supabase = await createClient();
  const {
    data: { user: buyer },
  } = await supabase.auth.getUser();
  if (!buyer) {
    return NextResponse.json({ error: "Please sign in to book." }, { status: 401 });
  }

  const db = createAdminClient();

  // ── Load the window + its offering + the artist's payout status ────────────
  const { data: windowData, error: windowErr } = await db
    .from("service_availability")
    .select("id, profile_id, offering_id, starts_at, ends_at, status")
    .eq("id", availabilityId)
    .maybeSingle();
  if (windowErr) return NextResponse.json({ error: windowErr.message }, { status: 500 });
  const window = windowData as WindowRow | null;
  if (!window) {
    return NextResponse.json({ error: "That time is no longer available." }, { status: 404 });
  }
  if (!window.offering_id) {
    // A window carrying service_id (the dead Professional Services path) is not
    // bookable through this rail — Phase 1 only wires My Services.
    return NextResponse.json({ error: "That time isn't bookable." }, { status: 409 });
  }
  if (new Date(window.ends_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "That time has already passed." }, { status: 409 });
  }

  const { data: offeringData, error: offeringErr } = await db
    .from("professional_offerings")
    .select("id, type, title, price_cents, status")
    .eq("id", window.offering_id)
    .maybeSingle();
  if (offeringErr) return NextResponse.json({ error: offeringErr.message }, { status: 500 });
  const offering = offeringData as OfferingRow | null;
  if (!offering || offering.status !== "active") {
    return NextResponse.json({ error: "That offering is no longer available." }, { status: 409 });
  }
  if (!isOfferingBookable({ type: offering.type, priceCents: offering.price_cents })) {
    return NextResponse.json({ error: "That offering isn't set up for booking yet." }, { status: 409 });
  }

  const { data: artistData, error: artistErr } = await db
    .from("talent_profiles")
    .select("profile_id, user_id, display_name, public_slug, stripe_account_id, payouts_enabled")
    .eq("profile_id", window.profile_id)
    .maybeSingle();
  if (artistErr) return NextResponse.json({ error: artistErr.message }, { status: 500 });
  const artist = artistData as ArtistRow | null;
  if (!artist) {
    return NextResponse.json({ error: "Professional not found." }, { status: 404 });
  }
  if (artist.user_id === buyer.id) {
    return NextResponse.json({ error: "You can't book your own offering." }, { status: 403 });
  }
  if (!artist.stripe_account_id || !artist.payouts_enabled) {
    return NextResponse.json(
      { error: "This professional hasn't finished connecting payouts yet." },
      { status: 409 },
    );
  }

  // ── The fee, and the guardrail from the original schema comment: refuse to
  //    charge when the rate isn't configured, rather than assume one. ────────
  const feeBps = await getServicePlatformFeeBps(db);
  const breakdown = computeServiceFeeBreakdown({
    priceCents: offering.price_cents as number,
    feeBps,
  });
  if (!breakdown) {
    console.error("[bookings checkout] refusing to charge — no service_platform_fee_bps configured");
    return NextResponse.json({ error: "Booking isn't available right now." }, { status: 409 });
  }

  // ── Claim the window atomically: open -> held. A concurrent buyer loses this
  //    race cleanly instead of both proceeding to checkout. ──────────────────
  const { data: claimed, error: claimErr } = await db
    .from("service_availability")
    .update({ status: "held", updated_at: new Date().toISOString() })
    .eq("id", availabilityId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 });
  if (!claimed) {
    return NextResponse.json({ error: "That time was just booked by someone else." }, { status: 409 });
  }

  const durationMinutes = Math.round(
    (new Date(window.ends_at).getTime() - new Date(window.starts_at).getTime()) / 60_000,
  );

  // ── Create the pending booking BEFORE the Stripe session, so its id can
  //    travel in metadata (same ordering as the Signature Experience flow). ──
  const { data: bookingData, error: bookingInsertErr } = await db
    .from("service_bookings")
    .insert({
      availability_id: availabilityId,
      offering_id: offering.id,
      profile_id: artist.profile_id,
      buyer_user_id: buyer.id,
      buyer_email: buyer.email ?? null,
      amount_cents: breakdown.priceCents,
      duration_minutes: durationMinutes,
      platform_fee_bps: feeBps,
      application_fee_cents: breakdown.buyerFeeCents,
      professional_transfer_cents: breakdown.professionalTransferCents,
      status: "pending",
      payment_status: "unpaid",
    })
    .select("id")
    .single();
  if (bookingInsertErr || !bookingData) {
    // Release the hold — the booking row is the point of no return, not the claim.
    await db
      .from("service_availability")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", availabilityId)
      .eq("status", "held");
    return NextResponse.json({ error: "Could not start the booking." }, { status: 500 });
  }
  const booking = bookingData as { id: string };

  // ── The Stripe Checkout Session ─────────────────────────────────────────────
  const stripe = getStripe();
  const handle = artist.public_slug ?? "";
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: breakdown.buyerTotalCents,
            product_data: {
              name: offering.title,
              description: `Booking with ${artist.display_name ?? "your Relevé professional"}`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: breakdown.buyerFeeCents,
        transfer_data: { destination: artist.stripe_account_id as string },
        on_behalf_of: artist.stripe_account_id as string,
      },
      client_reference_id: booking.id,
      customer_email: buyer.email ?? undefined,
      success_url: `${base}/${handle}?booked=1`,
      cancel_url: `${base}/api/bookings/cancel/${booking.id}`,
      metadata: {
        kind: "service_booking",
        booking_id: booking.id,
        availability_id: availabilityId,
        offering_id: offering.id,
      },
    });
  } catch (err) {
    console.error("[bookings checkout] Stripe session creation failed:", err);
    // Release the hold and drop the pending booking — nothing to show for a
    // Stripe-side failure.
    await db
      .from("service_availability")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", availabilityId)
      .eq("status", "held");
    await db.from("service_bookings").delete().eq("id", booking.id);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }

  await db
    .from("service_bookings")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", booking.id);

  return NextResponse.json({ url: session.url });
}
