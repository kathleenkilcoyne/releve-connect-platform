// Admin — confer Founding Professional status. Gated on a signed-in admin
// session (requireAdmin); writes via the service role. No self-select path: only
// an admin can create a grant, and the acting admin's id is recorded as
// granted_by (audit).
//
// POST /api/admin/founding-professionals
//   body: { email, entitlement_kind: 'permanent' | 'comp_12mo', note? }
//     → creates the conferral/audit row; if the person already has an account,
//       also materializes the complimentary membership + stamps their identity.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantFoundingProfessional, isEntitlementKind } from "@/lib/founding/founding-professional";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { email?: string; entitlement_kind?: string; note?: string };

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
  return NextResponse.json({ ok: true, grantId: result.grantId, materialized: result.materialized });
}
