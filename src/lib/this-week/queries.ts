// "This Week" — the real Supabase reads behind the three seams.
//
// This is the file pass one was designed to make possible: the UI already asks
// `getThisWeek(viewer)` for a week, so replacing mock arrays with these queries
// changes no component.
//
// ── The security posture ──
// Reads go through the CALLER'S client, never the admin client. That is not a
// detail — it means RLS decides what a viewer sees, and this file cannot widen
// it by accident. Kathleen's professional week is served by `teaches_class`
// (she is the assigned teacher); Ava's week is served by
// `guardian_calendar_for_class` (she is the guardian). Same query shape, two
// different policies, and neither one can leak the other's rows.
//
// The admin client appears exactly once, in `materialiseSessions()`, and only to
// WRITE session rows the studio's own rule already implies. It never reads on a
// viewer's behalf.

import type { SupabaseClient } from "@supabase/supabase-js";

import { expandClassSessions, UnsupportedRecurrenceError, type ClassTemplate } from "./recurrence";
import type { ResolvedWeek } from "./week";

/* ─────────────────────────────  Row shapes  ──────────────────────────────── */

/** A class template joined to the studio that runs it. */
interface ClassRow extends ClassTemplate {
  employer_id: string;
  title: string;
  location: string | null;
  room: string | null;
  teacher_profile_id: string | null;
  kind: "class" | "rehearsal" | "performance";
  status: string;
  employer_profiles: { name: string } | null;
}

/** A concrete dated occurrence. */
export interface SessionRow {
  session_id: string;
  class_id: string;
  starts_at: string;
  ends_at: string | null;
  status: "scheduled" | "moved" | "canceled";
  note: string | null;
}

/** A session plus the class it belongs to — what the adapter turns into a card. */
export interface SessionWithClass {
  session: SessionRow;
  klass: ClassRow;
  /** The studio's display name, resolved for the card's detail line. */
  studioName: string | null;
}

export interface CommunicationRow {
  communication_id: string;
  kind: "alert" | "announcement" | "message" | "note";
  severity: "change" | "cancellation" | null;
  direction: "from_studio" | "from_family" | null;
  title: string | null;
  body: string | null;
  created_at: string;
  related_session_id: string | null;
  from_user_id: string | null;
  from_employer_id: string | null;
}

// The client type is loose on purpose: this module is called with both the
// cookie-backed server client and the admin client, which are the same shape.
// (No generated database types in this repo yet, so the default generics stand.)
type Client = SupabaseClient;

const CLASS_SELECT = `
  class_id, employer_id, title, location, room, teacher_profile_id,
  recurrence, default_start, default_end, timezone, series_start, series_end,
  kind, status,
  employer_profiles ( name )
`;

/* ────────────────────────  Session materialisation  ──────────────────────── */

/**
 * Turn the studio's recurrence RULES into dated session ROWS for this week.
 *
 * Sessions are materialised rather than computed on the fly so that a studio can
 * later edit ONE occurrence — move Wednesday's class, cancel it for a snow day —
 * without that override having to fight the rule it came from. A row can be
 * changed; a rule cannot be changed for a single week.
 *
 * Safe to call on every page load:
 *   · the insert is `ON CONFLICT DO NOTHING` against the (class_id, starts_at)
 *     key added in migration 20260720120000, so refreshing never duplicates;
 *   · rows already present are left exactly as they are, so a studio's manual
 *     "moved to 6:15" is never overwritten by the rule that originally made it.
 *
 * Uses the ADMIN client: only studio admins may write `class_sessions`, and this
 * is the platform acting on the studio's already-published rule, not a user
 * writing. It writes only what that rule implies — never anything viewer-derived.
 */
export async function materialiseSessions(
  admin: Client,
  classes: ClassRow[],
  week: ResolvedWeek,
): Promise<void> {
  const pending: { class_id: string; starts_at: string; ends_at: string | null }[] = [];

  for (const klass of classes) {
    if (klass.status !== "active") continue;
    try {
      for (const s of expandClassSessions(klass, week.startsAt, week.endsAtExclusive)) {
        pending.push({
          class_id: s.class_id,
          starts_at: s.starts_at.toISOString(),
          ends_at: s.ends_at ? s.ends_at.toISOString() : null,
        });
      }
    } catch (err) {
      // One studio's unsupported rule must not blank out the whole calendar —
      // skip that class, keep the rest of the week, and make the cause loud in
      // the server log so it can be fixed.
      if (err instanceof UnsupportedRecurrenceError) {
        console.error(
          `[this-week] class ${klass.class_id} ("${klass.title}") has an unsupported recurrence and was skipped:`,
          err.message,
        );
        continue;
      }
      throw err;
    }
  }

  if (pending.length === 0) return;

  const { error } = await admin
    .from("class_sessions")
    .upsert(pending, { onConflict: "class_id,starts_at", ignoreDuplicates: true });

  if (error) {
    console.error("[this-week] failed to materialise sessions:", error.message);
  }
}

