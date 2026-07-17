// "This Week" — the typed data model (pass one).
//
// This file is the SEAM. Pass one fills these shapes with hardcoded data; pass
// two swaps the data source (Supabase queries) behind the very same types with
// no UI rewrite. Every type here was chosen with the three jobs of "This Week"
// in mind:
//   1. PASSPORT      — safe entry for minors + families (account ownership,
//                      guardianship, privacy are load-bearing, not add-ons).
//   2. COORDINATION  — the studio <-> family loop (alerts, announcements,
//                      messages, prep notes) modelled as `Communication`.
//   3. REVENUE       — the family subscription: entitlement lives on the
//                      guardian account (`SubscriptionStatus`) so access can be
//                      gated later without re-architecture.
//
// Nothing here imports React or Next — keep it portable and unit-testable.

/* ────────────────────────────  Calendar core  ──────────────────────────── */

/** Every category a card can carry. The first seven are also filter chips
 *  (see `categories.ts`); availability/deadline/performance appear only as
 *  card tags, per the spec ("extra event types as card tags"). */
export type EventCategory =
  | "taking"
  | "teaching"
  | "subbing"
  | "rehearsing"
  | "auditioning"
  | "coaching"
  | "personal"
  | "availability"
  | "deadline"
  | "performance";

/** Payment state for teaching/booked cards. Display-only in pass one. */
export type PaymentStatus = "unpaid" | "pending" | "paid";

export interface PayInfo {
  /** Human string for pass one, e.g. "$65/hr". Pass two: cents + unit + currency. */
  rate: string;
  status: PaymentStatus;
}

/** The little pill buttons on a card (music, notes, video, essay, run order…). */
export type AttachmentKind =
  | "music"
  | "notes"
  | "video"
  | "document"
  | "runOrder"
  | "costume";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  /** Short label shown on the chip, e.g. "class music". */
  label: string;
}

/** Display times for pass one. Pass two swaps to ISO instants + `timezone`. */
export interface EventTime {
  start: string; // "10:00 AM"
  end?: string; // "9:00 PM" — present for ranges (e.g. Swing availability)
}

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/**
 * One card in the week. Named `CalendarEvent` (not `Event`) to avoid clashing
 * with the DOM's global `Event`; the `Event` alias below satisfies the spec's
 * naming while keeping call sites unambiguous.
 */
export interface CalendarEvent {
  id: string;
  day: WeekdayKey;
  category: EventCategory;
  /** Bold serif title. May be "Type — Name" ("Sub — Jazz II"). */
  title: string;
  time: EventTime;
  /** Role-smart detail line, rendered joined by " · ". */
  detail: string[];
  attachments?: Attachment[];
  /** Teaching / booked cards carry pay rate + status; others omit it. */
  pay?: PayInfo;
}

/** Spec-named alias. Import `CalendarEvent` in code; `Event` exists for parity. */
export type Event = CalendarEvent;

/* ────────────────────────────  Week framing  ───────────────────────────── */

export interface DayMeta {
  key: WeekdayKey;
  /** "MONDAY" — uppercased in the UI. */
  label: string;
  /** "JAN 12". */
  dateLabel: string;
  isToday: boolean;
}

export interface WeekRange {
  /** "Mon Jan 12 – Sun Jan 18". */
  label: string;
  days: DayMeta[];
  /** Timezone seam — pass one is a caption; pass two resolves real instants. */
  timezone: string;
}

/* ─────────────────────────  Role dashboard rollups  ─────────────────────── */

export interface RollupItem {
  label: string; // "Ballet III"
  detail: string; // "Mon 4:30 PM · Bergen Ballet"
  pay?: PayInfo;
}

export interface DashboardRollup {
  id: string;
  /** "TEACHER DASHBOARD · THIS WEEK". */
  title: string;
  items: RollupItem[];
}

