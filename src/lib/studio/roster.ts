// The studio ROSTER — one source of truth for "which dancers belong to a studio".
//
// A dancer↔studio link lives in ONE place: an `affiliations` row
// (`subject_kind='student'`, `role='student'`, `status='active'`,
// `employer_id=<studio>`). That is the row the family "This Week" view already
// reads (lib/this-week/queries.ts → fetchAffiliatedEmployerIds), the row the
// /join flow writes (app/join/actions.ts), and — now — the row BOTH the admin
// "families joined" count and the studio roster / schedule-targeting list read.
//
// Before this, the roster read affiliations but the "families joined" count read
// the join code's `use_count`, which resets to 0 whenever the code is regenerated
// (a fresh `studio_invites` row starts at use_count=0) even though the families
// are still affiliated. Sourcing the count from `affiliations` here makes the
// three reads agree and can't drift again — the whole point of the shared helper.
//
// The DB read matches the canonical query in BLOCKER-FAMILY-JOIN-ROSTER.md:
//   SELECT s.student_id, s.display_name, s.age_range, s.family_id
//   FROM affiliations a
//   JOIN students s ON s.student_id = a.subject_id
//   WHERE a.subject_kind='student' AND a.status='active'
//     AND a.employer_id = $studioId
//   ORDER BY s.display_name;

import type { SupabaseClient } from "@supabase/supabase-js";

/** A dancer actively affiliated to a studio, in the canonical roster shape. */
export type AffiliatedStudent = {
  student_id: string;
  display_name: string;
  age_range: string | null;
  /** The family that pays — null for a self-managed adult (college team). */
  family_id: string | null;
  /** The studio's Age Division for this dancer (studio-scoped affiliation field). */
  division: string | null;
};

type AffiliationRow = { subject_id: string; division: string | null };
type StudentRow = {
  student_id: string;
  display_name: string;
  age_range: string | null;
  family_id: string | null;
};

/* ─────────────────────────────  Pure core  ───────────────────────────────── */

/**
 * Join affiliation rows to their student rows and produce the roster, sorted by
 * display name. A student is on the roster iff it has a matching active
 * affiliation (the affiliation rows passed in are already filtered to
 * active/student/this-studio by the DB read). Kept pure — no Supabase — so the
 * roster/count semantics can be proven without a database.
 */
export function buildRoster(
  affiliations: AffiliationRow[],
  students: StudentRow[],
): AffiliatedStudent[] {
  const divisionByStudent = new Map<string, string | null>();
  for (const a of affiliations) divisionByStudent.set(a.subject_id, a.division);

  return students
    .filter((s) => divisionByStudent.has(s.student_id))
    .map((s) => ({
      student_id: s.student_id,
      display_name: s.display_name,
      age_range: s.age_range,
      family_id: s.family_id,
      division: divisionByStudent.get(s.student_id) ?? null,
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

/**
 * "Families joined" — the number of DISTINCT family accounts on the roster. A
 * self-managed adult (college team) has no family account (`family_id` null) and
 * is never counted as a family, though they still appear on the roster.
 */
export function countFamilies(roster: AffiliatedStudent[]): number {
  return new Set(
    roster.map((s) => s.family_id).filter((id): id is string => Boolean(id)),
  ).size;
}

/* ────────────────────────────  DB wrappers  ──────────────────────────────── */

/**
 * The studio's roster: dancers actively affiliated to it, sorted by name.
 * Caller passes a client scoped appropriately (admin for the concierge/studio
 * areas, which already resolve the caller's own studio before calling).
 */
export async function loadAffiliatedStudents(
  db: SupabaseClient,
  employerId: string,
): Promise<AffiliatedStudent[]> {
  const { data: affRows, error: affErr } = await db
    .from("affiliations")
    .select("subject_id, division")
    .eq("employer_id", employerId)
    .eq("subject_kind", "student")
    .eq("status", "active");
  if (affErr) {
    console.error("[roster] affiliation read failed:", affErr.message);
    return [];
  }
  const affiliations = (affRows ?? []) as AffiliationRow[];
  const ids = affiliations.map((a) => a.subject_id);
  if (ids.length === 0) return [];

  const { data: studentRows, error: studErr } = await db
    .from("students")
    .select("student_id, display_name, age_range, family_id")
    .in("student_id", ids);
  if (studErr) {
    console.error("[roster] student read failed:", studErr.message);
    return [];
  }
  return buildRoster(affiliations, (studentRows ?? []) as StudentRow[]);
}

/**
 * "Families joined" for a studio, sourced from `affiliations` — the same source
 * of truth as the roster and the family "This Week" view. Robust to the join
 * code being regenerated (which resets `use_count`).
 */
export async function countStudioFamilies(
  db: SupabaseClient,
  employerId: string,
): Promise<number> {
  return countFamilies(await loadAffiliatedStudents(db, employerId));
}
