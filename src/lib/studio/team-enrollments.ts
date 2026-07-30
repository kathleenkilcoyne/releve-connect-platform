import type { SupabaseClient } from "@supabase/supabase-js";

// The "team roster" reconcile for the comp/college wedge (Brick B2).
//
// WHY THIS EXISTS: the family /join flow creates an AFFILIATION (student ↔
// studio), but This Week's family read is gated on ENROLLMENT (student ↔ class,
// via `guardian_calendar_for_class` / `fetchStudentWeek`). A competition/college
// team's schedule applies to the WHOLE team, so every dancer affiliated to the
// studio should be enrolled in every one of that studio's active entries.
//
// Reconciling here — admin-side, service-role — is what lets B1's /join stay
// UNTOUCHED: joining creates the affiliation, and the schedule owns turning that
// affiliation into the enrollments This Week reads. It runs after the admin
// creates/edits an entry and whenever the admin opens the studio, so a family
// that joins after the schedule exists is picked up the next time Kathleen looks.
//
// Idempotent: `enrollments` has a unique (student_id, class_id); we upsert with
// ignoreDuplicates, so re-running never duplicates and never disturbs an
// existing enrollment (including one a studio deliberately dropped).

export type ReconcileResult = { students: number; classes: number; error?: string };

export async function reconcileTeamEnrollments(
  admin: SupabaseClient,
  employerId: string,
): Promise<ReconcileResult> {
  // Students affiliated to this studio (active).
  const { data: affRows, error: affErr } = await admin
    .from("affiliations")
    .select("subject_id")
    .eq("employer_id", employerId)
    .eq("subject_kind", "student")
    .eq("status", "active");
  if (affErr) return { students: 0, classes: 0, error: affErr.message };
  const studentIds = [
    ...new Set(((affRows ?? []) as { subject_id: string }[]).map((r) => r.subject_id)),
  ];

  // This studio's active class entries.
  const { data: classRows, error: classErr } = await admin
    .from("studio_classes")
    .select("class_id")
    .eq("employer_id", employerId)
    .eq("status", "active");
  if (classErr) return { students: 0, classes: 0, error: classErr.message };
  const classIds = ((classRows ?? []) as { class_id: string }[]).map((r) => r.class_id);

  if (studentIds.length === 0 || classIds.length === 0) {
    return { students: studentIds.length, classes: classIds.length };
  }

  const rows: { student_id: string; class_id: string; status: "active" }[] = [];
  for (const student_id of studentIds) {
    for (const class_id of classIds) {
      rows.push({ student_id, class_id, status: "active" });
    }
  }

  const { error: upErr } = await admin
    .from("enrollments")
    .upsert(rows, { onConflict: "student_id,class_id", ignoreDuplicates: true });
  if (upErr) return { students: studentIds.length, classes: classIds.length, error: upErr.message };

  return { students: studentIds.length, classes: classIds.length };
}
