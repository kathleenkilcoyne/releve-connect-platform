// "This Week" — database rows → the display shapes the UI already renders.
//
// Pass one's types are DISPLAY types: `time: { start: "4:30 PM" }`, `day: "mon"`.
// The database stores instants. This module is the only place that translation
// happens, which keeps timezone reasoning in one file instead of smeared across
// components.
//
// The important rule encoded here: **teaching vs taking is not stored**. It is
// the viewer's relationship to the class. Ballet III is "teaching" when Kathleen
// looks at it and "taking" when Ava does — same row, same session, different
// card. `categoryFor()` is where that decision lives.

import type {
  CommunicationRow,
  PersonalEventRow,
  SessionWithClass,
} from "./queries";
import type {
  CalendarEvent,
  Communication,
  EventCategory,
  PayInfo,
} from "./types";
import { formatTime, weekdayKeyOf } from "./week";

/** How the viewer relates to a class — the input to category derivation. */
export type ViewerRelation = "teacher" | "student";

/**
 * The card's category. Intrinsic kinds (rehearsal, performance) win because
 * they are true for everyone; only a plain class is viewer-relative.
 */
function categoryFor(
  kind: SessionWithClass["klass"]["kind"],
  relation: ViewerRelation,
): EventCategory {
  if (kind === "performance") return "performance";
  if (kind === "rehearsal") return "rehearsing";
  return relation === "teacher" ? "teaching" : "taking";
}

/**
 * Build the detail line, joined by " · " in the card. Ordered most- to
 * least-specific and pruned of blanks so a class with no room does not render a
 * dangling separator.
 */
function detailFor(item: SessionWithClass, relation: ViewerRelation): string[] {
  const { klass, session, studioName } = item;
  const bits: string[] = [];

  // Where. Prefer the class's own location string; fall back to the studio name.
  if (klass.location) bits.push(klass.location);
  else if (studioName) bits.push(studioName);

  if (klass.room) bits.push(klass.room);

  // A student wants to know who is teaching; a teacher already knows.
  if (relation === "student" && klass.teacher_profile_id) {
    bits.push("with your teacher");
  }

  // A moved or cancelled session must say so on the card itself — a strikethrough
  // colour alone would fail anyone not perceiving it (a11y rule from pass one:
  // colour is never the only signal).
  if (session.status === "canceled") bits.push("CANCELED");
  else if (session.status === "moved") bits.push("moved this week");

  if (session.note) bits.push(session.note);

  return bits;
}

/** One session row → one card in the week. */
export function toCalendarEvent(
  item: SessionWithClass,
  relation: ViewerRelation,
  timeZone: string,
  /**
   * session_id → pay. Passed ONLY for the teacher's own view; a student's or
   * guardian's card must never carry what the teacher is paid, so callers on
   * that path simply omit it.
   */
  payBySession?: Map<string, PayInfo>,
): CalendarEvent {
  const { session, klass } = item;
  const startsAt = new Date(session.starts_at);
  const endsAt = session.ends_at ? new Date(session.ends_at) : null;

  // Belt-and-braces: even if a caller passed a map by mistake, a non-teacher
  // view never renders pay.
  const pay = relation === "teacher" ? payBySession?.get(session.session_id) : undefined;

  return {
    id: session.session_id,
    day: weekdayKeyOf(timeZone, startsAt),
    category: categoryFor(klass.kind, relation),
    title: klass.title,
    time: {
      start: formatTime(timeZone, startsAt),
      // Only range-style cards show an end time; a class shows its start, which
      // matches the mockup (the Swing availability band is the range case).
      ...(endsAt && klass.kind !== "class" ? { end: formatTime(timeZone, endsAt) } : {}),
    },
    detail: detailFor(item, relation),
    ...(pay ? { pay } : {}),
    // NOTE: attachments still have no column — see RESUME-HERE. Omitted rather
    // than faked, so the UI shows the truth.
  };
}

/** Sort cards the way a week reads: by day, then by clock time. */
export function sortEvents(
  events: CalendarEvent[],
  items: SessionWithClass[],
): CalendarEvent[] {
  const startById = new Map(
    items.map((i) => [i.session.session_id, new Date(i.session.starts_at).getTime()]),
  );
  return [...events].sort(
    (a, b) => (startById.get(a.id) ?? 0) - (startById.get(b.id) ?? 0),
  );
}

/** Sessions → the week's cards, sorted. */
export function toCalendarEvents(
  items: SessionWithClass[],
  relation: ViewerRelation,
  timeZone: string,
): CalendarEvent[] {
  return sortEvents(
    items.map((i) => toCalendarEvent(i, relation, timeZone)),
    items,
  );
}

