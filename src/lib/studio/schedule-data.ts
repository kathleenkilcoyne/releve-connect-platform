import type { SupabaseClient } from "@supabase/supabase-js";

import { loadAffiliatedStudents, countFamilies } from "./roster";
import { summarizeClassAcks, type AckRow } from "@/lib/this-week/acknowledgements";

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
  /** "Got it" readout: how many of the intended recipients have acknowledged, and
   *  the total. Targeted events count DANCERS (enrolled); studio-wide events count
   *  FAMILIES. Both default to 0 when no one has acknowledged. */
  ack_acked: number;
  ack_total: number;
};

export type TeacherOption = { profile_id: string; display_name: string };
export type RosterEntry = {
  student_id: string;
  display_name: string;
  /** The studio's Age Division for this dancer (studio-scoped affiliations.division). */
  division: string | null;
  /** Read-only reference from the family-owned students record. */
  age_range: string | null;
  /**
   * Whether the dancer's account is linked. For a competition family, that means
   * a guardian joined; for a self-managed adult (college team), it means the
   * dancer redeemed the team code themselves. Either way "connected" = reachable.
   */
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

  // Roster: dancers affiliated to this studio — the SAME source of truth the admin
  // "families joined" count and the family "This Week" view read (lib/studio/roster.ts).
  // Each carries the studio's Age Division (studio-scoped), the age-range reference
  // (family-owned, read-only), and their parent-connection status. Studio-safe —
  // never date of birth. The affiliation→student join is the shared helper; the
  // connection status is layered on top from guardianships + self-transfer.
  const affiliated = await loadAffiliatedStudents(db, employerId);
  const rosterIds = affiliated.map((s) => s.student_id);

  let roster: RosterEntry[] = [];
  if (rosterIds.length) {
    const [{ data: transferRows }, { data: guardRows }] = await Promise.all([
      db
        .from("students")
        .select("student_id, transferred_to_user_id")
        .in("student_id", rosterIds),
      db.from("guardianships").select("student_id").in("student_id", rosterIds),
    ]);
    const connected = new Set(
      ((guardRows ?? []) as { student_id: string }[]).map((g) => g.student_id),
    );
    const transferred = new Set(
      ((transferRows ?? []) as { student_id: string; transferred_to_user_id: string | null }[])
        .filter((s) => s.transferred_to_user_id)
        .map((s) => s.student_id),
    );
    roster = affiliated.map((s) => ({
      student_id: s.student_id,
      display_name: s.display_name,
      division: s.division,
      age_range: s.age_range,
      // A guardian link OR a self-managed adult (transferred to their own account)
      // both count as connected/reachable.
      connection:
        connected.has(s.student_id) || transferred.has(s.student_id)
          ? ("connected" as const)
          : ("pending" as const),
    }));
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

  // "Got it" readout per entry: match the family acks against each class's
  // sessions. Targeted classes count enrolled DANCERS; studio-wide count the
  // studio's FAMILIES. Fail-soft — if the ack table/read isn't there yet, every
  // tally is 0-of-N rather than a broken page.
  const ackByClass = new Map<string, { acked: number; total: number }>();
  if (classIds.length) {
    const { data: sessRows } = await db
      .from("class_sessions")
      .select("session_id, class_id")
      .in("class_id", classIds);
    const sessionsByClass = new Map<string, string[]>();
    const allSessionIds: string[] = [];
    for (const s of (sessRows ?? []) as { session_id: string; class_id: string }[]) {
      const l = sessionsByClass.get(s.class_id) ?? [];
      l.push(s.session_id);
      sessionsByClass.set(s.class_id, l);
      allSessionIds.push(s.session_id);
    }

    let ackRows: AckRow[] = [];
    if (allSessionIds.length) {
      const { data: aRows, error: aErr } = await db
        .from("event_acknowledgements")
        .select("session_id, student_id, family_id, acknowledged_at")
        .in("session_id", allSessionIds);
      if (aErr) console.error("[schedule-data] ack read failed:", aErr.message);
      else ackRows = (aRows ?? []) as AckRow[];
    }

    const totalFamilies = countFamilies(affiliated);
    const summary = summarizeClassAcks(
      classes.map((c) => ({
        classId: c.class_id,
        studioWide: c.studio_wide,
        sessionIds: sessionsByClass.get(c.class_id) ?? [],
        enrolledStudentIds: enrByClass.get(c.class_id) ?? [],
      })),
      ackRows,
      totalFamilies,
    );
    for (const [k, v] of summary) ackByClass.set(k, v);
  }

  const scheduleEntries: ScheduleRow[] = classes.map((c) => ({
    ...c,
    teacher_name: c.teacher_profile_id ? teacherNameById.get(c.teacher_profile_id) ?? null : null,
    target_group_ids: groupsByClass.get(c.class_id) ?? [],
    target_dancer_ids: dancersByClass.get(c.class_id) ?? [],
    target_student_ids: enrByClass.get(c.class_id) ?? [],
    ack_acked: ackByClass.get(c.class_id)?.acked ?? 0,
    ack_total: ackByClass.get(c.class_id)?.total ?? 0,
  }));
  const teacherOptions: TeacherOption[] = [...teacherNameById.entries()].map(
    ([profile_id, display_name]) => ({ profile_id, display_name }),
  );

  return { scheduleEntries, teacherOptions, roster, groups };
}
