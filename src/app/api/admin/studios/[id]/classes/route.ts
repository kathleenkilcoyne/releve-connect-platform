// Admin — schedule entry for one studio/team (Brick B2). Concierge only: the
// ADMIN enters a comp/college team's schedule so it populates This Week for that
// team's teachers and its families' children.
//
// POST /api/admin/studios/<employerId>/classes
//   body: ScheduleInput (see lib/studio/schedule.ts) — a recurring weekly rule
//         or a one-off date, one of the comp/college kinds only.
//
// Writes the EXISTING studio_classes table; the EXISTING recurrence expander +
// This Week read path turn it into the calendar. After the write, we reconcile
// the team roster so every affiliated dancer is enrolled in the new entry
// (see lib/studio/team-enrollments.ts) — /join is never touched.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildClassFields, type ScheduleInput } from "@/lib/studio/schedule";
import { reconcileTeamEnrollments } from "@/lib/studio/team-enrollments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;

  let body: ScheduleInput;
  try {
    body = (await req.json()) as ScheduleInput;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const built = buildClassFields(body);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });

  const db = createAdminClient();

  // The studio must exist.
  const { data: prof, error: profErr } = await db
    .from("employer_profiles")
    .select("employer_id")
    .eq("employer_id", id)
    .maybeSingle();
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
  if (!prof) return NextResponse.json({ error: "Studio not found." }, { status: 404 });

  const { data: created, error: insErr } = await db
    .from("studio_classes")
    .insert({ employer_id: id, status: "active", ...built.fields })
    .select("class_id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Enroll the current team roster into all of this studio's entries.
  const roster = await reconcileTeamEnrollments(db, id);
  if (roster.error) {
    console.error("[admin classes] enrollment reconcile failed:", roster.error);
  }

  return NextResponse.json({
    ok: true,
    class_id: (created as { class_id: string }).class_id,
    roster,
  });
}
