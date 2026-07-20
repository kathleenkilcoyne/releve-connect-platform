// "This Week" — the LIVE implementation of the three pass-one seams.
//
//   getThisWeek(viewer)       → buildLiveWeek()      (real sessions)
//   getCommunications(viewer) → the comms in that payload
//   hasFamilyAccess(account)  → resolveFamilyAccess()
//
// `data.ts` still holds the mock versions; it is now explicitly the DEMO source,
// used when nobody is signed in or a signed-in member has no calendar yet. This
// file is what runs for a real member.
//
// Everything here is SERVER-ONLY — it takes a cookie-backed Supabase client and
// the admin client, so it can never be imported into a client component.

import type { SupabaseClient } from "@supabase/supabase-js";

import { mergeWeek, toCalendarEvents, toCommunications } from "./adapters";
import { buildPayMap } from "./pay";
import {
  fetchCommunicationRows,
  fetchEarningsForSessions,
  fetchEngagements,
  fetchFamilySubscription,
  fetchGuardedStudents,
  fetchPersonalEvents,
  fetchStudentWeek,
  fetchSwingRadius,
  fetchTeachingWeek,
  type PersonalEventRow,
  type SessionWithClass,
} from "./queries";
import type {
  AccessResult,
  Communication,
  DashboardRollup,
  GuardianAccount,
  StudentProfile,
  SubscriptionStatus,
  WeekBundle,
} from "./types";
import { resolveWeek } from "./week";

type Client = SupabaseClient;

/**
 * The viewer's timezone. There is no per-user timezone column yet, so this is
 * the platform default and the class's own timezone does the real work (a class
 * carries `timezone`, so its wall-clock time is always correct). Add a user
 * preference later and thread it through here — nothing else changes.
 */
const DEFAULT_TIMEZONE = "America/New_York";

/** One child's week plus everything that hangs off it. */
export interface StudentWeek {
  bundle: WeekBundle;
  communications: Communication[];
  access: AccessResult;
}

/** Everything `/this-week` needs for one signed-in member. */
export interface LiveWeekPayload {
  professional: WeekBundle | null;
  students: StudentWeek[];
  /** True when the member has no classes and no children — nothing to show. */
  isEmpty: boolean;
}

/* ─────────────────────────────  Entitlement  ─────────────────────────────── */

const ENTITLED: SubscriptionStatus[] = ["active", "trialing"];

/**
 * The real entitlement check. Mirrors `hasFamilyAccess()` exactly so the rule
 * lives in one shape: access while active or trialing.
 *
 * A null status means the row was unreadable — which happens when a guardian
 * lacks the 'billing' permission. That is NOT a denial: a parent who can see the
 * calendar but not the invoice should still see the calendar. It resolves to
 * "none" for messaging purposes while access is granted on the calendar
 * permission they do hold.
 */
export function resolveFamilyAccess(status: string | null): AccessResult {
  if (status === null) return { allowed: true, reason: "none" };
  const reason = status as SubscriptionStatus;
  return { allowed: ENTITLED.includes(reason), reason };
}

/* ────────────────────────────  The live build  ───────────────────────────── */

/**
 * Build the signed-in member's week.
 *
 * Both halves come from ONE login and are served by two different RLS policies:
 *   · professional — classes where the caller is the assigned teacher
 *   · students     — classes their children are enrolled in
 * A member can have either, both, or neither.
 */
