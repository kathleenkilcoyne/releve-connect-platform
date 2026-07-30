import type { SupabaseClient } from "@supabase/supabase-js";

// Event targeting for the Smart Calendar (Slice 2).
//
// Each event is one studio_class; WHO sees it is its `enrollments` roster (the
// existing engine — whoever is enrolled resolves it into their This Week). This
// sets an event's roster to EXACTLY the targeted dancers: a class/team is the
// selected group, a duet/trio/private is the 2-3-1 selected dancers. The
// whole-studio types don't enroll anyone — they carry `studio_wide` and are
// resolved against `affiliations` at read time (Slice 3), never fanned out.
//
// Setting the exact set (add missing, remove no-longer-targeted) is what makes
// "change the audience" work: pass the new dancer set and the removed families
// stop seeing it, the added families start, everyone else is untouched (Slice 4).
//
// Security: only dancers AFFILIATED to this studio can be targeted — a studio can
// never enroll (or reach) a dancer from another studio.

export type TargetResult = { enrolled: number; error?: string };

export async function setEventTargets(
  admin: SupabaseClient,
  employerId: string,
  classId: string,
  studentIds: string[],
): Promise<TargetResult> {
  // 1. Keep only dancers actually affiliated to THIS studio.
  const requested = [...new Set(studentIds)];
  let valid: string[] = [];
  if (requested.length) {
    const { data: aff, error } = await admin
      .from("affiliations")
      .select("subject_id")
      .eq("employer_id", employerId)
      .eq("subject_kind", "student")
      .eq("status", "active")
      .in("subject_id", requested);
    if (error) return { enrolled: 0, error: error.message };
    const affiliated = new Set(((aff ?? []) as { subject_id: string }[]).map((r) => r.subject_id));
    valid = requested.filter((id) => affiliated.has(id));
  }
  const validSet = new Set(valid);

  // 2. What's enrolled now?
  const { data: existingRows, error: exErr } = await admin
    .from("enrollments")
    .select("enrollment_id, student_id")
    .eq("class_id", classId);
  if (exErr) return { enrolled: 0, error: exErr.message };
  const existing = (existingRows ?? []) as { enrollment_id: string; student_id: string }[];
  const existingStudents = new Set(existing.map((e) => e.student_id));

  // 3. Remove the ones no longer targeted.
  const toDelete = existing.filter((e) => !validSet.has(e.student_id)).map((e) => e.enrollment_id);
  if (toDelete.length) {
    const { error: delErr } = await admin
      .from("enrollments")
      .delete()
      .in("enrollment_id", toDelete);
    if (delErr) return { enrolled: 0, error: delErr.message };
  }

  // 4. Add the newly targeted ones.
  const toAdd = valid
    .filter((s) => !existingStudents.has(s))
    .map((student_id) => ({ student_id, class_id: classId, status: "active" as const }));
  if (toAdd.length) {
    const { error: addErr } = await admin.from("enrollments").insert(toAdd);
    if (addErr) return { enrolled: 0, error: addErr.message };
  }

  return { enrolled: valid.length };
}