/** Read the week's sessions THROUGH RLS — this is what actually renders. */
async function readSessions(
  supabase: Client,
  classIds: string[],
  week: ResolvedWeek,
): Promise<SessionRow[]> {
  if (classIds.length === 0) return [];

  const { data, error } = await supabase
    .from("class_sessions")
    .select("session_id, class_id, starts_at, ends_at, status, note")
    .in("class_id", classIds)
    .gte("starts_at", week.startsAt.toISOString())
    .lt("starts_at", week.endsAtExclusive.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("[this-week] session read failed:", error.message);
    return [];
  }
  return (data ?? []) as SessionRow[];
}

/** Stitch sessions back to their class + studio name. */
function joinSessions(sessions: SessionRow[], classes: ClassRow[]): SessionWithClass[] {
  const byId = new Map(classes.map((c) => [c.class_id, c]));
  return sessions.flatMap((session) => {
    const klass = byId.get(session.class_id);
    if (!klass) return []; // RLS let the session through but not the class — skip.
    return [{ session, klass, studioName: klass.employer_profiles?.name ?? null }];
  });
}

/* ───────────────────────────  Professional week  ─────────────────────────── */

/**
 * The classes this talent profile is ASSIGNED TO TEACH, and their sessions.
 *
 * RLS (`studio_classes_teacher_read` / `class_sessions_teacher_read`) already
 * restricts this to classes where the caller owns `teacher_profile_id`, so the
 * explicit filter below is belt-and-braces, not the security boundary.
 */
export async function fetchTeachingWeek(
  supabase: Client,
  admin: Client,
  profileId: string,
  week: ResolvedWeek,
): Promise<SessionWithClass[]> {
  const { data, error } = await supabase
    .from("studio_classes")
    .select(CLASS_SELECT)
    .eq("teacher_profile_id", profileId)
    .eq("status", "active");

  if (error) {
    console.error("[this-week] teaching class read failed:", error.message);
    return [];
  }

  const classes = (data ?? []) as unknown as ClassRow[];
  if (classes.length === 0) return [];

  await materialiseSessions(admin, classes, week);
  const sessions = await readSessions(supabase, classes.map((c) => c.class_id), week);
  return joinSessions(sessions, classes);
}

/* ──────────────────────────────  Family week  ────────────────────────────── */

/** A student the caller guards, with the family account that pays for them. */
export interface GuardedStudent {
  student_id: string;
  display_name: string;
  family_id: string;
  age_range: string | null;
  /** Guardian's own permission set — gates which surfaces render. */
  permissions: string[];
}

/**
 * The children the signed-in user is a guardian of.
 *
 * `students` has NO public or anon policy — a minor is unreachable except
 * through a guardianship row. This is the only path to a student record in the
 * whole app, and it runs as the caller.
 */
export async function fetchGuardedStudents(supabase: Client): Promise<GuardedStudent[]> {
  const { data, error } = await supabase
    .from("guardianships")
    .select("permissions, students ( student_id, display_name, family_id, age_range )")
    .order("is_primary", { ascending: false });

  if (error) {
    console.error("[this-week] guardianship read failed:", error.message);
    return [];
  }

  // The embedded `students` relation comes back untyped without generated DB
  // types; narrow it here rather than letting `any` spread into the caller.
  type GuardianshipJoin = {
    permissions: string[] | null;
    students: {
      student_id: string;
      display_name: string;
      family_id: string;
      age_range: string | null;
    } | null;
  };

  return ((data ?? []) as unknown as GuardianshipJoin[]).flatMap((row) => {
    const s = row.students;
    if (!s) return [];
    return [{
      student_id: s.student_id,
      display_name: s.display_name,
      family_id: s.family_id,
      age_range: s.age_range,
      permissions: (row.permissions ?? []) as string[],
    }];
  });
}

