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
import { markFamilyAcks } from "./acknowledgements";
import { familyAccessFrom } from "./entitlement";
import { mergeFamilyWeek, familyChildNames, type ChildStream } from "./family";
import { buildPayMap } from "./pay";
import {
  fetchAffiliatedEmployerIds,
  fetchCommunicationRows,
  fetchEarningsForSessions,
  fetchEngagements,
  fetchFamilyAckRows,
  fetchFamilyStudioWide,
  fetchFamilySubscription,
  fetchGuardedStudents,
  fetchPersonalEvents,
  fetchSelfMembers,
  fetchStudentWeek,
  fetchSwingRadius,
  fetchTeachingWeek,
  type PersonalEventRow,
  type SessionWithClass,
} from "./queries";
import type {
  AccessResult,
  CalendarEvent,
  Communication,
  DashboardRollup,
  WeekBundle,
  WeekRange,
} from "./types";
import { resolveWeek, type ResolvedWeek } from "./week";
import { memberLabelOf, DEFAULT_MEMBER_LABEL } from "@/lib/studio/team-types";
import type { OrgBrand } from "@/lib/studio/branding";

type Client = SupabaseClient;

/**
 * The viewer's timezone. There is no per-user timezone column yet, so this is
 * the platform default and the class's own timezone does the real work (a class
 * carries `timezone`, so its wall-clock time is always correct). Add a user
 * preference later and thread it through here — nothing else changes.
 */
const DEFAULT_TIMEZONE = "America/New_York";

/**
 * ONE merged week for a whole family (or a self-managed member). Every child's
 * enrolled items and the family-level studio-wide items, de-duped by session id
 * and labeled by child (`event.who`) — see mergeFamilyWeek.
 */
export interface FamilyWeek {
  week: WeekRange;
  events: CalendarEvent[];
  /** The children in this family (for the header); one entry for a self member. */
  childNames: string[];
  /** The studio / team name(s) these items come from. For a self member this is
   *  resolved from their active affiliation, so the team shows even before any
   *  events exist. */
  studioNames: string[];
  /** True for the guardian-less dance-team path (per-self, no sibling merge). */
  selfManaged: boolean;
  /** What the team calls its members (from the org's member_label), defaulting to
   *  "Team Members". Used for the self-managed header line. */
  memberLabel: string;
  /** The primary affiliated org's branding (logo/accents/motto), for the
   *  co-branded header. Null when there is no affiliated org. */
  brand: OrgBrand | null;
  access: AccessResult;
  communications: Communication[];
}

/** Everything `/this-week` needs for one signed-in member. */
export interface LiveWeekPayload {
  professional: WeekBundle | null;
  /** The merged family / self week (null when the member guards no one and is
   *  not a self-managed dancer). */
  family: FamilyWeek | null;
  /** True when the member has no professional and no family week — nothing to show. */
  isEmpty: boolean;
}

/* ─────────────────────────────  Entitlement  ─────────────────────────────── */

/**
 * The real entitlement check. Delegates to the ONE shared rule (entitlement.ts)
 * so it can never drift from the demo path's `hasFamilyAccess()`: active is
 * always entitled; a free-pilot trial is entitled only until `trial_ends_at`
 * passes; a null status (guardian without 'billing') still sees the calendar.
 */
export function resolveFamilyAccess(
  status: string | null,
  trialEndsAt: string | null = null,
): AccessResult {
  return familyAccessFrom(status, trialEndsAt);
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

  /* ── The merged family week ──────────────────────────────────────────── */
  // One personalized week for the whole family: every child's enrolled items PLUS
  // the family-level studio-wide items, merged and de-duped by session id. The
  // studio-wide lane is resolved ONCE here (not per child) — that is the guard
  // against a Full Studio Event surfacing twice in a two-child family.
  let family: FamilyWeek | null = null;
  if (guarded.length > 0) {
    family = await buildFamilyWeek(supabase, admin, userId, guarded, week, false);
  } else {
    // No children guarded → maybe a self-managed adult (the college team). Their
    // week resolves per-self, no guardian layer.
    const selfMembers = await fetchSelfMembers(supabase);
    if (selfMembers.length > 0) {
      family = await buildFamilyWeek(supabase, admin, userId, selfMembers, week, true);
    }
  }

  return {
    professional,
    family,
    isEmpty: (professional?.events.length ?? 0) === 0 && (family?.events.length ?? 0) === 0,
  };
}

/**
 * Resolve and merge a set of "members" (a guardian's children, or a single
 * self-managed adult) into ONE week. Shared by the guardian path and the
 * self-managed college path; `selfManaged` only changes framing + comms, not the
 * merge/de-dupe (studio-wide is always resolved once, de-duped by session id).
 */
