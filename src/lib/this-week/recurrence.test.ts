// Tests for the week framing + recurrence expansion behind "This Week".
//
// These two modules decide WHICH DAY a class lands on. A silent error here puts
// a student at the studio on the wrong afternoon, so the cases below lean hard
// on the things that actually break real calendars: DST transitions, weeks that
// straddle a month or year boundary, and RRULE parts we deliberately refuse.

import { describe, expect, it } from "vitest";

import { formatTime, resolveWeek, weekdayKeyOf, zonedWallTimeToInstant } from "./week";
import {
  UnsupportedRecurrenceError,
  expandClassSessions,
  parseRecurrence,
  type ClassTemplate,
} from "./recurrence";

const NY = "America/New_York";

describe("resolveWeek", () => {
  it("runs Monday → Sunday and spans exactly seven days", () => {
    // A Thursday.
    const week = resolveWeek(NY, 0, new Date("2026-01-15T17:00:00Z"));
    expect(week.days.map((d) => d.key)).toEqual([
      "mon", "tue", "wed", "thu", "fri", "sat", "sun",
    ]);
    expect(week.label).toBe("Mon, Jan 12 – Sun, Jan 18");
    const spanDays =
      (week.endsAtExclusive.getTime() - week.startsAt.getTime()) / 86_400_000;
    expect(spanDays).toBe(7);
  });

  it("marks only the real today", () => {
    const week = resolveWeek(NY, 0, new Date("2026-01-15T17:00:00Z"));
    expect(week.days.filter((d) => d.isToday).map((d) => d.key)).toEqual(["thu"]);
  });

  it("treats Sunday as the END of the week, not the start", () => {
    // Sunday Jan 18 belongs to the Jan 12 week, not the Jan 19 one.
    const week = resolveWeek(NY, 0, new Date("2026-01-18T17:00:00Z"));
    expect(week.label).toBe("Mon, Jan 12 – Sun, Jan 18");
    expect(week.days.find((d) => d.isToday)?.key).toBe("sun");
  });

  it("shifts whole weeks and crosses a year boundary cleanly", () => {
    const now = new Date("2026-01-15T17:00:00Z");
    expect(resolveWeek(NY, -1, now).label).toBe("Mon, Jan 5 – Sun, Jan 11");
    expect(resolveWeek(NY, 1, now).label).toBe("Mon, Jan 19 – Sun, Jan 25");
    // Back across New Year.
    expect(resolveWeek(NY, -3, now).label).toBe("Mon, Dec 22 – Sun, Dec 28");
  });

  it("keeps seven real days across the spring-forward DST week", () => {
    // US DST begins Sun Mar 8 2026. The week Mar 2–8 is 167 hours, not 168 —
    // day bucketing must still produce exactly 7 correctly-labelled days.
    const week = resolveWeek(NY, 0, new Date("2026-03-04T17:00:00Z"));
    expect(week.label).toBe("Mon, Mar 2 – Sun, Mar 8");
    expect(week.days.map((d) => d.dateLabel)).toEqual([
      "Mar 2", "Mar 3", "Mar 4", "Mar 5", "Mar 6", "Mar 7", "Mar 8",
    ]);
  });

  it("keeps seven real days across the fall-back DST week", () => {
    // US DST ends Sun Nov 1 2026 — that week is 169 hours.
    const week = resolveWeek(NY, 0, new Date("2026-10-28T17:00:00Z"));
    expect(week.days.map((d) => d.dateLabel)).toEqual([
      "Oct 26", "Oct 27", "Oct 28", "Oct 29", "Oct 30", "Oct 31", "Nov 1",
    ]);
  });

  it("resolves the week from the VIEWER's timezone, not the server's", () => {
    // 03:00 UTC Monday is still Sunday evening in New York, so the New York
    // viewer is in the PREVIOUS week.
    const instant = new Date("2026-01-19T03:00:00Z");
    expect(resolveWeek(NY, 0, instant).label).toBe("Mon, Jan 12 – Sun, Jan 18");
    expect(resolveWeek("Europe/London", 0, instant).label).toBe(
      "Mon, Jan 19 – Sun, Jan 25",
    );
  });
});

