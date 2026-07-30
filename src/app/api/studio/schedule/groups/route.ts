// Studio self-serve — reusable groups for the caller's OWN studio (Slice C).
//
// POST /api/studio/schedule/groups   body: { name }   → create a named group.
//
// A group is a persistent, reusable roster the studio targets events at ("Jazz 3",
// "Teen Company"). Gated on the studio's own owner/staff; the studio id comes from
// the session, so a studio can only ever create its own groups.

import { NextResponse } from "next/server";
import { requireStudioAccess } from "@/lib/studio/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGroup } from "@/lib/studio/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const db = createAdminClient();
  const result = await createGroup(db, gate.employerId, body.name ?? "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, group_id: result.group_id });
}
