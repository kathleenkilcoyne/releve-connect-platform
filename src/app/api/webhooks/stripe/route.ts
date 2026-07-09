// Flow C — Stripe webhook. The ONLY place that grants access or money moves are
// recorded. Runs as the service_role (bypasses RLS) via the admin client.
//
// POST /api/webhooks/stripe
//
// Events handled:
//   • checkout.session.completed      → purchase paid; create/attach the buyer's
//                                        Access account; grant access; notify.
//   • account.updated                 → flip talent_profiles.payouts_enabled once
//                                        Stripe says the artist can be paid (Flow A).
//   • payment_intent.payment_failed   → mark the purchase failed.
//   • charge.refunded                 → mark refunded and revoke access.
//
// Signature is verified with STRIPE_WEBHOOK_SIGNING_SECRET over the RAW body.
// Every branch is idempotent — Stripe may deliver an event more than once.

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { bookingLinks, sendBuyerExperienceConfirmation, addBuyerToClimb } from "@/lib/notifications";
import { siteUrl } from "@/lib/stripe/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SIGNING_SECRET is not set.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", secret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        // Unhandled event types are fine — acknowledge so Stripe stops retrying.
        break;
    }
  } catch (err) {
    // Return 500 so Stripe retries; our handlers are idempotent so that's safe.
    console.error(`[stripe webhook] handler for ${event.type} failed:`, err);
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------
async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  // A session can complete before payment settles (async methods). Only grant on
  // a truly paid session.
  if (session.payment_status !== "paid") return;

  const db = createAdminClient();
  const purchaseId =
    (session.metadata?.experience_purchase_id as string | undefined) ??
    (session.client_reference_id ?? undefined);

  // Find the pending purchase (prefer the id from metadata, fall back to session).
  const query = db.from("experience_purchases").select("*").limit(1);
  const { data: found } = purchaseId
    ? await query.eq("id", purchaseId)
    : await query.eq("stripe_checkout_session_id", session.id);
  const purchase = found?.[0];

  if (!purchase) {
    console.error("[stripe webhook] no experience_purchase for session", session.id);
    return;
  }
  if (purchase.status === "paid") return; // idempotent: already handled

  const buyerEmail =
    session.customer_details?.email ?? session.customer_email ?? purchase.buyer_email ?? null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // 1) Create/attach the buyer's Access account.
  let buyerUserId: string | null = purchase.buyer_user_id ?? null;
  if (!buyerUserId && buyerEmail) {
    buyerUserId = await ensureBuyerUser(db, buyerEmail);
  }

  // 2) Bundle a free Year-1 Access membership (idempotent per user).
  if (buyerUserId) {
    await ensureAccessMembership(db, buyerUserId);
  }

  // 3) Mark the purchase paid + grant access.
  await db
    .from("experience_purchases")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      buyer_email: buyerEmail,
      buyer_user_id: buyerUserId,
      access_granted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchase.id);

  // 4) Notify (best-effort seams — never fail the webhook).
  if (buyerEmail) {
    const { data: work } = await db
      .from("signature_works")
      .select("title")
      .eq("id", purchase.signature_work_id)
      .single();
    const links = bookingLinks();
    await sendBuyerExperienceConfirmation({
      to: buyerEmail,
      workTitle: work?.title ?? "Signature Experience",
      experienceUrl: `${siteUrl()}/experiences/${purchase.signature_work_id}?session_id=${session.id}`,
      founderWelcomeUrl: links.founderWelcomeUrl,
      checkinUrl: links.checkinUrl,
    });
    await addBuyerToClimb(buyerEmail);
  }
}

/**
 * Return a public.users id for this email, creating the auth user + profile row
 * if needed. NOTE: buyers are individual "Access" members; the users table has
 * no dedicated member type, so we file them under account_type 'talent' (the
 * individual side of the two-sided model). Flagged as an open modeling question
 * in DECISIONS.md.
 */
async function ensureBuyerUser(
  db: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const { data: existing } = await db
    .from("users")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  if (existing?.user_id) return existing.user_id;

  // Create a real Supabase auth user (so a magic-link login works later), then
  // mirror it into public.users. email_confirm:true = no password; they sign in
  // via magic link. (The invite/welcome email is a seam — see notifications.ts.)
  const { data: created, error: authErr } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (authErr || !created?.user) {
    console.error("[stripe webhook] could not create auth user for", email, authErr);
    return null;
  }

  const { error: rowErr } = await db.from("users").insert({
    user_id: created.user.id,
    email,
    account_type: "talent",
    status: "active",
  });
  if (rowErr) {
    console.error("[stripe webhook] could not insert users row for", email, rowErr);
    return null;
  }
  return created.user.id;
}

/** Create a free Year-1 Access membership if the buyer doesn't already have one. */
async function ensureAccessMembership(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data: existing } = await db
    .from("memberships")
    .select("membership_id")
    .eq("user_id", userId)
    .eq("tier", "access")
    .maybeSingle();
  if (existing) return;

  const renewal = new Date();
  renewal.setFullYear(renewal.getFullYear() + 1);

  await db.from("memberships").insert({
    user_id: userId,
    tier: "access",
    price_cents: 0, // Year 1 free — bundled with the $499 experience
    term: "annual",
    membership_status: "active",
    renewal_date: renewal.toISOString(),
    source: "signature_experience_bundle",
  });
}

// ---------------------------------------------------------------------------
// account.updated (Flow A)
// ---------------------------------------------------------------------------
async function handleAccountUpdated(account: Stripe.Account) {
  if (!(account.charges_enabled && account.payouts_enabled)) return;

  const db = createAdminClient();
  await db
    .from("talent_profiles")
    .update({ payouts_enabled: true })
    .eq("stripe_account_id", account.id);
}

// ---------------------------------------------------------------------------
// payment_intent.payment_failed
// ---------------------------------------------------------------------------
async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  const db = createAdminClient();
  await db
    .from("experience_purchases")
    .update({ status: "failed", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", pi.id)
    .neq("status", "paid");
}

// ---------------------------------------------------------------------------
// charge.refunded → revoke access
// ---------------------------------------------------------------------------
async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  if (!paymentIntentId) return;

  const db = createAdminClient();
  await db
    .from("experience_purchases")
    .update({
      status: "refunded",
      access_granted_at: null, // revoke access
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", paymentIntentId);
}
