// Professional Services transaction rail, Phase 1 (2026-09-01).
//
// GET /api/bookings/cancel/<bookingId> — the checkout route's
// `cancel_url`. Stripe sends the buyer here when they click "back"/cancel on
// the Checkout page. Without this, an abandoned checkout would leave the window
// `held` (looking unavailable to everyone else) for up to Stripe's 24h session
// expiry before the webhook's checkout.session.expired handler releases it — an
// obvious, immediate cancel deserves an immediate release, not a 24h wait.
//
// Idempotent and safe to hit more than once (a refresh, a slow double-click):
// only acts on a booking still `pending`/`unpaid`; a booking the webhook has
// already confirmed (a real race — the buyer paid, THEN somehow also hit
// cancel) is never touched here.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { siteUrl } from "@/lib/stripe/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BookingRow = {
  id: string;
  availability_id: string;
  profile_id: string;
  status: string;
  payment_status: string;
  stripe_checkout_session_id: string | null;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await ctx.params;
  const db = createAdminClient();

  const { data } = await db
    .from("service_bookings")
    .select("id, availability_id, profile_id, status, payment_status, stripe_checkout_session_id")
    .eq("id", bookingId)
    .maybeSingle();
  const booking = data as BookingRow | null;

  // Best-effort: send the buyer back to the professional's own page, not the
  // homepage, so "cancel" doesn't strand them somewhere unrelated.
  let redirectPath = "/";
  if (booking) {
    const { data: artist } = await db
      .from("talent_profiles")
      .select("public_slug")
      .eq("profile_id", booking.profile_id)
      .maybeSingle();
    const slug = (artist as { public_slug: string | null } | null)?.public_slug;
    if (slug) redirectPath = `/${slug}`;
  }

  if (booking && booking.status === "pending" && booking.payment_status === "unpaid") {
    // Best-effort: tell Stripe the session is done too, so a stale success
    // redirect can't complete it later. Never block the release on this.
    if (booking.stripe_checkout_session_id) {
      try {
        await getStripe().checkout.sessions.expire(booking.stripe_checkout_session_id);
      } catch {
        // Already expired/completed, or a transient Stripe error — release the
        // hold regardless; the webhook's own idempotent handlers are the
        // backstop if this races with a real payment.
      }
    }

    await db
      .from("service_bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "buyer",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .eq("status", "pending");

    await db
      .from("service_availability")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", booking.availability_id)
      .eq("status", "held");
  }

  const separator = redirectPath.includes("?") ? "&" : "?";
  return NextResponse.redirect(`${siteUrl()}${redirectPath}${separator}booking_canceled=1`, {
    status: 303,
  });
}
