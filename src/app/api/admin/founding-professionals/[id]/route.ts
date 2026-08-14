// Admin — correct or revoke a Founding Professional grant. Gated on a signed-in
// admin session; writes via the service role.
//
// PATCH /api/admin/founding-professionals/<grantId>
//   body: { action: 'change_entitlement', entitlement_kind } → change BILLING only
//                                                                (identity untouched)
//        | { action: 'revoke' }                              → revoke (audit),
//                                                                deactivate billing,
//                                                                clear identity stamp
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
} from "@/lib/founding/founding-professional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: "change_entitlement" | "revoke"; entitlement_kind?: string };

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

  return NextResponse.json(
    { error: "action must be 'change_entitlement' or 'revoke'." },
    { status: 400 },
  );
}
