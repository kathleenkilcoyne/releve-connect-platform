// Tests for row → card translation.
//
// Two behaviours here are load-bearing product rules rather than plumbing, and
// both would be easy to break silently:
//   1. teaching-vs-taking is VIEWER-RELATIVE — the same class row must render
//      differently to the teacher and to the enrolled student.
//   2. the professional week is a MERGE of two independent sources (the studio's
//      schedule and the member's own entries) ordered by real instant.

import { describe, expect, it } from "vitest";

import { mergeWeek, toCalendarEvent, toPersonalCalendarEvent } from "./adapters";
import type { PersonalEventRow, SessionWithClass } from "./queries";

const NY = "America/New_York";

/** A Monday 4:30 PM Ballet III session at Bergen Ballet. */
function balletSession(overrides: Partial<SessionWithClass["klass"]> = {}): SessionWithClass {
  return {
    session: {
      session_id: "sess_1",
      class_id: "class_1",
      starts_at: "2026-07-20T20:30:00.000Z", // 4:30 PM EDT
      ends_at: "2026-07-20T21:45:00.000Z",
      status: "scheduled",
      note: null,
    },
    klass: {
      class_id: "class_1",
      employer_id: "emp_1",
      title: "Ballet III",
      location: "Bergen Ballet, Ridgewood",
      room: "Studio A",
      teacher_profile_id: "prof_kathleen",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      default_start: "16:30:00",
      default_end: "17:45:00",
      timezone: NY,
      series_start: "2026-06-01",
      series_end: null,
      kind: "class",
      status: "active",
      employer_profiles: { name: "Bergen Ballet" },
      ...overrides,
    },
    studioName: "Bergen Ballet",
  };
}

describe("toCalendarEvent — viewer-relative category", () => {
  it("renders the SAME class as teaching to a teacher and taking to a student", () => {
    const item = balletSession();
    expect(toCalendarEvent(item, "teacher", NY).category).toBe("teaching");
    expect(toCalendarEvent(item, "student", NY).category).toBe("taking");
  });

  it("lets an intrinsic kind win over the viewer relationship", () => {
    // A performance is a performance to everyone — it is not "teaching" just
    // because the teacher is looking at it.
    const perf = balletSession({ kind: "performance" });
    expect(toCalendarEvent(perf, "teacher", NY).category).toBe("performance");
    expect(toCalendarEvent(perf, "student", NY).category).toBe("performance");

    const reh = balletSession({ kind: "rehearsal" });
    expect(toCalendarEvent(reh, "teacher", NY).category).toBe("rehearsing");
  });

  it("places the card on the right day at the right local time", () => {
    const e = toCalendarEvent(balletSession(), "teacher", NY);
    expect(e.day).toBe("mon");
    expect(e.time.start).toBe("4:30 PM");
  });

  it("states a cancellation in TEXT, never colour alone", () => {
    const item = balletSession();
    item.session.status = "canceled";
    expect(toCalendarEvent(item, "student", NY).detail).toContain("CANCELED");
  });

  it("tells a student who is teaching, and does not tell the teacher", () => {
    expect(toCalendarEvent(balletSession(), "student", NY).detail).toContain(
      "with your teacher",
    );
    expect(toCalendarEvent(balletSession(), "teacher", NY).detail).not.toContain(
      "with your teacher",
    );
  });
});

describe("toPersonalCalendarEvent", () => {
  const base: PersonalEventRow = {
    event_id: "pe_1",
    category: "taking",
    title: "Company Class",
    starts_at: "2026-07-20T14:00:00.000Z", // 10:00 AM EDT
    ends_at: "2026-07-20T15:30:00.000Z",
    timezone: NY,
    location: "Steps on Broadway, NYC",
    detail: ["travel 55 min from home"],
    note: null,
  };

  it("keeps the stored category and renders location before detail", () => {
    const e = toPersonalCalendarEvent(base, null);
    expect(e.category).toBe("taking");
    expect(e.time.start).toBe("10:00 AM");
    expect(e.detail).toEqual(["Steps on Broadway, NYC", "travel 55 min from home"]);
  });

  it("gives a DEADLINE no end time — it is a moment, not a span", () => {
    const deadline: PersonalEventRow = {
      ...base,
      category: "deadline",
      title: "Deadline — prescreen",
      ends_at: "2026-07-20T15:30:00.000Z", // present, and must be ignored
    };
    expect(toPersonalCalendarEvent(deadline, null).time.end).toBeUndefined();
  });

  it("annotates an availability window with the PROFILE's swing radius", () => {
    // The radius lives on swing_availability, not on the event row — so it is
    // passed in, and absent when the member has not set one.
    const window: PersonalEventRow = {
      ...base,
      category: "availability",
      title: "Available for The Swing",
      location: null,
      detail: [],
    };
    expect(toPersonalCalendarEvent(window, 25).detail).toEqual(["within 25 miles"]);
    expect(toPersonalCalendarEvent(window, null).detail).toEqual([]);
  });
});

describe("mergeWeek", () => {
  it("interleaves studio sessions and personal entries by real start time", () => {
    // Company Class 10:00 AM (personal) must sort ABOVE Ballet III 4:30 PM
    // (studio), even though they come from different sources.
    const personal: PersonalEventRow[] = [
      {
        event_id: "pe_1",
        category: "taking",
        title: "Company Class",
        starts_at: "2026-07-20T14:00:00.000Z", // 10:00 AM
        ends_at: null,
        timezone: NY,
        location: null,
        detail: [],
        note: null,
      },
      {
        event_id: "pe_2",
        category: "auditioning",
        title: "Audition",
        starts_at: "2026-07-21T17:00:00.000Z", // Tue 1:00 PM
        ends_at: null,
        timezone: NY,
        location: null,
        detail: [],
        note: null,
      },
    ];

    const merged = mergeWeek([balletSession()], "teacher", NY, personal, null);

    expect(merged.map((e) => e.title)).toEqual([
      "Company Class", // Mon 10:00 AM
      "Ballet III", // Mon 4:30 PM
      "Audition", // Tue 1:00 PM
    ]);
    expect(merged.map((e) => e.category)).toEqual([
      "taking",
      "teaching",
      "auditioning",
    ]);
  });

  it("handles either source being empty", () => {
    expect(mergeWeek([balletSession()], "teacher", NY, [], null)).toHaveLength(1);
    expect(mergeWeek([], "teacher", NY, [], null)).toEqual([]);
  });
});
