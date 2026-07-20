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
import {
  bookingLinks,
  sendBuyerExperienceConfirmation,
  addBuyerToClimb,
  sendApplicationReceived,
  sendAdminNewApplicationAlert,
  sendMembershipActive,
  sendRenewalReminder,
  APPLICATION_FEE_NOTE,
} from "@/lib/notifications";
import { siteUrl } from "@/lib/stripe/config";
import { getTier, dollars } from "@/lib/membership/tiers";
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

  // Idempotency gate. Stripe delivers events at-least-once (5xx retries, manual
  // re-sends), so skip any event id we've already finished. The per-row status
  // guards inside each handler are the second layer — fulfillment is doubly
  // idempotent. (If processed_stripe_events isn't migrated yet, this degrades
  // gracefully: the select returns no row and we fall back to those guards.)
  const events = createAdminClient();
  const { data: alreadyProcessed } = await events
    .from("processed_stripe_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, deduped: true });
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
      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "invoice.upcoming":
        await handleInvoiceUpcoming(event.data.object as Stripe.Invoice);
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

  // Record the event only AFTER successful handling, so a failed handler (which
  // returned 500 above → Stripe retries) is free to run again. A PK conflict
  // from a concurrent redelivery is harmless — the row is already there.
  await events.from("processed_stripe_events").insert({ event_id: event.id });

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------
async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  // A session can complete before payment settles (async methods). Only grant on
  // a truly paid session.
  if (session.payment_status !== "paid") return;

  // Route by what was bought. The $30 application fee is a separate flow from the
  // $499 Signature Experience; both arrive as checkout.session.completed.
  if (session.metadata?.kind === "application_fee") {
    await handleApplicationFeePaid(session);
    return;
  }
  if (session.metadata?.kind === "membership") {
    await handleMembershipCheckout(stripe, session);
    return;
  }

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

// ---------------------------------------------------------------------------
// checkout.session.completed — the $30 application fee (kind: 'application_fee')
// ---------------------------------------------------------------------------
async function handleApplicationFeePaid(session: Stripe.Checkout.Session) {
  const db = createAdminClient();
  const feeId =
    (session.metadata?.application_fee_payment_id as string | undefined) ??
    (session.client_reference_id ?? undefined);

  const query = db.from("application_fee_payments").select("*").limit(1);
  const { data: found } = feeId
    ? await query.eq("id", feeId)
    : await query.eq("stripe_checkout_session_id", session.id);
  const fee = found?.[0];

  if (!fee) {
    console.error("[stripe webhook] no application_fee_payment for session", session.id);
    return;
  }
  if (fee.status === "paid") return; // idempotent: already handled

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // 1) Mark the fee paid.
  await db
    .from("application_fee_payments")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", fee.id);

  // 2) Move the application into review (only from a pre-review state).
  const { data: appData } = await db
    .from("applications")
    .select("application_id, email, first_name, roles, state")
    .eq("application_id", fee.application_id)
    .single();
  if (appData && ["draft", "submitted"].includes(appData.state as string)) {
    await db
      .from("applications")
      .update({
        state: "in-review",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("application_id", fee.application_id);
  }

  // 3) The two automatic emails (EMAILS.md #1 + #2).
  //
  // DORMANT during the free founding period: with no fee, this handler never
  // runs, and the same two emails are sent from submitApplication instead. Kept
  // wired (with the approved fee wording) so switching payment back on is a
  // one-line change in the form rather than a rebuild of this branch.
  if (appData) {
    await sendApplicationReceived({
      to: appData.email as string,
      firstName: (appData.first_name as string | null) ?? null,
      feeNote: APPLICATION_FEE_NOTE,
    });
    await sendAdminNewApplicationAlert({
      applicantEmail: appData.email as string,
      applicantName: (appData.first_name as string | null) ?? null,
      roles: (appData.roles as string[] | null) ?? [],
      reviewUrl: `${siteUrl()}/admin/applications`,
    });
  }
}

// Stripe moved `current_period_end` (now on the subscription item) and
// `invoice.subscription` (now under invoice.parent) in recent API versions.
// The account's pinned version may be either, so read both shapes defensively.
function subCurrentPeriodEnd(sub: Stripe.Subscription): number | null {
  const s = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  return s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? null;
}
function invoiceSubId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    subscription?: string | { id?: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } };
  };
  const raw = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
  return !raw ? null : typeof raw === "string" ? raw : raw.id ?? null;
}