describe("weekdayKeyOf / formatTime", () => {
  it("buckets an instant into the viewer's local day", () => {
    // 00:30 UTC Tuesday = 7:30 PM Monday in New York.
    const instant = new Date("2026-01-13T00:30:00Z");
    expect(weekdayKeyOf(NY, instant)).toBe("mon");
    expect(weekdayKeyOf("UTC", instant)).toBe("tue");
  });

  it("formats a card time the way the mockup shows it", () => {
    const at = zonedWallTimeToInstant(NY, 2026, 1, 12, 16, 30);
    expect(formatTime(NY, at)).toBe("4:30 PM");
  });

  it("round-trips a wall time through the instant conversion", () => {
    // Standard time (EST, -5).
    expect(zonedWallTimeToInstant(NY, 2026, 1, 12, 16, 30).toISOString()).toBe(
      "2026-01-12T21:30:00.000Z",
    );
    // Daylight time (EDT, -4) — same wall clock, different instant.
    expect(zonedWallTimeToInstant(NY, 2026, 7, 12, 16, 30).toISOString()).toBe(
      "2026-07-12T20:30:00.000Z",
    );
  });
});

describe("parseRecurrence", () => {
  it("parses the studio-shaped rule", () => {
    const rule = parseRecurrence("FREQ=WEEKLY;BYDAY=MO,WE");
    expect(rule.byDay).toEqual([0, 2]);
    expect(rule.interval).toBe(1);
  });

  it("accepts a leading RRULE: prefix, INTERVAL, COUNT and UNTIL", () => {
    const rule = parseRecurrence("RRULE:FREQ=WEEKLY;BYDAY=TU;INTERVAL=2;COUNT=6");
    expect(rule).toMatchObject({ byDay: [1], interval: 2, count: 6 });
    expect(parseRecurrence("FREQ=WEEKLY;BYDAY=FR;UNTIL=20260630").until)
      .toEqual(new Date(Date.UTC(2026, 5, 30, 23, 59, 59)));
  });

  it("REFUSES rules it cannot honour exactly rather than guessing", () => {
    // Silently ignoring any of these would render a plausible, wrong calendar.
    expect(() => parseRecurrence("FREQ=MONTHLY;BYDAY=MO")).toThrow(UnsupportedRecurrenceError);
    expect(() => parseRecurrence("FREQ=WEEKLY;BYDAY=2MO")).toThrow(UnsupportedRecurrenceError);
    expect(() => parseRecurrence("FREQ=WEEKLY;BYDAY=MO;BYSETPOS=1")).toThrow(UnsupportedRecurrenceError);
    expect(() => parseRecurrence("FREQ=WEEKLY")).toThrow(UnsupportedRecurrenceError);
    expect(() => parseRecurrence("")).toThrow(UnsupportedRecurrenceError);
  });
});

