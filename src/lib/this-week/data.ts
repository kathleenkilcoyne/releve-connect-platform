// "This Week" — mock data + the three data/access SEAMS.
//
//   getThisWeek(viewer)      → the week bundle for a viewer
//   getCommunications(viewer)→ the studio<->family comms for a viewer
//   hasFamilyAccess(account) → the single entitlement/access check
//
// Pass one: these return hardcoded values. Pass two: same signatures, Supabase
// queries behind them, and the UI does not change. That is the whole point of
// keeping every screen behind these functions.

import type {
  Communication,
  AccessResult,
  CalendarEvent,
  DashboardRollup,
  GuardianAccount,
  ProfessionalViewer,
  StudentProfile,
  StudentViewer,
  Viewer,
  WeekBundle,
  WeekRange,
} from "./types";

/* ─────────────────────────  Sample people (static)  ─────────────────────── */

/** The professional viewer from the mockup: Kathleen — Dancer · Teacher. */
export const KATHLEEN: ProfessionalViewer = {
  kind: "professional",
  id: "pro_kathleen",
  displayName: "Kathleen",
  roles: ["Dancer", "Teacher"],
  tagline: "one calendar, every role",
};

/** The paying guardian account (REVENUE seam lives here). */
export const GUARDIAN_KATHLEEN: GuardianAccount = {
  id: "guardian_kathleen",
  displayName: "Kathleen McAree",
  email: "family@example.com",
  subscriptionStatus: "active", // flip to gate the child's-week view later
  managedStudentIds: ["student_ava"],
};

/** The minor (PASSPORT seam: family-only, never public). */
export const STUDENT_AVA: StudentProfile = {
  id: "student_ava",
  displayName: "Ava",
  guardianId: "guardian_kathleen",
  isMinor: true,
  visibility: "family_only",
  studioAffiliation: "Bergen Ballet",
  managedByLabel: "managed by Kathleen",
};

export const AVA_VIEWER: StudentViewer = {
  kind: "student",
  student: STUDENT_AVA,
  guardian: GUARDIAN_KATHLEEN,
};

/* ─────────────────────────────  The week frame  ─────────────────────────── */
// A fixed week for the static prototype (Mon Jan 12 – Sun Jan 18). "Today" is
// pinned to Thursday so the highlight is visible without a live clock.

const WEEK_MON_JAN_12: WeekRange = {
  label: "Mon Jan 12 – Sun Jan 18",
  timezone: "America/New_York",
  days: [
    { key: "mon", label: "Monday", dateLabel: "Jan 12", isToday: false },
    { key: "tue", label: "Tuesday", dateLabel: "Jan 13", isToday: false },
    { key: "wed", label: "Wednesday", dateLabel: "Jan 14", isToday: false },
    { key: "thu", label: "Thursday", dateLabel: "Jan 15", isToday: true },
    { key: "fri", label: "Friday", dateLabel: "Jan 16", isToday: false },
    { key: "sat", label: "Saturday", dateLabel: "Jan 17", isToday: false },
    { key: "sun", label: "Sunday", dateLabel: "Jan 18", isToday: false },
  ],
};

/* ───────────────  Professional week — exact mockup card inventory  ───────── */

const KATHLEEN_EVENTS: CalendarEvent[] = [
  {
    id: "evt_company_class",
    day: "mon",
    category: "taking",
    title: "Company Class",
    time: { start: "10:00 AM" },
    detail: ["Steps on Broadway, NYC", "travel 55 min from home"],
  },
  {
    id: "evt_ballet_iii",
    day: "mon",
    category: "teaching",
    title: "Ballet III",
    time: { start: "4:30 PM" },
    detail: ["Bergen Ballet, Ridgewood", "Ages 12–14"],
    pay: { rate: "$65/hr", status: "paid" },
    attachments: [
      { id: "att_bally_music", kind: "music", label: "class music" },
      { id: "att_bally_notes", kind: "notes", label: "lesson notes" },
    ],
  },
  {
    id: "evt_sub_jazz_ii",
    day: "tue",
    category: "subbing",
    title: "Sub — Jazz II",
    time: { start: "6:00 PM" },
    detail: ["Bergen Ballet, Ridgewood"],
    pay: { rate: "$55/hr", status: "pending" },
  },
  {
    id: "evt_private_pointe",
    day: "thu",
    category: "teaching",
    title: "Private Lesson — Pointe",
    time: { start: "4:30 PM" },
    detail: ["Bergen Ballet", "1:1"],
    pay: { rate: "$90/hr", status: "unpaid" },
  },
  {
    id: "evt_swing_available",
    day: "thu",
    category: "availability",
    title: "Available for The Swing",
    time: { start: "4:00 PM", end: "9:00 PM" },
    detail: ["within 25 miles"],
  },
  {
    id: "evt_marymount_deadline",
    day: "fri",
    category: "deadline",
    title: "Deadline — Marymount prescreen",
    time: { start: "11:59 PM" },
    detail: ["submission due"],
    attachments: [
      { id: "att_prescreen_video", kind: "video", label: "prescreen video" },
      { id: "att_essay", kind: "document", label: "essay" },
    ],
  },
  {
    id: "evt_winter_showcase",
    day: "sat",
    category: "performance",
    title: "Performance — Winter Showcase",
    time: { start: "6:00 PM" },
    detail: ["bergenPAC stage", "call 4:30 PM"],
    attachments: [
      { id: "att_show_music", kind: "music", label: "music" },
      { id: "att_costume_sheet", kind: "costume", label: "costume sheet" },
      { id: "att_run_order", kind: "runOrder", label: "run order" },
    ],
  },
];

