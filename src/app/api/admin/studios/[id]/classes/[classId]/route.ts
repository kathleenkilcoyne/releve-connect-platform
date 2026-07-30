// Admin — edit or remove ONE schedule entry for a studio (Brick B2).
//
// PATCH  /api/admin/studios/<employerId>/classes/<classId>
//        body: ScheduleInput — replaces the entry's fields (same validation as
//        create), then re-reconciles the team roster.
// DELETE /api/admin/studios/<employerId>/classes/<classId>
//        removes the entry. class_sessions and enrollments for it cascade away
//        (both FK the class ON DELETE CASCADE), so it disappears from This Week.
//
// Both are gated on a signed-in admin and scoped to the (studio, class) pair so a
// classId from another studio can't be edited through this studio's URL.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildClassFields, type ScheduleInput } from "@/lib/studio/schedule";
import { reconcileTeamEnrollments } from "@/lib/studio/team-enrollments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirm the class exists AND belongs to this studio. */
async function loadOwnedClass(
  db: ReturnType<typeof createAdminClient>,
  employerId: string,
  classId: string,
) {
  const { data, error } = await db
    .from("studio_classes")
    .select("class_id, employer_id")
    .eq("class_id", classId)
    .maybeSingle();
  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  const row = data as { class_id: string; employer_id: string } | null;
  if (!row || row.employer_id !== employerId) {
    return { error: NextResponse.json({ error: "Entry not found for this studio." }, { status: 404 }) };
  }
  return { ok: true as const };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; classId: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  const { id, classId } = await ctx.params;

  let body: ScheduleInput;
  try {
    body = (await req.json()) as ScheduleInput;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const built = buildClassFields(body);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });

  const db = createAdminClient();
  const owned = await loadOwnedClass(db, id, classId);
  if ("error" in owned) return owned.error;

  const { error: updErr } = await db
    .from("studio_classes")
    .update({ ...built.fields, updated_at: new Date().toISOString() })
    .eq("class_id", classId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const roster = await reconcileTeamEnrollments(db, id);
  if (roster.error) console.error("[admin classes] enrollment reconcile failed:", roster.error);

  return NextResponse.json({ ok: true, class_id: classId, roster });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; classId: string }> }) {
  const gate = await requireAdmin(_req);
  if (!gate.ok) return gate.response;

  const { id, classId } = await ctx.params;

  const db = createAdminClient();
  const owned = await loadOwnedClass(db, id, classId);
  if ("error" in owned) return owned.error;

  const { error } = await db.from("studio_classes").delete().eq("class_id", classId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: classId });
}