async function buildFamilyWeek(
  supabase: Client,
  admin: Client,
  userId: string,
  members: Awaited<ReturnType<typeof fetchGuardedStudents>>,
  week: ResolvedWeek,
  selfManaged: boolean,
): Promise<FamilyWeek> {
  // A guardian's children share one family_account; a self-managed adult has none.
  const familyId = members[0]?.family_id ?? null;

  // Per-member enrolled streams (only members whose guardian holds 'calendar';
  // for a self member the permission set is theirs).
  const childStreams: ChildStream[] = [];
  const calendarStudentIds: string[] = [];
  for (const m of members) {
    if (!m.permissions.includes("calendar")) continue;
    calendarStudentIds.push(m.student_id);
    const sessions = await fetchStudentWeek(supabase, admin, m.student_id, week);
    childStreams.push({ childId: m.student_id, childName: m.display_name, sessions });
  }

  // Studio-wide events at the family's studio(s) — resolved ONCE, de-duped in the
  // merge by session id (never per child).
  const employerIds = await fetchAffiliatedEmployerIds(supabase, calendarStudentIds);
  const studioWide = await fetchFamilyStudioWide(supabase, admin, employerIds, week);

  // The "Got it" loop is offered to guardian families (who have a family_account
  // and act as guardians) AND to a self-managed adult (dance team). The adult has
  // no guardian / family_account, so they acknowledge AS THEMSELVES: the ack is
  // keyed to their own student row rather than to a family. Without this, a coach
  // could never get an acknowledgement count from adult members.
  const selfStudentId = selfManaged ? members[0]?.student_id ?? null : null;
  const ackFamily = !selfManaged
    ? { familyId }
    : selfStudentId
      ? { familyId: null, selfStudentId }
      : undefined;
  const events = mergeFamilyWeek(childStreams, studioWide, DEFAULT_TIMEZONE, ackFamily);
  // A self member's whole week is their own — the per-child "who" label is noise.
  if (selfManaged) for (const e of events) delete e.who;

  // Stamp which cards this family has already acknowledged (grey → green ✓).
  if (ackFamily) {
    const ackRows = await fetchFamilyAckRows(supabase, events.map((e) => e.id));
    markFamilyAcks(events, ackRows);
  }

  // One family account → one entitlement (guardian's children share it). A
  // self-managed adult has no family_account: null status resolves to "allowed"
  // (free through the pilot, same as a guardian without 'billing'), and we skip
  // the query rather than pass an empty string to a uuid filter.
  const subscription = familyId
    ? await fetchFamilySubscription(supabase, familyId)
    : { status: null, trialEndsAt: null };
  const access = resolveFamilyAccess(subscription.status, subscription.trialEndsAt);

  // Studio/team names derived from scheduled items (existing behavior).
  const orgNames = new Set(
    [...childStreams.flatMap((s) => s.sessions), ...studioWide]
      .map((x) => x.studioName)
      .filter((n): n is string => Boolean(n)),
  );

  // Resolve the primary affiliated org's identity + BRANDING from the member's
  // ACTIVE AFFILIATION (employerIds), NOT from schedule items — so the co-branded
  // header renders for both self members and families, even before any events
  // exist. For a self member we also fold the org name into studioNames and carry
  // its member_label; guardians keep their session-derived names.
  let memberLabel = DEFAULT_MEMBER_LABEL;
  let brand: OrgBrand | null = null;
  if (employerIds.length > 0) {
    const { data: orgs } = await admin
      .from("employer_profiles")
      .select("employer_id, name, org_type, member_label, logo_url, brand_accent, brand_accent_2, team_motto")
      .in("employer_id", employerIds);
    const rows = (orgs ?? []) as {
      employer_id: string;
      name: string | null;
      org_type: string | null;
      member_label: string | null;
      logo_url: string | null;
      brand_accent: string | null;
      brand_accent_2: string | null;
      team_motto: string | null;
    }[];
    const primary = rows.find((r) => r.employer_id === employerIds[0]) ?? rows[0];
    if (primary) {
      memberLabel = memberLabelOf(primary.member_label);
      brand = {
        name: (primary.name ?? "").trim() || (selfManaged ? "Your team" : "Your studio"),
        logoUrl: primary.logo_url,
        accent: primary.brand_accent,
        accent2: primary.brand_accent_2,
        motto: primary.team_motto,
        orgType: primary.org_type,
      };
    }
    if (selfManaged) {
      for (const r of rows) {
        const n = (r.name ?? "").trim();
        if (n) orgNames.add(n);
      }
    }
  }

  const studioNames = [...orgNames];
  const primaryStudio = studioNames[0] ?? (selfManaged ? "your team" : "your studio");

  // Merged communications across all members, de-duped by id.
  const commsById = new Map<string, Communication>();
  for (const m of members) {
    if (!(m.permissions.includes("messages") || m.permissions.includes("calendar"))) continue;
    const rows = await fetchCommunicationRows(supabase, m.student_id);
    for (const c of toCommunications(rows, DEFAULT_TIMEZONE, primaryStudio, userId)) {
      commsById.set(c.id, c);
    }
  }

  return {
    week,
    events,
    childNames: familyChildNames(members.map((m) => ({ childId: m.student_id, childName: m.display_name, sessions: [] }))),
    studioNames,
    selfManaged,
    memberLabel,
    brand,
    access,
    communications: [...commsById.values()],
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