/**
 * A student's week: the classes they are enrolled in, and those classes'
 * sessions. Served by `guardian_calendar_for_class`, so it requires the
 * 'calendar' permission — a guardian granted only 'messages' correctly sees
 * nothing here.
 */
export async function fetchStudentWeek(
  supabase: Client,
  admin: Client,
  studentId: string,
  week: ResolvedWeek,
): Promise<SessionWithClass[]> {
  const { data: enrolled, error: enrollErr } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("status", "active");

  if (enrollErr) {
    console.error("[this-week] enrollment read failed:", enrollErr.message);
    return [];
  }

  const classIds = ((enrolled ?? []) as { class_id: string }[]).map((e) => e.class_id);
  if (classIds.length === 0) return [];

  const { data, error } = await supabase
    .from("studio_classes")
    .select(CLASS_SELECT)
    .in("class_id", classIds)
    .eq("status", "active");

  if (error) {
    console.error("[this-week] student class read failed:", error.message);
    return [];
  }

  const classes = (data ?? []) as unknown as ClassRow[];
  if (classes.length === 0) return [];

  await materialiseSessions(admin, classes, week);
  const sessions = await readSessions(supabase, classes.map((c) => c.class_id), week);
  return joinSessions(sessions, classes);
}

/* ─────────────────────────────  Personal events  ─────────────────────────── */

/** A self-entered calendar entry (see the personal_events migration). */
export interface PersonalEventRow {
  event_id: string;
  category:
    | "taking"
    | "rehearsing"
    | "auditioning"
    | "coaching"
    | "performance"
    | "personal"
    | "deadline"
    | "availability";
  title: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  location: string | null;
  detail: string[] | null;
  note: string | null;
}

/**
 * The member's own entries for the week.
 *
 * Owner-only by RLS — there is no studio, teacher or guardian read path to this
 * table, so this returns rows only for the caller's own profile.
 */
export async function fetchPersonalEvents(
  supabase: Client,
  profileId: string,
  week: ResolvedWeek,
): Promise<PersonalEventRow[]> {
  const { data, error } = await supabase
    .from("personal_events")
    .select(
      "event_id, category, title, starts_at, ends_at, timezone, location, detail, note",
    )
    .eq("profile_id", profileId)
    .gte("starts_at", week.startsAt.toISOString())
    .lt("starts_at", week.endsAtExclusive.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("[this-week] personal events read failed:", error.message);
    return [];
  }
  return (data ?? []) as PersonalEventRow[];
}

/**
 * The standing Swing settings for a profile — the travel radius that a dated
 * 'availability' window is annotated with ("within 25 miles").
 *
 * Kept separate from the event on purpose: the radius is a PROFILE setting the
 * member manages once, not something re-entered per window.
 */
export async function fetchSwingRadius(
  supabase: Client,
  profileId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("swing_availability")
    .select("travel_radius_miles")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    console.error("[this-week] swing availability read failed:", error.message);
    return null;
  }
  return (data?.travel_radius_miles as number | null) ?? null;
}

/* ────────────────────────────  Communications  ───────────────────────────── */

/** The studio <-> family thread for a student, newest first. */
export async function fetchCommunicationRows(
  supabase: Client,
  studentId: string,
): Promise<CommunicationRow[]> {
  const { data, error } = await supabase
    .from("communications")
    .select(
      "communication_id, kind, severity, direction, title, body, created_at, related_session_id, from_user_id, from_employer_id",
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[this-week] communications read failed:", error.message);
    return [];
  }
  return (data ?? []) as CommunicationRow[];
}

/* ───────────────────────────  Family entitlement  ────────────────────────── */

/**
 * The family account's subscription state — the REVENUE seam's real source.
 * Guarded by `is_family_billing_member`, so a guardian without 'billing' gets
 * no row; that is treated as "no entitlement information", not "no access",
 * and the caller decides. Returns null when there is nothing readable.
 */
export async function fetchFamilySubscription(
  supabase: Client,
  familyId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("family_accounts")
    .select("subscription_status")
    .eq("family_id", familyId)
    .maybeSingle();

  if (error) {
    console.error("[this-week] family account read failed:", error.message);
    return null;
  }
  return (data?.subscription_status as string | undefined) ?? null;
}