describe("expandClassSessions", () => {
  const balletIII: ClassTemplate = {
    class_id: "class_ballet_iii",
    recurrence: "FREQ=WEEKLY;BYDAY=MO",
    default_start: "16:30:00",
    default_end: "17:45:00",
    timezone: NY,
    series_start: "2026-01-05",
    series_end: null,
  };

  const week = resolveWeek(NY, 0, new Date("2026-01-15T17:00:00Z")); // Jan 12–18

  it("emits one dated session inside the week, at the right wall time", () => {
    const out = expandClassSessions(balletIII, week.startsAt, week.endsAtExclusive);
    expect(out).toHaveLength(1);
    expect(weekdayKeyOf(NY, out[0].starts_at)).toBe("mon");
    expect(formatTime(NY, out[0].starts_at)).toBe("4:30 PM");
    expect(formatTime(NY, out[0].ends_at!)).toBe("5:45 PM");
  });

  it("emits one session per BYDAY entry", () => {
    const out = expandClassSessions(
      { ...balletIII, recurrence: "FREQ=WEEKLY;BYDAY=MO,WE,FR" },
      week.startsAt,
      week.endsAtExclusive,
    );
    expect(out.map((s) => weekdayKeyOf(NY, s.starts_at))).toEqual(["mon", "wed", "fri"]);
  });

  it("honours INTERVAL=2 relative to the series anchor", () => {
    const biweekly = { ...balletIII, recurrence: "FREQ=WEEKLY;BYDAY=MO;INTERVAL=2" };
    // Anchor week is Jan 5; Jan 12 is an OFF week, Jan 19 is on.
    expect(expandClassSessions(biweekly, week.startsAt, week.endsAtExclusive)).toHaveLength(0);
    const next = resolveWeek(NY, 1, new Date("2026-01-15T17:00:00Z"));
    expect(expandClassSessions(biweekly, next.startsAt, next.endsAtExclusive)).toHaveLength(1);
  });

  it("stops at UNTIL and at series_end", () => {
    const ended = { ...balletIII, recurrence: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20260110" };
    expect(expandClassSessions(ended, week.startsAt, week.endsAtExclusive)).toHaveLength(0);
    const termOver = { ...balletIII, series_end: "2026-01-09" };
    expect(expandClassSessions(termOver, week.startsAt, week.endsAtExclusive)).toHaveLength(0);
  });

  it("counts COUNT from the series start, not from the requested week", () => {
    // COUNT=2 from Jan 5 means Jan 5 and Jan 12 only — Jan 19 is past the count.
    const twice = { ...balletIII, recurrence: "FREQ=WEEKLY;BYDAY=MO;COUNT=2" };
    expect(expandClassSessions(twice, week.startsAt, week.endsAtExclusive)).toHaveLength(1);
    const next = resolveWeek(NY, 1, new Date("2026-01-15T17:00:00Z"));
    expect(expandClassSessions(twice, next.startsAt, next.endsAtExclusive)).toHaveLength(0);
  });

  it("never emits before the series begins", () => {
    const startsLater = { ...balletIII, series_start: "2026-02-02" };
    expect(expandClassSessions(startsLater, week.startsAt, week.endsAtExclusive)).toHaveLength(0);
  });

  it("holds the wall-clock time across a DST change", () => {
    // A 4:30 PM Monday class is still 4:30 PM after the clocks move — the UTC
    // instant shifts by an hour, which is exactly what must NOT leak into the UI.
    const dstWeek = resolveWeek(NY, 0, new Date("2026-03-11T17:00:00Z")); // Mar 9–15
    const out = expandClassSessions(balletIII, dstWeek.startsAt, dstWeek.endsAtExclusive);
    expect(out).toHaveLength(1);
    expect(formatTime(NY, out[0].starts_at)).toBe("4:30 PM");
    expect(out[0].starts_at.toISOString()).toBe("2026-03-09T20:30:00.000Z"); // EDT, -4
  });

  it("treats a null recurrence as a one-off on its series_start date", () => {
    const oneOff: ClassTemplate = {
      ...balletIII,
      recurrence: null,
      series_start: "2026-01-14",
    };
    const out = expandClassSessions(oneOff, week.startsAt, week.endsAtExclusive);
    expect(out).toHaveLength(1);
    expect(weekdayKeyOf(NY, out[0].starts_at)).toBe("wed");

    // …and nothing at all in a week it does not fall in.
    const next = resolveWeek(NY, 1, new Date("2026-01-15T17:00:00Z"));
    expect(expandClassSessions(oneOff, next.startsAt, next.endsAtExclusive)).toHaveLength(0);
  });

  it("carries a past-midnight class into the next day", () => {
    const lateNight = { ...balletIII, default_start: "22:30:00", default_end: "00:30:00" };
    const out = expandClassSessions(lateNight, week.startsAt, week.endsAtExclusive);
    expect(out[0].ends_at!.getTime()).toBeGreaterThan(out[0].starts_at.getTime());
    expect(weekdayKeyOf(NY, out[0].ends_at!)).toBe("tue");
  });
});
