// "This Week" — the recurrence expander.
//
// A studio publishes a class TEMPLATE (`studio_classes`) that says "Ballet III,
// Mondays 4:30–5:45". A week query cannot read that: it reads dated rows
// (`class_sessions`). This module is the bridge — it expands a template's RRULE
// into the concrete sessions that fall inside a date range.
//
// ── Why a hand-rolled subset instead of the `rrule` package ──
// The full RFC 5545 grammar is large and almost none of it describes a dance
// class. Studio schedules are "every week on these days, between these dates",
// occasionally "every other week". That is the subset below. Anything outside it
// is REJECTED LOUDLY (`UnsupportedRecurrenceError`) rather than silently
// producing a wrong calendar — a class quietly appearing on the wrong day is far
// worse than an error that says so.
//
// Supported:  FREQ=WEEKLY  ·  BYDAY=MO,TU,…  ·  INTERVAL=n  ·  COUNT=n  ·  UNTIL=…
// Also:       a null/empty recurrence = a ONE-OFF class (single session).
// Not yet:    FREQ=DAILY/MONTHLY/YEARLY, BYMONTHDAY, BYSETPOS, EXDATE, RDATE.
//
// If a studio ever needs more, swap this file's internals for the `rrule`
// package — `expandClassSessions()`'s signature is the seam and callers do not
// change.

import { zonedWallTimeToInstant } from "./week";

/** Thrown when an RRULE uses a part this expander does not implement. */
export class UnsupportedRecurrenceError extends Error {
  constructor(detail: string, public readonly rrule: string) {
    super(`Unsupported recurrence (${detail}): ${rrule}`);
    this.name = "UnsupportedRecurrenceError";
  }
}

/** RFC 5545 day tokens → the Monday-first index this module works in. */
const BYDAY_INDEX: Record<string, number> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The parts of an RRULE this expander understands. */
interface ParsedRule {
  /** Monday-first weekday indices the class lands on. */
  byDay: number[];
  /** 1 = every week, 2 = every other week, … */
  interval: number;
  /** Stop after this many occurrences, counted from `seriesStart`. */
  count?: number;
  /** Stop after this instant (inclusive). */
  until?: Date;
}

/**
 * Parse the supported RRULE subset. Accepts an optional leading "RRULE:".
 * Throws `UnsupportedRecurrenceError` on anything it cannot honour exactly.
 */
export function parseRecurrence(rrule: string): ParsedRule {
  const body = rrule.trim().replace(/^RRULE:/i, "");
  if (!body) throw new UnsupportedRecurrenceError("empty rule", rrule);

  const parts = new Map<string, string>();
  for (const chunk of body.split(";")) {
    if (!chunk) continue;
    const eq = chunk.indexOf("=");
    if (eq === -1) throw new UnsupportedRecurrenceError(`malformed part "${chunk}"`, rrule);
    parts.set(chunk.slice(0, eq).trim().toUpperCase(), chunk.slice(eq + 1).trim());
  }

  const freq = parts.get("FREQ")?.toUpperCase();
  if (freq !== "WEEKLY") {
    throw new UnsupportedRecurrenceError(`FREQ=${freq ?? "(missing)"}; only WEEKLY`, rrule);
  }

  // Reject unknown parts explicitly — silently ignoring one would produce a
  // schedule that looks right and isn't.
  const KNOWN = new Set(["FREQ", "BYDAY", "INTERVAL", "COUNT", "UNTIL", "WKST"]);
  for (const key of parts.keys()) {
    if (!KNOWN.has(key)) throw new UnsupportedRecurrenceError(`part ${key}`, rrule);
  }

  const byDayRaw = parts.get("BYDAY");
  if (!byDayRaw) throw new UnsupportedRecurrenceError("BYDAY is required", rrule);

  const byDay = byDayRaw.split(",").map((token) => {
    const clean = token.trim().toUpperCase();
    // "2MO" (second Monday) is positional — outside the subset.
    if (!/^[A-Z]{2}$/.test(clean)) {
      throw new UnsupportedRecurrenceError(`positional BYDAY "${token}"`, rrule);
    }
    const idx = BYDAY_INDEX[clean];
    if (idx === undefined) throw new UnsupportedRecurrenceError(`BYDAY "${token}"`, rrule);
    return idx;
  });

  const interval = parts.has("INTERVAL") ? Number(parts.get("INTERVAL")) : 1;
  if (!Number.isInteger(interval) || interval < 1) {
    throw new UnsupportedRecurrenceError(`INTERVAL=${parts.get("INTERVAL")}`, rrule);
  }

  const count = parts.has("COUNT") ? Number(parts.get("COUNT")) : undefined;
  if (count !== undefined && (!Number.isInteger(count) || count < 1)) {
    throw new UnsupportedRecurrenceError(`COUNT=${parts.get("COUNT")}`, rrule);
  }

  let until: Date | undefined;
  if (parts.has("UNTIL")) {
    until = parseUntil(parts.get("UNTIL")!, rrule);
  }

  return { byDay: [...new Set(byDay)].sort((a, b) => a - b), interval, count, until };
}

