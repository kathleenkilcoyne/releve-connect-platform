// Professional activation — the $30 that begins a member's Professional access.
//
// POST /api/professional/activation-checkout
//
// The FIRST money toward membership (NOT an application fee): a signed-in, APPROVED
// professional pays $30 to open a 60-day Professional access window. The $30 is
// credited toward the continuing subscription if they continue within the window
// (the webhook records the activation; the continuing-subscription slice applies
// the credit). Creates a `pending` activations row + a Stripe Checkout session and
// returns the URL.
//
// VETTING IS NEVER TOUCHED HERE — this reads `applications.state` only to confirm
// the caller is already approved; it never writes it. Payment ≠ acceptance.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { siteUrl } from "@/lib/stripe/config";
import { ACTIVATION_FEE_CENTS } from "@/lib/membership/activation";
import { isProfessionalApplicant } from "@/lib/membership/families";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const db = createAdminClient();

  // Must be an APPROVED professional (vetting decides Roster membership; this only
  // activates an already-approved professional). Explicit talent-role check.
  const { data: appRow } = await db
    .from("applications")
    .select("application_id, roles, state")
    .eq("user_id", user.id)
    .eq("state", "approved")
    .maybeSingle();
  const application = appRow as
    | { application_id: string; roles: string[] | null; state: string }
    | null;
  if (!application) {
    return NextResponse.json(
      { error: "Activation is for approved professionals." },
      { status: 403 },
    );
  }
  if (!isProfessionalApplicant(application.roles)) {
    return NextResponse.json(
      { error: "This activation is for the Professional Roster." },
      { status: 403 },
    );
  }

  // Already actively/continuing activated? Don't double-charge.
  const { data: existing } = await db
    .from("activations")
    .select("activation_id, status")
    .eq("user_id", user.id)
    .eq("membership_family", "professional")
    .in("status", ["active", "converted"])
    .limit(1);
  if (existing && (existing as unknown[]).length > 0) {
    return NextResponse.json({ error: "Your Professional access is already active." }, { status: 409 });
  }

  // Create the pending activation row first, so its id can travel in metadata and
  // the webhook can find it. status/credit_status take their table defaults
  // ('pending' / 'available'); the window opens only when payment lands.
  const { data: insData, error: insErr } = await db
    .from("activations")
    .insert({
      membership_family: "professional",
      user_id: user.id,
      application_id: application.application_id,
      amount_cents: ACTIVATION_FEE_CENTS,
      credit_cents: ACTIVATION_FEE_CENTS,
      status: "pending",
    })
    .select("activation_id")
    .single();
  if (insErr || !insData) {
    return NextResponse.json({ error: "Could not start activation." }, { status: 500 });
  }
  const activationId = (insData as { activation_id: string }).activation_id;

  // One-way $30 charge (no Connect split — this is Relevé's own activation).
  const base = siteUrl();
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: ACTIVATION_FEE_CENTS,
          product_data: {
            name: "Relevé Professional activation",
            description:
              "Begins 60 days of Professional access · credited toward your continuing subscription",
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: activationId,
    success_url: `${base}/profile?activated=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/subscribe?canceled=1`,
    metadata: {
      kind: "professional_activation",
      activation_id: activationId,
      user_id: user.id,
    },
  });

  await db
    .from("activations")
    .update({ stripe_checkout_session_id: session.id })
    .eq("activation_id", activationId);

  return NextResponse.json({ url: session.url });
}
