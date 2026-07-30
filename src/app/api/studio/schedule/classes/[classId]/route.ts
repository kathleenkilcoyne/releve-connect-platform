// Studio self-serve — edit or remove ONE entry of the caller's OWN studio
// (Smart Calendar, Slice 1).
//
// PATCH  /api/studio/schedule/classes/<classId>  → replace fields, re-reconcile.
// DELETE /api/studio/schedule/classes/<classId>  → remove (sessions + enrollments
//        cascade). class_sessions and enrollments FK the class ON DELETE CASCADE,
//        so it disappears from every family's This Week.
//
// The class is verified to belong to the caller's OWN studio (employer id from
// the session), so a classId from another studio can never be edited here.

import { NextResponse } from "next/server";
import { requireStudioAccess } from "@/lib/studio/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildClassFields, type ScheduleInput } from "@/lib/studio/schedule";
import { reconcileTeamEnrollments } from "@/lib/studio/team-enrollments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirm the class exists AND belongs to the caller's own studio. */
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
    return { error: NextResponse.json({ error: "Entry not found for your studio." }, { status: 404 }) };
  }
  return { ok: true as const };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;
  const employerId = gate.employerId;
  const { classId } = await ctx.params;

  let body: ScheduleInput;
  try {
    body = (await req.json()) as ScheduleInput;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const built = buildClassFields(body);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });

  const db = createAdminClient();
  const owned = await loadOwnedClass(db, employerId, classId);
  if ("error" in owned) return owned.error;

  const { error: updErr } = await db
    .from("studio_classes")
    .update({ ...built.fields, updated_at: new Date().toISOString() })
    .eq("class_id", classId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const roster = await reconcileTeamEnrollments(db, employerId);
  if (roster.error) console.error("[studio classes] enrollment reconcile failed:", roster.error);

  return NextResponse.json({ ok: true, class_id: classId, roster });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ classId: string }> }) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;
  const employerId = gate.employerId;
  const { classId } = await ctx.params;

  const db = createAdminClient();
  const owned = await loadOwnedClass(db, employerId, classId);
  if ("error" in owned) return owned.error;

  const { error } = await db.from("studio_classes").delete().eq("class_id", classId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: classId });
}
