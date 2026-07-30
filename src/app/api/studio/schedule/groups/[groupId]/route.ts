// Studio self-serve — rename / set members / delete one group (Slice C).
//
// PATCH  /api/studio/schedule/groups/<groupId>
//        body: { name?, member_ids? } → rename and/or replace the group's members.
//        Changing membership recomputes every event that targets this group
//        (edit the group once → every event using it updates).
// DELETE /api/studio/schedule/groups/<groupId>
//        remove the group; events that targeted it recompute without its members.
//
// Scoped to the caller's own studio; a groupId from another studio is refused.

import { NextResponse } from "next/server";
import { requireStudioAccess } from "@/lib/studio/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateGroup, deleteGroup } from "@/lib/studio/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ groupId: string }> }) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;
  const { groupId } = await ctx.params;

  let body: { name?: string; member_ids?: string[] };
  try {
    body = (await req.json()) as { name?: string; member_ids?: string[] };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const db = createAdminClient();
  const result = await updateGroup(db, gate.employerId, groupId, {
    name: body.name,
    member_ids: body.member_ids,
  });
  if (!result.ok) {
    const status = result.error.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, group_id: groupId });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ groupId: string }> }) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;
  const { groupId } = await ctx.params;

  const db = createAdminClient();
  const result = await deleteGroup(db, gate.employerId, groupId);
  if (!result.ok) {
    const status = result.error.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, deleted: groupId });
}
