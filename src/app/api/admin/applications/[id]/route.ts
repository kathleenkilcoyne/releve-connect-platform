// Admin — act on an application (the vetting decision). Gated on a signed-in
// admin session (see lib/admin-auth.ts);
// writes via the service role (bypasses RLS, since the admin console has no login
// yet). One PATCH endpoint, dispatched by `action`.
//
// PATCH /api/admin/applications/<applicationId>
//   body: { action, tier?, honorifics?, note? }
//     action = "approve"             → state=approved (optional `tier` for a choreographer).
//                                       Grants Professional Roster status ONLY — does NOT
//                                       touch membership/billing. See "grant_complimentary".
//            | "grant_complimentary"  → a SEPARATE, explicit admin action that grants a
//                                       complimentary founding membership to an already-
//                                       approved public applicant. Requires state=approved.
//            | "honorifics"           → set editorial honorifics[] (no state change)
//            | "request_info"         → state=more-info (+ optional `note`)
//            | "decline"              → state=declined  AND refund the $30 in full
//
// Emails #4/#5/#6 are MANUAL — they fire here (as seams), never automatically.
//
// ── Public applicant approval vs. complimentary membership (2026-08-23) ──
// Approving a PUBLIC application used to also auto-grant a complimentary founding
// membership in the same click (the "FREE FOUNDING PERIOD" launch decision,
// 2026-07-20). That coupling is removed: "approve" now ONLY sets Professional
// Roster status (state=approved, +tier for a choreographer). Complimentary
// membership for a public applicant now requires a second, explicit admin
// action — "grant_complimentary" — so the two decisions (are they vetted? / do
// they get a free year?) can't be made by a single click ever again.
//
// This does NOT touch the invited Founding Professional flow
// (`src/lib/founding/founding-professional.ts` + `/admin/founding-professionals`).
// That flow never applies, never runs through this route, and materializes its own
// complimentary membership directly on grant/claim — unchanged by this file.

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
  action?: "approve" | "grant_complimentary" | "honorifics" | "request_info" | "decline";
  tier?: string;
  honorifics?: string[];
  note?: string;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
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
      // reviewed_by is finally fillable: the gate now knows WHICH admin acted.
      // Under the old shared token it stayed null — the column existed, but a
      // password shared by everyone can't name anyone.
      const update: Record<string, unknown> = {
        state: "approved",
        reviewed_at: now,
        reviewed_by: gate.userId,
        updated_at: now,
      };
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

      // Roster status ONLY — no membership/billing side effect. Complimentary
      // access, if any, is a separate explicit "grant_complimentary" action below.
      await fireMailerLiteTag(app.email, "application_approved");
      await sendApplicationApproved({
        to: app.email,
        firstName: app.first_name,
        tierLabel,
      });
      return NextResponse.json({ ok: true, state: "approved" });
    }

    // ---------------------------------------------------------------------
    // A SEPARATE, explicit admin action — never bundled into "approve". Grants a
    // complimentary founding membership to a public applicant who has already
    // been approved for the Professional Roster. Idempotent (see
    // grantFoundingMembership) — re-clicking on someone already comped/paid is a
    // safe no-op, not a stacked membership.
    case "grant_complimentary": {
      if (app.state !== "approved") {
        return NextResponse.json(
          { error: "Only an already-approved applicant can be granted complimentary membership." },
          { status: 409 },
        );
      }
      if (!app.user_id) {
        return NextResponse.json(
          { error: "This applicant has no account yet — nothing to grant." },
          { status: 409 },
        );
      }

      const comp = await grantFoundingMembership(db, app.user_id, app.roles);
      if (!comp.granted && comp.reason === "error") {
        return NextResponse.json({ error: comp.detail ?? "Could not grant complimentary membership." }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        foundingMembership: comp.granted ? { tier: comp.tier, until: comp.renewalDate } : comp.reason,
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
        .update({ state: "more-info", reviewed_at: now, reviewed_by: gate.userId, updated_at: now })
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
        .update({ state: "declined", reviewed_at: now, reviewed_by: gate.userId, updated_at: now })
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