export async function buildLiveWeek(
  supabase: Client,
  admin: Client,
  userId: string,
  weekOffset = 0,
): Promise<LiveWeekPayload> {
  const week = resolveWeek(DEFAULT_TIMEZONE, weekOffset);

  // Who is this, professionally? (A guardian with no talent profile is fine —
  // that is a null row, not an error.) The error IS logged: a silently swallowed
  // failure here reads exactly like "this member has no profile", which would
  // hide their whole professional week without a trace.
  const { data: profileRow, error: profileError } = await supabase
    .from("talent_profiles")
    .select("profile_id, display_name, primary_role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[this-week] talent profile read failed:", profileError.message);
  }

  const profileId = profileRow?.profile_id as string | undefined;

  // The professional week has TWO sources — the studio's schedule (what they are
  // booked to teach) and their own entries (what they take, audition for, owe).
  // "One calendar, every role" is the merge of the two.
  const [teaching, personal, swingRadius, guarded] = await Promise.all([
    profileId
      ? fetchTeachingWeek(supabase, admin, profileId, week)
      : Promise.resolve<SessionWithClass[]>([]),
    profileId
      ? fetchPersonalEvents(supabase, profileId, week)
      : Promise.resolve<PersonalEventRow[]>([]),
    profileId ? fetchSwingRadius(supabase, profileId) : Promise.resolve(null),
    fetchGuardedStudents(supabase),
  ]);

  /* ── The professional week ───────────────────────────────────────────── */
  let professional: WeekBundle | null = null;
  if (profileRow) {
    // Pay is fetched ONLY here, on the member's own professional view. It is
    // never fetched for, or passed to, a child's week — a guardian has no
    // business seeing what their child's teacher is paid. RLS would refuse a
    // stranger anyway; this keeps the view layer from even asking.
    const payBySession = profileId
      ? buildPayMap(
          teaching,
          await fetchEngagements(supabase, profileId),
          await fetchEarningsForSessions(
            supabase,
            profileId,
            teaching.map((t) => t.session.session_id),
          ),
        )
      : new Map();

    const events = mergeWeek(
      teaching,
      "teacher",
      DEFAULT_TIMEZONE,
      personal,
      swingRadius,
      payBySession,
    );
    professional = {
      viewer: {
        kind: "professional",
        id: profileRow.profile_id as string,
        displayName: firstName((profileRow.display_name as string) ?? "You"),
        roles: rolesOf(profileRow),
        tagline: "one calendar, every role",
      },
      week,
      events,
      rollups: buildTeacherRollup(teaching, events),
    };
  }

  /* ── Each child's week ───────────────────────────────────────────────── */
  const students: StudentWeek[] = [];
  for (const child of guarded) {
    // A guardian without the 'calendar' permission gets no schedule at all —
    // RLS would return nothing anyway; skipping avoids rendering a false empty.
    const canSeeCalendar = child.permissions.includes("calendar");

    const sessions = canSeeCalendar
      ? await fetchStudentWeek(supabase, admin, child.student_id, week)
      : [];

    const [commRows, subscription] = await Promise.all([
      child.permissions.includes("messages") || canSeeCalendar
        ? fetchCommunicationRows(supabase, child.student_id)
        : Promise.resolve([]),
      fetchFamilySubscription(supabase, child.family_id),
    ]);

    const studioName = sessions[0]?.studioName ?? "Your studio";

    const student: StudentProfile = {
      id: child.student_id,
      displayName: child.display_name,
      guardianId: child.family_id,
      isMinor: true, // students carries only minors; adulthood transfers the record.
      visibility: "family_only",
      studioAffiliation: sessions[0]?.studioName ?? undefined,
      managedByLabel: "managed by you",
    };

    const guardian: GuardianAccount = {
      id: child.family_id,
      displayName: "Your family",
      email: "",
      subscriptionStatus: (subscription as SubscriptionStatus) ?? "none",
      managedStudentIds: guarded.map((g) => g.student_id),
    };

    students.push({
      bundle: {
        viewer: { kind: "student", student, guardian },
        week,
        events: toCalendarEvents(sessions, "student", DEFAULT_TIMEZONE),
        rollups: [], // students have no role dashboards
      },
      communications: toCommunications(commRows, DEFAULT_TIMEZONE, studioName, userId),
      access: resolveFamilyAccess(subscription),
    });
  }

  return {
    professional,
    students,
    isEmpty:
      (professional?.events.length ?? 0) === 0 &&
      students.every((s) => s.bundle.events.length === 0),
  };
}

/* ──────────────────────────────  Small helpers  ──────────────────────────── */

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

/**
 * Roles for the header line ("Kathleen — Dancer · Teacher").
 *
 * `talent_profiles` currently stores only `primary_role`; the multi-role list
 * CLAUDE.md §3 describes lives in a join table that this view does not read yet,
 * so the header shows the one role we can state truthfully rather than guessing
 * at a fuller list.
 */
function rolesOf(row: { primary_role?: unknown }): string[] {
  const primary = String(row.primary_role ?? "").trim();
  if (!primary) return ["Member"];
  return [primary.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())];
}

/**
 * The "Teacher Dashboard · This Week" rollup, built from the same sessions AND
 * the same pay map the week renders — so the card and the rollup can never
 * disagree about what a class pays.
 */
function buildTeacherRollup(
  sessions: SessionWithClass[],
  events: ReturnType<typeof toCalendarEvents>,
): DashboardRollup[] {
  const teaching = events.filter((e) => e.category === "teaching");
  if (teaching.length === 0) return [];

  const dayLabel = new Map(
    sessions.map((s) => [
      s.session.session_id,
      new Intl.DateTimeFormat("en-US", {
        timeZone: DEFAULT_TIMEZONE,
        weekday: "short",
      }).format(new Date(s.session.starts_at)),
    ]),
  );

  return [
    {
      id: "rollup_teacher",
      title: "Teacher Dashboard · This Week",
      items: teaching.map((e) => ({
        label: e.title,
        detail: [dayLabel.get(e.id), e.time.start, ...e.detail].filter(Boolean).join(" · "),
        ...(e.pay ? { pay: e.pay } : {}),
      })),
    },
  ];
}