/** UNTIL is basic ISO 8601: "20260630" or "20260630T235959Z". */
function parseUntil(raw: string, rrule: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(raw.trim());
  if (!m) throw new UnsupportedRecurrenceError(`UNTIL="${raw}"`, rrule);
  const [, y, mo, d, h = "23", mi = "59", s = "59"] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

/* ─────────────────────────────  Expansion  ───────────────────────────────── */

/** The class template fields expansion needs (mirrors `studio_classes`). */
export interface ClassTemplate {
  class_id: string;
  recurrence: string | null;
  /** "16:30:00" — wall-clock start in the class's own timezone. */
  default_start: string | null;
  default_end: string | null;
  timezone: string;
  /** Series bounds, if the studio set them (from `affiliations`/term dates). */
  series_start?: string | null;
  series_end?: string | null;
}

/** One dated occurrence — the shape that becomes a `class_sessions` row. */
export interface ExpandedSession {
  class_id: string;
  starts_at: Date;
  ends_at: Date | null;
}

/** "16:30:00" → { hour: 16, minute: 30 }. Defaults to midnight when absent. */
function parseWallTime(value: string | null): { hour: number; minute: number } {
  if (!value) return { hour: 0, minute: 0 };
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return { hour: 0, minute: 0 };
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/**
 * Expand one class template into the sessions falling in
 * `[rangeStart, rangeEndExclusive)`.
 *
 * Times are built as WALL CLOCK in the class's own timezone, so a 4:30 PM class
 * stays 4:30 PM across a DST change rather than sliding to 3:30 or 5:30.
 *
 * A template with no recurrence is a one-off: it yields a single session at
 * `series_start`, and only if that lands inside the range.
 */
export function expandClassSessions(
  template: ClassTemplate,
  rangeStart: Date,
  rangeEndExclusive: Date,
): ExpandedSession[] {
  const tz = template.timezone || "America/New_York";
  const start = parseWallTime(template.default_start);
  const end = template.default_end ? parseWallTime(template.default_end) : null;

  const at = (isoDate: { year: number; month: number; day: number }) => {
    const startsAt = zonedWallTimeToInstant(tz, isoDate.year, isoDate.month, isoDate.day, start.hour, start.minute);
    const endsAt = end
      ? zonedWallTimeToInstant(tz, isoDate.year, isoDate.month, isoDate.day, end.hour, end.minute)
      : null;
    // An end before the start means the class runs past midnight — push a day.
    return {
      class_id: template.class_id,
      starts_at: startsAt,
      ends_at: endsAt && endsAt <= startsAt ? new Date(endsAt.getTime() + MS_PER_DAY) : endsAt,
    };
  };

  // ── One-off class ─────────────────────────────────────────────────────────
  if (!template.recurrence || !template.recurrence.trim()) {
    if (!template.series_start) return [];
    const d = parseDateOnly(template.series_start);
    if (!d) return [];
    const session = at(d);
    return session.starts_at >= rangeStart && session.starts_at < rangeEndExclusive
      ? [session]
      : [];
  }

  // ── Recurring class ───────────────────────────────────────────────────────
  const rule = parseRecurrence(template.recurrence);

  // The series anchor: where week-counting (for INTERVAL/COUNT) begins.
  const anchorDate = template.series_start ? parseDateOnly(template.series_start) : null;
  const seriesStart = anchorDate
    ? zonedWallTimeToInstant(tz, anchorDate.year, anchorDate.month, anchorDate.day)
    : rangeStart;

  const hardEnd = earliest(
    rule.until,
    template.series_end ? endOfDay(tz, template.series_end) : undefined,
  );

  const anchorMonday = mondayOf(tz, seriesStart);
  const sessions: ExpandedSession[] = [];
  let emitted = 0;

  // Walk week by week from the series anchor to the end of the range. Series are
  // studio terms (months, not decades), so this stays small; the guard below is
  // a backstop against a malformed anchor, not an expected path.
  const MAX_WEEKS = 520; // ~10 years
  for (let week = 0; week < MAX_WEEKS; week++) {
    const weekMonday = addDaysLocalMidnight(tz, anchorMonday, week * 7);
    if (weekMonday >= rangeEndExclusive && rule.count === undefined) break;

    // INTERVAL=2 means every other week counted from the anchor week.
    const isActiveWeek = week % rule.interval === 0;

    for (const dayIdx of rule.byDay) {
      const dayMidnight = addDaysLocalMidnight(tz, weekMonday, dayIdx);
      const parts = dateOnlyParts(tz, dayMidnight);
      const session = at(parts);

      // Occurrences before the series begins don't count toward COUNT.
      if (session.starts_at < seriesStart) continue;
      if (!isActiveWeek) continue;
      if (hardEnd && session.starts_at > hardEnd) return sessions;

      emitted++;
      if (rule.count !== undefined && emitted > rule.count) return sessions;

      if (session.starts_at >= rangeStart && session.starts_at < rangeEndExclusive) {
        sessions.push(session);
      }
    }

    // Past the range with no COUNT left to honour — nothing more can qualify.
    if (weekMonday >= rangeEndExclusive) break;
  }

  return sessions;
}

/* ──────────────────────────────  Small utils  ────────────────────────────── */

function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  return m ? { year: +m[1], month: +m[2], day: +m[3] } : null;
}

function dateOnlyParts(timeZone: string, at: Date) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Local midnight, `days` after `from` — re-anchored so DST cannot drift it. */
function addDaysLocalMidnight(timeZone: string, from: Date, days: number): Date {
  const approx = new Date(from.getTime() + days * MS_PER_DAY);
  const p = dateOnlyParts(timeZone, approx);
  return zonedWallTimeToInstant(timeZone, p.year, p.month, p.day);
}

/** Local midnight on the Monday of that instant's week. */
function mondayOf(timeZone: string, at: Date): Date {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" })
    .format(at)
    .toLowerCase();
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const idx = Math.max(0, order.indexOf(weekday));
  return addDaysLocalMidnight(timeZone, at, -idx);
}

function endOfDay(timeZone: string, isoDate: string): Date | undefined {
  const d = parseDateOnly(isoDate);
  return d ? zonedWallTimeToInstant(timeZone, d.year, d.month, d.day, 23, 59) : undefined;
}

function earliest(a?: Date, b?: Date): Date | undefined {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}