/* ───────────────────────────  Personal events  ───────────────────────────── */

/**
 * A self-entered entry → a card.
 *
 * Two things differ from a class session:
 *   · the row carries its OWN timezone (a member on tour is not in one zone),
 *     so times render in the event's zone, not the viewer's default;
 *   · category is stored, not derived — nobody else's relationship to a private
 *     entry exists, so there is nothing to derive it from.
 */
export function toPersonalCalendarEvent(
  row: PersonalEventRow,
  swingRadiusMiles: number | null,
): CalendarEvent {
  const tz = row.timezone || "America/New_York";
  const startsAt = new Date(row.starts_at);
  const endsAt = row.ends_at ? new Date(row.ends_at) : null;

  const detail = [...(row.detail ?? [])];
  if (row.location) detail.unshift(row.location);

  // An availability window is only meaningful with its reach attached — the
  // radius lives on the profile (swing_availability), not on the window.
  if (row.category === "availability" && swingRadiusMiles != null) {
    detail.push(`within ${swingRadiusMiles} miles`);
  }
  if (row.note) detail.push(row.note);

  return {
    id: row.event_id,
    day: weekdayKeyOf(tz, startsAt),
    category: row.category,
    title: row.title,
    time: {
      start: formatTime(tz, startsAt),
      // A deadline is a moment; a window is a span. Only spans show an end.
      ...(endsAt && row.category !== "deadline"
        ? { end: formatTime(tz, endsAt) }
        : {}),
    },
    detail,
  };
}

/**
 * Merge studio sessions and personal entries into ONE week, ordered by real
 * start time — the "one calendar, every role" promise. Sorting on the underlying
 * instants (not the formatted strings) is what keeps a 9:00 AM entry above a
 * 10:00 AM one regardless of which source it came from.
 */
export function mergeWeek(
  sessions: SessionWithClass[],
  relation: ViewerRelation,
  timeZone: string,
  personal: PersonalEventRow[],
  swingRadiusMiles: number | null,
  payBySession?: Map<string, PayInfo>,
): CalendarEvent[] {
  const withInstants: { event: CalendarEvent; at: number }[] = [
    ...sessions.map((s) => ({
      event: toCalendarEvent(s, relation, timeZone, payBySession),
      at: new Date(s.session.starts_at).getTime(),
    })),
    ...personal.map((p) => ({
      event: toPersonalCalendarEvent(p, swingRadiusMiles),
      at: new Date(p.starts_at).getTime(),
    })),
  ];

  return withInstants.sort((a, b) => a.at - b.at).map((x) => x.event);
}

/* ────────────────────────────  Communications  ───────────────────────────── */

/** "Mon, 9:12 AM" — the timestamp style the comms components already expect. */
function formatCommTimestamp(timeZone: string, iso: string): string {
  const at = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(at);
}

/**
 * One communication row → the discriminated union the UI renders.
 *
 * The row table is one shape with nullable columns; the UI type is four precise
 * shapes. This narrows safely and drops anything malformed rather than rendering
 * a half-built card.
 */
export function toCommunication(
  row: CommunicationRow,
  timeZone: string,
  studioName: string,
  selfUserId: string | null,
): Communication | null {
  const base = {
    id: row.communication_id,
    timestamp: formatCommTimestamp(timeZone, row.created_at),
    ...(row.related_session_id ? { relatedEventId: row.related_session_id } : {}),
  };

  // "From" is the studio unless a person authored it; a message the signed-in
  // guardian wrote is labelled as theirs.
  const from = row.from_employer_id
    ? studioName
    : row.from_user_id && row.from_user_id === selfUserId
      ? "You"
      : studioName;

  switch (row.kind) {
    case "alert":
      if (!row.title) return null;
      return {
        ...base,
        kind: "alert",
        from,
        severity: row.severity ?? "change",
        title: row.title,
        body: row.body ?? "",
      };

    case "announcement":
      if (!row.title) return null;
      return { ...base, kind: "announcement", from, title: row.title, body: row.body ?? "" };

    case "message":
      if (!row.body) return null;
      return {
        ...base,
        kind: "message",
        from,
        direction: row.direction ?? "from_studio",
        body: row.body,
      };

    case "note":
      if (!row.title) return null;
      return { ...base, kind: "note", from, label: row.title };

    default:
      return null;
  }
}

/** Rows → the comms feed, dropping any row that cannot be rendered honestly. */
export function toCommunications(
  rows: CommunicationRow[],
  timeZone: string,
  studioName: string,
  selfUserId: string | null,
): Communication[] {
  return rows.flatMap((r) => {
    const c = toCommunication(r, timeZone, studioName, selfUserId);
    return c ? [c] : [];
  });
}
