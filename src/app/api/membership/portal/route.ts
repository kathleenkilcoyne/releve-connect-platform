// One-click "manage / cancel my membership" — opens the Stripe Billing Customer
// Portal (Stripe-hosted, compliant: cancel, update card, see invoices).
//
// POST /api/membership/portal  → { url }
//
// Requires the Customer Portal to be enabled once in the Stripe dashboard
// (Settings → Billing → Customer portal). Test mode usually has a default config.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { siteUrl } from "@/lib/stripe/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const db = createAdminClient();
  const { data } = await db
    .from("memberships")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();

  const customerId = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "No billing account yet — subscribe first." }, { status: 404 });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl()}/subscribe`,
  });

  return NextResponse.json({ url: session.url });
}
