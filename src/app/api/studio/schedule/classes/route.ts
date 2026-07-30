// Studio self-serve — schedule entry for the caller's OWN studio (Smart Calendar,
// Slice 1). Same shape as the admin route, but gated on the studio's own
// owner/staff (requireStudioAccess) instead of admin, and the studio id comes
// from the SESSION — never the URL or body — so a studio can only ever write its
// own schedule.
//
// POST /api/studio/schedule/classes
//   body: ScheduleInput (lib/studio/schedule.ts) — recurring rule or one-off,
//         comp/college kinds only.
//
// Reuses the EXISTING studio_classes + recurrence engine + This Week read path.
// After the write, reconciles the team roster (every affiliated dancer enrolled
// in the studio's active entries) — the same mechanism the admin path uses.

import { NextResponse } from "next/server";
import { requireStudioAccess } from "@/lib/studio/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildClassFields, type ScheduleInput } from "@/lib/studio/schedule";
import { setEventTargets } from "@/lib/studio/team-enrollments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;
  const employerId = gate.employerId;

  let body: ScheduleInput;
  try {
    body = (await req.json()) as ScheduleInput;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const built = buildClassFields(body);
  if ("error" in built) return NextResponse.json({ error: built.error }, { status: 400 });

  const db = createAdminClient();

  const { data: created, error: insErr } = await db
    .from("studio_classes")
    .insert({ employer_id: employerId, status: "active", ...built.fields })
    .select("class_id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  const classId = (created as { class_id: string }).class_id;

  // Target it: the whole studio (studio_wide, no enrollments) or the picked
  // dancers. Only dancers affiliated to this studio can be enrolled.
  const targets = built.fields.studio_wide ? [] : body.student_ids ?? [];
  const t = await setEventTargets(db, employerId, classId, targets);
  if (t.error) console.error("[studio classes] targeting failed:", t.error);

  return NextResponse.json({
    ok: true,
    class_id: classId,
    studio_wide: built.fields.studio_wide,
    enrolled: t.enrolled,
  });
}