// ---------------------------------------------------------------------------
// checkout.session.completed — a membership subscription (kind: 'membership')
// ---------------------------------------------------------------------------
async function handleMembershipCheckout(stripe: Stripe, session: Stripe.Checkout.Session) {
  const db = createAdminClient();
  const membershipId = session.metadata?.membership_id as string | undefined;
  const creditFeeId = (session.metadata?.credit_fee_id as string | undefined) || null;
  const subId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const now = new Date().toISOString();

  // Renewal date = the subscription's current period end.
  let renewalIso: string | null = null;
  if (subId) {
    const sub = await stripe.subscriptions.retrieve(subId);
    const periodEnd = subCurrentPeriodEnd(sub);
    if (periodEnd) renewalIso = new Date(periodEnd * 1000).toISOString();
  }

  const { data: mData } = membershipId
    ? await db.from("memberships").select("*").eq("membership_id", membershipId).maybeSingle()
    : { data: null };
  const membership = mData as
    | { membership_id: string; tier: string; membership_status: string; stripe_subscription_id: string | null; price_cents: number | null }
    | null;
  if (!membership) {
    console.error("[stripe webhook] no membership for session", session.id);
    return;
  }
  if (membership.membership_status === "active" && membership.stripe_subscription_id === subId) return; // idempotent

  await db
    .from("memberships")
    .update({
      membership_status: "active",
      stripe_subscription_id: subId,
      stripe_customer_id: customerId,
      renewal_date: renewalIso,
      updated_at: now,
    })
    .eq("membership_id", membership.membership_id);

  // Credit the $30 application fee (accepted AND now subscribed).
  if (creditFeeId) {
    await db
      .from("application_fee_payments")
      .update({ status: "credited", resolved_at: now, updated_at: now })
      .eq("id", creditFeeId)
      .eq("status", "paid");
  }

  // Email #7 — membership active (with the auto-renew disclosure + manage link).
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  if (email) {
    const tier = getTier(membership.tier);
    await sendMembershipActive({
      to: email,
      tierLabel: tier?.label ?? membership.tier,
      priceLabel: `${dollars(tier?.priceCents ?? membership.price_cents ?? 0)}/year`,
      manageUrl: `${siteUrl()}/subscribe`,
    });
  }
}

// customer.subscription.deleted → membership canceled ------------------------
async function handleSubscriptionCanceled(sub: Stripe.Subscription) {
  const db = createAdminClient();
  await db
    .from("memberships")
    .update({ membership_status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id);
}

// invoice.payment_failed → membership lapsed ---------------------------------
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subId = invoiceSubId(invoice);
  if (!subId) return;
  const db = createAdminClient();
  await db
    .from("memberships")
    .update({ membership_status: "lapsed", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId);
}

// invoice.upcoming → renewal reminder (~2 weeks out; lead time set in Stripe) -
async function handleInvoiceUpcoming(invoice: Stripe.Invoice) {
  const email = invoice.customer_email;
  if (!email) return;
  const renewalDate = invoice.next_payment_attempt
    ? new Date(invoice.next_payment_attempt * 1000).toDateString()
    : "soon";
  await sendRenewalReminder({
    to: email,
    amountLabel: dollars(invoice.amount_due),
    renewalDate,
    manageUrl: `${siteUrl()}/subscribe`,
  });
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

  // Also cover the $30 application fee (refunded when an applicant is NOT
  // accepted). Only touch a fee that was actually paid, and don't overwrite a
  // 'credited' one. Idempotent.
  await db
    .from("application_fee_payments")
    .update({
      status: "refunded",
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("status", "paid");
}
