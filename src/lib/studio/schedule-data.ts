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
  /** The GROUPS this event targets (source of truth for editing). */
  target_group_ids: string[];
  /** The individually-added dancers this event targets (source, on top of groups). */
  target_dancer_ids: string[];
  /** The resolved roster (enrollments) — the families it actually reaches. */
  target_student_ids: string[];
};

export type TeacherOption = { profile_id: string; display_name: string };
export type RosterEntry = {
  student_id: string;
  display_name: string;
  /** The studio's Age Division for this dancer (studio-scoped affiliations.division). */
  division: string | null;
  /** Read-only reference from the family-owned students record. */
  age_range: string | null;
  /** Whether a guardian is linked (from the family join). */
  connection: "connected" | "pending";
};
export type GroupEntry = { group_id: string; name: string; member_ids: string[] };

const CLASS_COLUMNS =
  "class_id, title, kind, event_type, studio_wide, recurrence, default_start, default_end, " +
  "series_start, series_end, room, location, teacher_profile_id";

export async function loadStudioScheduleData(db: SupabaseClient, employerId: string): Promise<{
  scheduleEntries: ScheduleRow[];
  teacherOptions: TeacherOption[];
  roster: RosterEntry[];
  groups: GroupEntry[];
}> {
  // Entries for this studio.
  const { data: classData } = await db
    .from("studio_classes")
    .select(CLASS_COLUMNS)
    .eq("employer_id", employerId)
    .order("created_at", { ascending: true });
  const classes = (classData ?? []) as unknown as Omit<
    ScheduleRow,
    "teacher_name" | "target_student_ids" | "target_group_ids" | "target_dancer_ids"
  >[];
  const classIds = classes.map((c) => c.class_id);

  // Per-event targets: resolved enrollments, targeted groups, added dancers.
  const enrByClass = new Map<string, string[]>();
  const groupsByClass = new Map<string, string[]>();
  const dancersByClass = new Map<string, string[]>();
  if (classIds.length) {
    const [{ data: enr }, { data: cg }, { data: cd }] = await Promise.all([
      db.from("enrollments").select("class_id, student_id").in("class_id", classIds).eq("status", "active"),
      db.from("studio_class_groups").select("class_id, group_id").in("class_id", classIds),
      db.from("studio_class_dancers").select("class_id, student_id").in("class_id", classIds),
    ]);
    for (const e of (enr ?? []) as { class_id: string; student_id: string }[]) {
      const l = enrByClass.get(e.class_id) ?? [];
      l.push(e.student_id);
      enrByClass.set(e.class_id, l);
    }
    for (const g of (cg ?? []) as { class_id: string; group_id: string }[]) {
      const l = groupsByClass.get(g.class_id) ?? [];
      l.push(g.group_id);
      groupsByClass.set(g.class_id, l);
    }
    for (const d of (cd ?? []) as { class_id: string; student_id: string }[]) {
      const l = dancersByClass.get(d.class_id) ?? [];
      l.push(d.student_id);
      dancersByClass.set(d.class_id, l);
    }
  }

  // The studio's reusable groups + their members.
  const { data: groupRows } = await db
    .from("studio_groups")
    .select("group_id, name")
    .eq("employer_id", employerId)
    .order("name", { ascending: true });
  const groupList = (groupRows ?? []) as { group_id: string; name: string }[];
  const membersByGroup = new Map<string, string[]>();
  if (groupList.length) {
    const { data: mem } = await db
      .from("studio_group_members")
      .select("group_id, student_id")
      .in("group_id", groupList.map((g) => g.group_id));
    for (const m of (mem ?? []) as { group_id: string; student_id: string }[]) {
      const l = membersByGroup.get(m.group_id) ?? [];
      l.push(m.student_id);
      membersByGroup.set(m.group_id, l);
    }
  }
  const groups: GroupEntry[] = groupList.map((g) => ({
    group_id: g.group_id,
    name: g.name,
    member_ids: membersByGroup.get(g.group_id) ?? [],
  }));

  // Roster: dancers affiliated to this studio, each with the studio's Age Division
  // (studio-scoped), the age-range reference (family-owned, read-only), and their
  // parent-connection status. Studio-safe — never date of birth.
  const { data: affRows } = await db
    .from("affiliations")
    .select("subject_id, division")
    .eq("employer_id", employerId)
    .eq("subject_kind", "student")
    .eq("status", "active");
  const divisionByStudent = new Map<string, string | null>();
  for (const r of (affRows ?? []) as { subject_id: string; division: string | null }[]) {
    divisionByStudent.set(r.subject_id, r.division);
  }
  const rosterIds = [...divisionByStudent.keys()];

  let roster: RosterEntry[] = [];
  if (rosterIds.length) {
    const [{ data: studentRows }, { data: guardRows }] = await Promise.all([
      db.from("students").select("student_id, display_name, age_range").in("student_id", rosterIds),
      db.from("guardianships").select("student_id").in("student_id", rosterIds),
    ]);
    const connected = new Set(
      ((guardRows ?? []) as { student_id: string }[]).map((g) => g.student_id),
    );
    roster = (
      (studentRows ?? []) as { student_id: string; display_name: string; age_range: string | null }[]
    ).map((s) => ({
      student_id: s.student_id,
      display_name: s.display_name,
      division: divisionByStudent.get(s.student_id) ?? null,
      age_range: s.age_range,
      connection: connected.has(s.student_id) ? ("connected" as const) : ("pending" as const),
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
    target_group_ids: groupsByClass.get(c.class_id) ?? [],
    target_dancer_ids: dancersByClass.get(c.class_id) ?? [],
    target_student_ids: enrByClass.get(c.class_id) ?? [],
  }));
  const teacherOptions: TeacherOption[] = [...teacherNameById.entries()].map(
    ([profile_id, display_name]) => ({ profile_id, display_name }),
  );

  return { scheduleEntries, teacherOptions, roster, groups };
}
