// "This Week" — real week framing, timezone-aware, with no date library.
//
// Pass one pinned a fake week (Mon Jan 12 – Sun Jan 18) so the static prototype
// had something to render. This module replaces that with the REAL current week
// for a given timezone, plus the two instants a database query needs.
//
// Why hand-rolled instead of date-fns/luxon? The app has no date dependency yet,
// and everything we need is in `Intl.DateTimeFormat`, which ships with Node and
// every browser and knows the full IANA timezone database (including DST). Two
// small helpers do all the work; the rest is plain arithmetic.
//
// The week runs MONDAY → SUNDAY (studio convention, and what the mockup shows).

import type { DayMeta, WeekRange, WeekdayKey } from "./types";

/** Monday-first, matching `WeekdayKey` order and the mockup's day stack. */
const WEEKDAY_KEYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const DAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* ─────────────────────────  Timezone primitives  ─────────────────────────── */

/**
 * How far ahead of UTC the given timezone is AT that instant, in milliseconds.
 * (New York is -5h in winter, -4h in summer — this returns the right one for
 * the date you pass, so DST is handled rather than assumed.)
 */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");

  // Read the wall clock in that zone, then pretend those numbers were UTC. The
  // difference between that and the true instant IS the zone's offset.
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24, // Intl can emit hour "24" at midnight; normalise to 0.
    get("minute"),
    get("second"),
  );
  return asIfUtc - at.getTime();
}

/**
 * Turn a WALL-CLOCK time in a timezone ("Jan 12 2026, 4:30 PM in New York")
 * into the true UTC instant. Offset is resolved twice because the offset itself
 * depends on the instant — the second pass settles DST boundary cases.
 */
export function zonedWallTimeToInstant(
  timeZone: string,
  year: number,
  month: number, // 1-12
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = new Date(naive - zoneOffsetMs(timeZone, new Date(naive)));
  return new Date(naive - zoneOffsetMs(timeZone, firstGuess));
}

/** The calendar date + weekday as seen in `timeZone` at that instant. */
function zonedDateParts(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(at);

  const find = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayShort = find("weekday").toLowerCase(); // "mon", "tue", …

  return {
    year: Number(find("year")),
    month: Number(find("month")),
    day: Number(find("day")),
    weekday: weekdayShort as WeekdayKey,
  };
}

/* ────────────────────────────  Public helpers  ───────────────────────────── */

/** Which day-column a timestamp belongs to, in the viewer's timezone. */
export function weekdayKeyOf(timeZone: string, at: Date): WeekdayKey {
  return zonedDateParts(timeZone, at).weekday;
}

/** "4:30 PM" — the card's display time, in the viewer's timezone. */
export function formatTime(timeZone: string, at: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(at);
}

/** "Jan 12" — the small date under each day heading. */
function formatDayDate(timeZone: string, at: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(at);
}

/** "Mon Jan 12 – Sun Jan 18" — the week-nav caption. */
function formatRangeLabel(timeZone: string, start: Date, end: Date): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(d);
  return `${fmt(start)} – ${fmt(end)}`;
}

/* ──────────────────────────────  The week  ───────────────────────────────── */

/** A resolved week: what the UI renders, plus the bounds a query needs. */
export interface ResolvedWeek extends WeekRange {
  /** Midnight Monday, in the viewer's timezone, as a true instant. */
  startsAt: Date;
  /** The instant the week ends — midnight the FOLLOWING Monday (exclusive). */
  endsAtExclusive: Date;
}

/**
 * The viewer's week. `offset` shifts by whole weeks (0 = this week, -1 = last,
 * +1 = next) so the existing WeekNav buttons keep working unchanged.
 *
 * `now` is injectable so tests can pin a moment instead of reading the clock.
 */
export function resolveWeek(
  timeZone: string,
  offset = 0,
  now: Date = new Date(),
): ResolvedWeek {
  const today = zonedDateParts(timeZone, now);

  // Monday-first index: Mon=0 … Sun=6.
  const dayIndex = WEEKDAY_KEYS.indexOf(today.weekday);

  // Midnight of today (in zone), then step back to Monday and apply the offset.
  const todayMidnight = zonedWallTimeToInstant(
    timeZone,
    today.year,
    today.month,
    today.day,
  );
  const mondayApprox = new Date(
    todayMidnight.getTime() + (offset * 7 - dayIndex) * MS_PER_DAY,
  );

  // Re-anchor to true local midnight: adding raw days can drift by an hour
  // across a DST change, and a drifted "midnight" would mis-bucket events.
  const mondayParts = zonedDateParts(timeZone, mondayApprox);
  const startsAt = zonedWallTimeToInstant(
    timeZone,
    mondayParts.year,
    mondayParts.month,
    mondayParts.day,
  );

  const days: DayMeta[] = WEEKDAY_KEYS.map((key, i) => {
    const dayStart = reanchorMidnight(timeZone, startsAt, i);
    const p = zonedDateParts(timeZone, dayStart);
    return {
      key,
      label: DAY_LABELS[key],
      dateLabel: formatDayDate(timeZone, dayStart),
      isToday:
        p.year === today.year && p.month === today.month && p.day === today.day,
    };
  });

  const endsAtExclusive = reanchorMidnight(timeZone, startsAt, 7);
  const lastDay = reanchorMidnight(timeZone, startsAt, 6);

  return {
    label: formatRangeLabel(timeZone, startsAt, lastDay),
    days,
    timezone: timeZone,
    startsAt,
    endsAtExclusive,
  };
}

/** Local midnight `dayOffset` days after `from`, DST-safe. */
function reanchorMidnight(timeZone: string, from: Date, dayOffset: number): Date {
  const approx = new Date(from.getTime() + dayOffset * MS_PER_DAY);
  const p = zonedDateParts(timeZone, approx);
  return zonedWallTimeToInstant(timeZone, p.year, p.month, p.day);
}