/** Role rollups stack below the personal week. */
const KATHLEEN_ROLLUPS: DashboardRollup[] = [
  {
    id: "rollup_teacher",
    title: "Teacher Dashboard · This Week",
    items: [
      {
        label: "Ballet III",
        detail: "Mon 4:30 PM · Bergen Ballet · Ages 12–14",
        pay: { rate: "$65/hr", status: "paid" },
      },
      {
        label: "Sub — Jazz II",
        detail: "Tue 6:00 PM · Bergen Ballet",
        pay: { rate: "$55/hr", status: "pending" },
      },
      {
        label: "Private Lesson — Pointe",
        detail: "Thu 4:30 PM · Bergen Ballet · 1:1",
        pay: { rate: "$90/hr", status: "unpaid" },
      },
    ],
  },
];

/* ─────────────────  Child's week — Ava (family-only view)  ───────────────── */

const AVA_EVENTS: CalendarEvent[] = [
  {
    id: "evt_ava_ballet_iii",
    day: "mon",
    category: "taking",
    title: "Ballet III",
    time: { start: "4:30 PM" },
    detail: ["Bergen Ballet, Ridgewood", "with Miss Kathleen"],
  },
  {
    id: "evt_ava_jazz_ii",
    day: "wed",
    category: "taking",
    title: "Jazz II",
    time: { start: "5:30 PM" },
    detail: ["Bergen Ballet, Ridgewood"],
  },
  {
    id: "evt_ava_showcase_call",
    day: "sat",
    category: "performance",
    title: "Winter Showcase — Call",
    time: { start: "4:30 PM" },
    detail: ["bergenPAC stage", "showtime 6:00 PM"],
    attachments: [{ id: "att_ava_costume", kind: "costume", label: "costume sheet" }],
  },
];

const AVA_ROLLUPS: DashboardRollup[] = []; // students have no role dashboards

/* ───────────────  Studio <-> family communications (static seams)  ───────── */
// COORDINATION TOOL. Present as visible static UI + typed models. No live wiring.

const AVA_COMMUNICATIONS: Communication[] = [
  {
    id: "comm_alert_jazz_moved",
    kind: "alert",
    severity: "change",
    from: "Bergen Ballet",
    timestamp: "Mon, 9:12 AM",
    relatedEventId: "evt_ava_jazz_ii",
    title: "Wednesday Jazz II moved to 6:15 PM",
    body: "Studio A is booked for the showcase build — Jazz II runs 45 min later this week only.",
  },
  {
    id: "comm_announce_tickets",
    kind: "announcement",
    from: "Bergen Ballet",
    timestamp: "Sun, 4:00 PM",
    title: "Winter Showcase tickets are on sale",
    body: "Two per family reserved through Friday, then general release.",
  },
  {
    id: "comm_note_showcase_prep",
    kind: "note",
    from: "Miss Kathleen",
    timestamp: "Sun, 6:30 PM",
    relatedEventId: "evt_ava_showcase_call",
    label: "Showcase prep — hair in a bun, bring pointe shoes",
    attachment: { id: "att_prep_sheet", kind: "document", label: "prep sheet" },
  },
  {
    id: "comm_message_from_family",
    kind: "message",
    direction: "from_family",
    from: "Kathleen (parent)",
    timestamp: "Sun, 7:02 PM",
    body: "Thanks! Ava will be there for the 4:30 call.",
  },
];

/* ─────────────────────────────────  Seams  ──────────────────────────────── */

/**
 * The one entry point every "This Week" screen calls. Pass one returns the
 * hardcoded bundle for the given viewer; pass two runs the query for the
 * viewer's own week ("the same week, filtered to the viewer").
 */
export function getThisWeek(viewer: Viewer): WeekBundle {
  if (viewer.kind === "student") {
    return {
      viewer,
      week: WEEK_MON_JAN_12,
      events: AVA_EVENTS,
      rollups: AVA_ROLLUPS,
    };
  }
  return {
    viewer,
    week: WEEK_MON_JAN_12,
    events: KATHLEEN_EVENTS,
    rollups: KATHLEEN_ROLLUPS,
  };
}

/**
 * The studio<->family communication loop for a viewer. Professionals get their
 * own (none seeded in pass one); a student's guardian sees the family thread.
 */
export function getCommunications(viewer: Viewer): Communication[] {
  return viewer.kind === "student" ? AVA_COMMUNICATIONS : [];
}

/**
 * The SINGLE family-subscription access check. Turning on billing later is a
 * change to this function's body only — every caller already asks it "may this
 * family see this?" Access is granted while trialing or active.
 */
export function hasFamilyAccess(account: GuardianAccount): AccessResult {
  const allowed =
    account.subscriptionStatus === "active" ||
    account.subscriptionStatus === "trialing";
  return { allowed, reason: account.subscriptionStatus };
}
