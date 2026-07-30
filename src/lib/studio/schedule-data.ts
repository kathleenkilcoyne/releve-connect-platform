import type { SupabaseClient } from "@supabase/supabase-js";

// Shared loader for a studio's schedule area (admin assist + studio self-serve).
// Returns the studio's entries (each with its event_type, studio_wide flag, and
// the exact dancers it targets), the roster to pick from, and teacher options —
// everything the editor needs to list, create, and re-target events.

export type ScheduleRow = {
  class_id: string;
  title: string;
  kind: string;
  event_type: string | null;
  studio_wide: boolean;
  recurrence: string | null;
  default_start: string | null;
  default_end: string | null;
  series_start: string | null;
  series_end: string | null;
  room: string | null;
  location: string | null;
  teacher_profile_id: string | null;
  teacher_name: string | null;
  /** The dancers this event targets (its enrollments). Empty for studio_wide. */
  target_student_ids: string[];
};

export type TeacherOption = { profile_id: string; display_name: string };
export type RosterEntry = { student_id: string; display_name: string };

const CLASS_COLUMNS =
  "class_id, title, kind, event_type, studio_wide, recurrence, default_start, default_end, " +
  "series_start, series_end, room, location, teacher_profile_id";

export async function loadStudioScheduleData(
  db: SupabaseClient,
  employerId: string,
): Promise<{ scheduleEntries: ScheduleRow[]; teacherOptions: TeacherOption[]; roster: RosterEntry[] }> {
  // Entries for this studio.
  const { data: classData } = await db
    .from("studio_classes")
    .select(CLASS_COLUMNS)
    .eq("employer_id", employerId)
    .order("created_at", { ascending: true });
  const classes = (classData ?? []) as unknown as Omit<
    ScheduleRow,
    "teacher_name" | "target_student_ids"
  >[];
  const classIds = classes.map((c) => c.class_id);

  // The dancers each entry targets (its enrollments).
  const targetsByClass = new Map<string, string[]>();
  if (classIds.length) {
    const { data: enr } = await db
      .from("enrollments")
      .select("class_id, student_id")
      .in("class_id", classIds)
      .eq("status", "active");
    for (const e of (enr ?? []) as { class_id: string; student_id: string }[]) {
      const list = targetsByClass.get(e.class_id) ?? [];
      list.push(e.student_id);
      targetsByClass.set(e.class_id, list);
    }
  }

  // Roster: dancers affiliated to this studio (studio-safe fields only).
  const { data: affRows } = await db
    .from("affiliations")
    .select("subject_id")
    .eq("employer_id", employerId)
    .eq("subject_kind", "student")
    .eq("status", "active");
  const rosterIds = [
    ...new Set(((affRows ?? []) as { subject_id: string }[]).map((r) => r.subject_id)),
  ];
  let roster: RosterEntry[] = [];
  if (rosterIds.length) {
    const { data: studentRows } = await db
      .from("students")
      .select("student_id, display_name")
      .in("student_id", rosterIds);
    roster = ((studentRows ?? []) as { student_id: string; display_name: string }[]).map((s) => ({
      student_id: s.student_id,
      display_name: s.display_name,
    }));
    roster.sort((a, b) => a.display_name.localeCompare(b.display_name));
  }

  // Teacher options + names (talent affiliated as teacher/staff, plus anyone
  // already assigned to an entry).
  const { data: teacherAff } = await db
    .from("affiliations")
    .select("subject_id")
    .eq("employer_id", employerId)
    .eq("subject_kind", "talent")
    .in("role", ["teacher", "staff"])
    .eq("status", "active");
  const teacherIds = new Set<string>([
    ...((teacherAff ?? []) as { subject_id: string }[]).map((r) => r.subject_id),
    ...(classes.map((c) => c.teacher_profile_id).filter(Boolean) as string[]),
  ]);
  const teacherNameById = new Map<string, string>();
  if (teacherIds.size) {
    const { data: tp } = await db
      .from("talent_profiles")
      .select("profile_id, display_name")
      .in("profile_id", [...teacherIds]);
    for (const t of (tp ?? []) as { profile_id: string; display_name: string | null }[]) {
      teacherNameById.set(t.profile_id, t.display_name ?? "Teacher");
    }
  }

  const scheduleEntries: ScheduleRow[] = classes.map((c) => ({
    ...c,
    teacher_name: c.teacher_profile_id ? teacherNameById.get(c.teacher_profile_id) ?? null : null,
    target_student_ids: targetsByClass.get(c.class_id) ?? [],
  }));
  const teacherOptions: TeacherOption[] = [...teacherNameById.entries()].map(
    ([profile_id, display_name]) => ({ profile_id, display_name }),
  );

  return { scheduleEntries, teacherOptions, roster };
}
