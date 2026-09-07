// Admin — correct, revoke, or resend a Founding Professional grant. Gated on a
// signed-in admin session; writes via the service role.
//
// PATCH /api/admin/founding-professionals/<grantId>
//   body: { action: 'change_entitlement', entitlement_kind } → change BILLING only
//                                                                (identity untouched)
//        | { action: 'revoke' }                              → revoke (audit),
//                                                                deactivate billing,
//                                                                clear identity stamp
//        | { action: 'resend_invitation' }                   → re-send the SAME
//                                                                code-generated link
//                                                                to an unclaimed,
//                                                                non-revoked grant.
//                                                                No writes to the
//                                                                grant row itself.
//
// The audit trail lives on the grant row: granted_by/granted_at record the grant,
// revoked_by/revoked_at record a correction — the row is never deleted.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  changeEntitlement,
  revokeFoundingProfessional,
  isEntitlementKind,
  foundingProfessionalInviteLink,
  recordInvitationSendAttempt,
} from "@/lib/founding/founding-professional";
import { sendFoundingProfessionalInvitation } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "change_entitlement" | "revoke" | "resend_invitation";
  entitlement_kind?: string;
};

function autosendEnabled(): boolean {
  return process.env.FOUNDING_PROFESSIONAL_AUTOSEND_ENABLED === "true";
}

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

  if (body.action === "change_entitlement") {
    const kind = String(body.entitlement_kind ?? "");
    if (!isEntitlementKind(kind)) {
      return NextResponse.json({ error: "entitlement_kind must be 'permanent' or 'comp_12mo'." }, { status: 400 });
    }
    const res = await changeEntitlement(db, id, kind);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
    return NextResponse.json({ ok: true, action: "change_entitlement", entitlement_kind: kind });
  }

  if (body.action === "revoke") {
    const res = await revokeFoundingProfessional(db, id, gate.userId);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
    return NextResponse.json({ ok: true, action: "revoke" });
  }

  if (body.action === "resend_invitation") {
    if (!autosendEnabled()) {
      return NextResponse.json(
        { error: "Automated sending is currently disabled. Use “Copy invite link” instead." },
        { status: 409 },
      );
    }

    const { data: grant } = await db
      .from("founding_professional_grants")
      .select("id, email, claimed_at, revoked_at")
      .eq("id", id)
      .maybeSingle();
    const g = grant as { id: string; email: string; claimed_at: string | null; revoked_at: string | null } | null;
    if (!g) return NextResponse.json({ error: "Grant not found." }, { status: 404 });
    if (g.revoked_at) return NextResponse.json({ error: "That grant has been revoked." }, { status: 409 });
    if (g.claimed_at) {
      return NextResponse.json(
        { error: "Already claimed — there is nothing to resend." },
        { status: 409 },
      );
    }

    const sendResult = await sendFoundingProfessionalInvitation({
      to: g.email,
      inviteLink: foundingProfessionalInviteLink(g.email),
    });
    await recordInvitationSendAttempt(db, {
      grantId: g.id,
      sentBy: gate.userId,
      recipientEmail: g.email,
      result: sendResult,
    });

    if (!sendResult.sent) {
      return NextResponse.json(
        { error: `Email vendor did not confirm delivery (${sendResult.reason}).` },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, action: "resend_invitation", message_id: sendResult.id });
  }

  return NextResponse.json(
    { error: "action must be 'change_entitlement', 'revoke', or 'resend_invitation'." },
    { status: 400 },
  );
}
