// Subscribe to a membership — an AUTO-RENEWING ANNUAL Stripe subscription.
//
// POST /api/membership/checkout   body: { tier: "professional" | "professional_full" | … }
//
// Rules:
//   • Vetted tiers (Professional / Professional·Full) require an APPROVED
//     application. Non-vetted tiers (Live Pass, studios) don't.
//   • If the applicant PAID the $30 fee, it's CREDITED here — a one-time $30-off
//     coupon on the first invoice — and the fee row is marked 'credited' by the
//     webhook once payment succeeds. (Founding-25 waived → no credit, nothing paid.)
//   • Billing is annual and auto-renews; the UI discloses that and offers
//     one-click cancel via the billing portal (/api/membership/portal).

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { siteUrl } from "@/lib/stripe/config";
import { getTier, stripePriceId, type TierSlug } from "@/lib/membership/tiers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A stable one-time "$30 application-fee credit" coupon (create-once, reused). */
async function appFeeCreditCouponId(stripe: ReturnType<typeof getStripe>): Promise<string> {
  const id = "releve_app_fee_credit_30";
  try {
    const c = await stripe.coupons.retrieve(id);
    return c.id;
  } catch {
    const c = await stripe.coupons.create({
      id,
      amount_off: 3000,
      currency: "usd",
      duration: "once",
      name: "Application fee credit",
    });
    return c.id;
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  let body: { tier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const tier = getTier(body.tier ?? "");
  if (!tier) return NextResponse.json({ error: "Unknown membership tier." }, { status: 400 });

  const priceId = stripePriceId(tier.slug as TierSlug);
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe Price configured for ${tier.label}. Run scripts/setup-stripe-tiers.mjs.` },
      { status: 503 },
    );
  }

  const db = createAdminClient();

  // ---- Gate: vetted tiers require an APPROVED application -------------------
  let creditFeeId: string | null = null;
  if (tier.applicationRequired) {
    const { data: appRow } = await db
      .from("applications")
      .select("application_id, state")
      .eq("user_id", user.id)
      .eq("state", "approved")
      .maybeSingle();
    if (!appRow) {
      return NextResponse.json(
        { error: "This tier is for approved members. Your application isn't approved yet." },
        { status: 403 },
      );
    }
    // If they paid the $30, it gets credited on the first invoice.
    const { data: feeRow } = await db
      .from("application_fee_payments")
      .select("id, status")
      .eq("application_id", (appRow as { application_id: string }).application_id)
      .eq("status", "paid")
      .maybeSingle();
    if (feeRow) creditFeeId = (feeRow as { id: string }).id;
  }

  // ---- Reuse (or create) this member's Stripe customer ---------------------
  const { data: existingMemberships } = await db
    .from("memberships")
    .select("membership_id, tier, stripe_customer_id, membership_status")
    .eq("user_id", user.id);
  const rows = (existingMemberships ?? []) as Array<{
    membership_id: string;
    tier: string;
    stripe_customer_id: string | null;
    membership_status: string;
  }>;

  // Already actively subscribed to THIS tier? Don't double-charge.
  if (rows.some((m) => m.tier === tier.slug && m.membership_status === "active")) {
    return NextResponse.json({ error: `You already have an active ${tier.label} membership.` }, { status: 409 });
  }

  const stripe = getStripe();
  let customerId = rows.find((m) => m.stripe_customer_id)?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { releve_user_id: user.id },
    });
    customerId = customer.id;
  }

  // ---- Upsert a PENDING membership row (webhook flips it active) -----------
  const reuse = rows.find((m) => m.tier === tier.slug);
  let membershipId: string;
  if (reuse) {
    membershipId = reuse.membership_id;
    await db
      .from("memberships")
      .update({ stripe_customer_id: customerId, price_cents: tier.priceCents, membership_status: "pending", updated_at: new Date().toISOString() })
      .eq("membership_id", membershipId);
  } else {
    const { data: ins, error: insErr } = await db
      .from("memberships")
      .insert({
        user_id: user.id,
        tier: tier.slug,
        price_cents: tier.priceCents,
        term: "annual",
        stripe_customer_id: customerId,
        membership_status: "pending",
        source: "self_subscribe",
      })
      .select("membership_id")
      .single();
    if (insErr || !ins) {
      return NextResponse.json({ error: "Could not start the subscription." }, { status: 500 });
    }
    membershipId = (ins as { membership_id: string }).membership_id;
  }

  // ---- Create the subscription Checkout Session ----------------------------
  const base = siteUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    ...(creditFeeId ? { discounts: [{ coupon: await appFeeCreditCouponId(stripe) }] } : {}),
    client_reference_id: user.id,
    success_url: `${base}/subscribe/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/subscribe?canceled=1`,
    metadata: {
      kind: "membership",
      membership_id: membershipId,
      user_id: user.id,
      tier: tier.slug,
      credit_fee_id: creditFeeId ?? "",
    },
  });

  return NextResponse.json({ url: session.url });
}