/* ───────────────────────────  The family layer  ─────────────────────────── */
//  PASSPORT + REVENUE seams. These model minors, guardianship and entitlement
//  as first-class shapes NOW, so the safety rules (never public, family-only)
//  and billing gate are enforceable the moment real data arrives.

/** Family subscription state. `hasFamilyAccess()` reads this to gate access. */
export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export interface GuardianAccount {
  id: string;
  /** "Kathleen McAree". */
  displayName: string;
  email: string;
  /** REVENUE ON-RAMP: entitlement lives on the paying guardian account. */
  subscriptionStatus: SubscriptionStatus;
  /** The children this guardian owns/manages. */
  managedStudentIds: string[];
}

export interface StudentProfile {
  id: string;
  /** "Ava". */
  displayName: string;
  guardianId: string;
  /** PASSPORT: minors are parent-managed. */
  isMinor: boolean;
  /** Literal, not a union with "public": a minor is NEVER public / on the
   *  Roster / in reviews. Enforced by construction here and by RLS in pass two. */
  visibility: "family_only";
  studioAffiliation?: string; // "Bergen Ballet"
  /** "managed by Kathleen" — shown under the student's name. */
  managedByLabel: string;
}

/* ───────────────────  Studio <-> family communication seam  ─────────────── */
//  COORDINATION TOOL. Four surfaces, one discriminated union. Pass one renders
//  these statically; pass two wires delivery. Nothing here presumes a transport,
//  so live messaging/push can layer on without a rewrite.

export type CommunicationKind = "alert" | "announcement" | "message" | "note";

interface CommunicationBase {
  id: string;
  kind: CommunicationKind;
  /** Who it's from, e.g. "Bergen Ballet". */
  from: string;
  /** Display timestamp in pass one; ISO instant in pass two. */
  timestamp: string;
  /** Optional anchor to a specific card/day so it can surface in context. */
  relatedEventId?: string;
}

/** (a) change & cancellation alerts. */
export interface ChangeAlertComm extends CommunicationBase {
  kind: "alert";
  severity: "change" | "cancellation";
  title: string;
  body: string;
}

/** (b) studio announcements. */
export interface AnnouncementComm extends CommunicationBase {
  kind: "announcement";
  title: string;
  body: string;
}

/** (c) two-way messaging (parent <-> studio/teacher). */
export interface MessageComm extends CommunicationBase {
  kind: "message";
  direction: "from_studio" | "from_family";
  body: string;
}

/** (d) prep & notes to families (reuses the attachment-chip anatomy). */
export interface NoteComm extends CommunicationBase {
  kind: "note";
  label: string;
  attachment?: Attachment;
}

export type Communication =
  | ChangeAlertComm
  | AnnouncementComm
  | MessageComm
  | NoteComm;

/* ─────────────────────────────  The viewer  ─────────────────────────────── */
//  Each view is "the same week, filtered to the viewer". Pass one uses a static
//  switch; pass two derives the viewer from the authenticated session.

export interface ProfessionalViewer {
  kind: "professional";
  id: string;
  /** "Kathleen". */
  displayName: string;
  /** ["Dancer", "Teacher"] — drives the "one calendar, every role" header. */
  roles: string[];
  /** "one calendar, every role". */
  tagline: string;
}

export interface StudentViewer {
  kind: "student";
  student: StudentProfile;
  guardian: GuardianAccount;
}

export type Viewer = ProfessionalViewer | StudentViewer;

/* ───────────────────────────  Access / entitlement  ────────────────────── */

/** Result of the single family access-check seam. */
export interface AccessResult {
  allowed: boolean;
  /** The status that produced the decision — handy for gate messaging. */
  reason: SubscriptionStatus;
}

/** What `getThisWeek()` returns: everything one view needs to render. */
export interface WeekBundle {
  viewer: Viewer;
  week: WeekRange;
  events: CalendarEvent[];
  rollups: DashboardRollup[];
}
