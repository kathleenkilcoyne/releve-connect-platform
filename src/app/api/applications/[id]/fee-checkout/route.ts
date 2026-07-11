// The $30 application fee — a SIMPLE one-way charge to Relevé (NOT a Connect
// split; this is Relevé's own vetting-commitment fee, not a cut of anyone's wage).
//
// POST /api/applications/<applicationId>/fee-checkout
//
// Auth: the caller must be signed in AND own the application (checked via the
// cookie client under RLS). Creates a `pending` application_fee_payments row and
// a Stripe Checkout Session, then returns the URL. The webhook (kind:
// 'application_fee') finishes it: marks paid, moves the application to in-review,
// and fires the two automatic emails (EMAILS.md #1 + #2).
//
// Copy rule (pricing SSOT): the fee is "credited toward your membership when
// accepted, refunded if not accepted" — never framed as "pay to apply".

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { siteUrl } from "@/lib/stripe/config";
import { APPLICATION_FEE_CENTS } from "@/lib/membership/tiers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApplicationRow = {
  application_id: string;
  user_id: string | null;
  email: string;
  state: string;
  is_founding_25: boolean;
};

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await ctx.params;

  // 1) Who's asking? Must be signed in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }

  // 2) Load the application — RLS guarantees the caller can only see their own.
  const { data: appData } = await supabase
    .from("applications")
    .select("application_id, user_id, email, state, is_founding_25")
    .eq("application_id", applicationId)
    .maybeSingle();
  const application = appData as unknown as ApplicationRow | null;
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const db = createAdminClient();

  // 3) Idempotency: if a fee is already settled for this application, don't charge again.
  const { data: existingRows } = await db
    .from("application_fee_payments")
    .select("id, status")
    .eq("application_id", applicationId)
    .in("status", ["paid", "credited", "waived"])
    .limit(1);
  if (existingRows && existingRows.length > 0) {
    return NextResponse.json(
      { error: "This application's fee is already settled." },
      { status: 409 },
    );
  }

  // 4) Founding-25 honorees are invited — fee waived, straight into review.
  if (application.is_founding_25) {
    await db.from("application_fee_payments").insert({
      application_id: applicationId,
      user_id: user.id,
      amount_cents: 0,
      status: "waived",
      resolved_at: new Date().toISOString(),
    });
    await db
      .from("applications")
      .update({ state: "in-review", submitted_at: new Date().toISOString() })
      .eq("application_id", applicationId);
    return NextResponse.json({ waived: true });
  }

  // 5) Create the pending fee row first, so its id can travel in metadata.
  const { data: insData, error: insErr } = await db
    .from("application_fee_payments")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      amount_cents: APPLICATION_FEE_CENTS,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !insData) {
    return NextResponse.json({ error: "Could not start the application fee." }, { status: 500 });
  }
  const feeRow = insData as unknown as { id: string };

  // 6) Create the Checkout Session (one-way charge — no transfer/application_fee).
  const base = siteUrl();
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: application.email || user.email || undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: APPLICATION_FEE_CENTS,
          product_data: {
            name: "Relevé application fee",
            description: "Credited toward your membership when accepted · refunded if not accepted",
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: feeRow.id,
    success_url: `${base}/apply/submitted?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/apply?canceled=1`,
    metadata: {
      kind: "application_fee",
      application_fee_payment_id: feeRow.id,
      application_id: applicationId,
      user_id: user.id,
    },
  });

  await db
    .from("application_fee_payments")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", feeRow.id);

  return NextResponse.json({ url: session.url });
}
