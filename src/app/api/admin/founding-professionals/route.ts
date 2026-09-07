// Admin — confer Founding Professional status. Gated on a signed-in admin
// session (requireAdmin); writes via the service role. No self-select path: only
// an admin can create a grant, and the acting admin's id is recorded as
// granted_by (audit).
//
// POST /api/admin/founding-professionals
//   body: { email, entitlement_kind: 'permanent' | 'comp_12mo', note? }
//     → creates the conferral/audit row; if the person already has an account,
//       also materializes the complimentary membership + stamps their identity.
//
// Autosend (2026-09-07): when FOUNDING_PROFESSIONAL_AUTOSEND_ENABLED === "true",
// a real invitation email is sent via the code-generated link (never
// hand-composed) and the attempt is logged to
// founding_professional_invitation_sends. When the flag is off (the default),
// NO send is attempted and NOTHING is logged — the admin console falls back to
// the existing "copy link" flow. This lets the whole feature ship dormant.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  grantFoundingProfessional,
  isEntitlementKind,
  foundingProfessionalInviteLink,
  recordInvitationSendAttempt,
} from "@/lib/founding/founding-professional";
import { sendFoundingProfessionalInvitation } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { email?: string; entitlement_kind?: string; note?: string };

function autosendEnabled(): boolean {
  return process.env.FOUNDING_PROFESSIONAL_AUTOSEND_ENABLED === "true";
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const kind = String(body.entitlement_kind ?? "");
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
  if (!isEntitlementKind(kind)) {
    return NextResponse.json({ error: "entitlement_kind must be 'permanent' or 'comp_12mo'." }, { status: 400 });
  }

  const db = createAdminClient();
  const result = await grantFoundingProfessional(db, {
    email,
    entitlementKind: kind,
    note: body.note ?? null,
    grantedBy: gate.userId,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

  let invitationSent: boolean | null = null; // null = autosend disabled, no attempt made
  if (autosendEnabled()) {
    const sendResult = await sendFoundingProfessionalInvitation({
      to: email,
      inviteLink: foundingProfessionalInviteLink(email),
    });
    await recordInvitationSendAttempt(db, {
      grantId: result.grantId,
      sentBy: gate.userId,
      recipientEmail: email,
      result: sendResult,
    });
    invitationSent = sendResult.sent;
  }

  return NextResponse.json({
    ok: true,
    grantId: result.grantId,
    materialized: result.materialized,
    autosend_enabled: autosendEnabled(),
    invitation_sent: invitationSent,
  });
}
