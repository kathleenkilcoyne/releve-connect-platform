// Admin — act on an application (the vetting decision). Gated by ADMIN_TOKEN;
// writes via the service role (bypasses RLS, since the admin console has no login
// yet). One PATCH endpoint, dispatched by `action`.
//
// PATCH /api/admin/applications/<applicationId>
//   body: { action, tier?, honorifics?, note? }
//     action = "approve"        → state=approved (optional `tier` for a choreographer)
//            | "honorifics"      → set editorial honorifics[] (no state change)
//            | "request_info"    → state=more-info (+ optional `note`)
//            | "decline"         → state=declined  AND refund the $30 in full
//
// Emails #4/#5/#6 are MANUAL — they fire here (as seams), never automatically.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import {
  fireMailerLiteTag,
  sendApplicationApproved,
  sendApplicationMoreInfo,
  sendApplicationDeclined,
} from "@/lib/notifications";
import { grantFoundingMembership } from "@/lib/membership/founding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Marketplace tiers an admin may approve a choreographer into. "featured" is
// retired (pricing SSOT); "signature" is reserved for Founding Honorees.
const APPROVABLE_TIERS = ["emerging", "established", "signature"] as const;
type ApprovableTier = (typeof APPROVABLE_TIERS)[number];

type Body = {
  action?: "approve" | "honorifics" | "request_info" | "decline";
  tier?: string;
  honorifics?: string[];
  note?: string;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = requireAdmin(req);
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const db = createAdminClient();

  // Load the application (service role sees all).
  const { data: appData, error: loadErr } = await db
    .from("applications")
    .select("application_id, user_id, email, first_name, roles, state")
    .eq("application_id", id)
    .single();
  if (loadErr || !appData) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  const app = appData as unknown as {
    application_id: string;
    user_id: string | null;
    email: string;
    first_name: string | null;
    roles: string[] | null;
    state: string;
  };
  const now = new Date().toISOString();

  switch (body.action) {
    // ---------------------------------------------------------------------
    case "approve": {
      const update: Record<string, unknown> = { state: "approved", reviewed_at: now, updated_at: now };
      let tierLabel: string | null = null;

      // A tier only applies to choreographers.
      if (body.tier) {
        if (!APPROVABLE_TIERS.includes(body.tier as ApprovableTier)) {
          return NextResponse.json(
            { error: `tier must be one of: ${APPROVABLE_TIERS.join(", ")}.` },
            { status: 400 },
          );
        }
        if (!(app.roles ?? []).includes("choreographer")) {
          return NextResponse.json(
            { error: "A marketplace tier can only be assigned to a choreographer." },
            { status: 409 },
          );
        }
        update.approved_tier = body.tier;
        tierLabel = body.tier.charAt(0).toUpperCase() + body.tier.slice(1);
      }

      const { error } = await db.from("applications").update(update).eq("application_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // FREE FOUNDING PERIOD: approval grants a complimentary first year outright.
      // Without this the member is accepted but still locked out of the Roster and
      // the profile builder, which are gated on an active membership.
      let foundingUntil: string | null = null;
      let comp: Awaited<ReturnType<typeof grantFoundingMembership>> | null = null;
      if (app.user_id) {
        comp = await grantFoundingMembership(db, app.user_id, app.roles);
        if (comp.granted) {
          foundingUntil = new Date(comp.renewalDate).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
        } else if (comp.reason === "error") {
          // Do not fail the approval — the decision is recorded and the comp can
          // be granted again by re-approving. But make it loud.
          console.error(
            `[admin] approved ${id} but the founding membership was NOT granted:`,
            comp.detail,
          );
        }
      }

      await fireMailerLiteTag(app.email, "application_approved");
      await sendApplicationApproved({
        to: app.email,
        firstName: app.first_name,
        tierLabel,
        foundingUntil,
      });
      return NextResponse.json({
        ok: true,
        state: "approved",
        foundingMembership: comp?.granted
          ? { tier: comp.tier, until: comp.renewalDate }
          : (comp?.reason ?? null),
      });
    }

    // ---------------------------------------------------------------------
    case "honorifics": {
      const honorifics = Array.isArray(body.honorifics)
        ? body.honorifics.map((h) => String(h).trim()).filter(Boolean)
        : [];
      const { error } = await db
        .from("applications")
        .update({ honorifics, updated_at: now })
        .eq("application_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, honorifics });
    }

    // ---------------------------------------------------------------------
    case "request_info": {
      const { error } = await db
        .from("applications")
        .update({ state: "more-info", reviewed_at: now, updated_at: now })
        .eq("application_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await fireMailerLiteTag(app.email, "application_more_info");
      await sendApplicationMoreInfo({ to: app.email, firstName: app.first_name, note: body.note ?? null });
      return NextResponse.json({ ok: true, state: "more-info" });
    }

    // ---------------------------------------------------------------------
    case "decline": {
      // "Refunded if NOT accepted": refund the paid $30 in full, if there is one.
      let refunded = false;
      const { data: feeRows } = await db
        .from("application_fee_payments")
        .select("id, stripe_payment_intent_id, status")
        .eq("application_id", id)
        .eq("status", "paid")
        .limit(1);
      const fee = feeRows?.[0] as
        | { id: string; stripe_payment_intent_id: string | null; status: string }
        | undefined;

      if (fee?.stripe_payment_intent_id) {
        try {
          await getStripe().refunds.create({ payment_intent: fee.stripe_payment_intent_id });
          await db
            .from("application_fee_payments")
            .update({ status: "refunded", resolved_at: now, updated_at: now })
            .eq("id", fee.id);
          refunded = true;
        } catch (err) {
          // Don't block the decline on a refund hiccup — surface it, leave the fee
          // as 'paid' so it can be retried, and still record the decline.
          console.error("[admin decline] refund failed for application", id, err);
        }
      }

      const { error } = await db
        .from("applications")
        .update({ state: "declined", reviewed_at: now, updated_at: now })
        .eq("application_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await fireMailerLiteTag(app.email, "application_declined");
      await sendApplicationDeclined({ to: app.email, firstName: app.first_name, refunded });
      return NextResponse.json({ ok: true, state: "declined", refunded });
    }

    default:
      return NextResponse.json(
        { error: "action must be one of: approve, honorifics, request_info, decline." },
        { status: 400 },
      );
  }
}
