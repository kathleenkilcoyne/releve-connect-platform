// Tests for compensation display.
//
// The rules being protected here are financial, and each would be a quiet,
// plausible-looking bug if it broke:
//   · a recorded earning ALWAYS wins over the current agreed rate (never
//     recompute history from today's number)
//   · the most specific engagement wins, and effective dating is honoured
//   · pay never reaches a student's or guardian's card

import { describe, expect, it } from "vitest";

import { buildPayMap, formatMoney, formatRate, resolveEngagement } from "./pay";
import { toCalendarEvent } from "./adapters";
import type { EarningRow, EngagementRow, SessionWithClass } from "./queries";

const EMPLOYER = "emp_bergen";
const CLASS = "class_ballet";
const NY = "America/New_York";

function engagement(overrides: Partial<EngagementRow> = {}): EngagementRow {
  return {
    engagement_id: "eng_1",
    employer_id: EMPLOYER,
    class_id: null,
    kind: "ongoing",
    rate_amount_cents: 5000,
    rate_unit: "hourly",
    rate_source: "teacher_set",
    currency: "USD",
    effective_from: "2026-01-01",
    effective_to: null,
    status: "active",
    ...overrides,
  };
}

function session(): SessionWithClass {
  return {
    session: {
      session_id: "sess_1",
      class_id: CLASS,
      starts_at: "2026-07-20T20:30:00.000Z",
      ends_at: "2026-07-20T21:45:00.000Z",
      status: "scheduled",
      note: null,
    },
    klass: {
      class_id: CLASS,
      employer_id: EMPLOYER,
      title: "Ballet III",
      location: "Bergen Ballet",
      room: null,
      teacher_profile_id: "prof_k",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      default_start: "16:30:00",
      default_end: "17:45:00",
      timezone: NY,
      series_start: "2026-06-01",
      series_end: null,
      kind: "class",
      status: "active",
      employer_profiles: { name: "Bergen Ballet" },
    },
    studioName: "Bergen Ballet",
  };
}

describe("formatting", () => {
  it("drops cents on whole amounts and keeps them otherwise", () => {
    expect(formatMoney(6500)).toBe("$65");
    expect(formatMoney(8125)).toBe("$81.25");
  });

  it("labels the rate unit", () => {
    expect(formatRate(6500, "hourly")).toBe("$65/hr");
    expect(formatRate(6500, "per_session")).toBe("$65/class");
    expect(formatRate(2500, "per_student")).toBe("$25/student");
  });
});

describe("resolveEngagement", () => {
  const on = new Date("2026-07-20T20:30:00.000Z");

  it("prefers a class-specific engagement over the studio-wide default", () => {
    const found = resolveEngagement(
      [
        engagement({ engagement_id: "wide", class_id: null, rate_amount_cents: 5000 }),
        engagement({ engagement_id: "specific", class_id: CLASS, rate_amount_cents: 6500 }),
      ],
      EMPLOYER,
      CLASS,
      on,
    );
    expect(found?.engagement_id).toBe("specific");
    expect(found?.rate_amount_cents).toBe(6500);
  });

  it("falls back to the studio-wide default for an unpriced class", () => {
    const found = resolveEngagement(
      [engagement({ engagement_id: "wide", class_id: null })],
      EMPLOYER,
      "some_other_class",
      on,
    );
    expect(found?.engagement_id).toBe("wide");
  });

  it("honours effective dating — a rate not yet in force does not apply", () => {
    expect(
      resolveEngagement([engagement({ effective_from: "2026-09-01" })], EMPLOYER, CLASS, on),
    ).toBeNull();
    expect(
      resolveEngagement([engagement({ effective_to: "2026-06-30" })], EMPLOYER, CLASS, on),
    ).toBeNull();
  });

  it("picks the most recently effective when several apply", () => {
    const found = resolveEngagement(
      [
        engagement({ engagement_id: "old", effective_from: "2026-01-01", rate_amount_cents: 5000 }),
        engagement({ engagement_id: "raise", effective_from: "2026-07-01", rate_amount_cents: 7000 }),
      ],
      EMPLOYER,
      CLASS,
      on,
    );
    expect(found?.engagement_id).toBe("raise");
  });

  it("ignores another studio's engagement", () => {
    expect(
      resolveEngagement([engagement({ employer_id: "other_studio" })], EMPLOYER, CLASS, on),
    ).toBeNull();
  });
});

describe("buildPayMap", () => {
  it("shows the agreed rate when no earning has been recorded yet", () => {
    const map = buildPayMap([session()], [engagement({ class_id: CLASS, rate_amount_cents: 6500 })], []);
    expect(map.get("sess_1")).toEqual({ rate: "$65/hr", status: "unpaid" });
  });

  it("lets a RECORDED earning win over the current agreed rate", () => {
    // The engagement now says $99/hr, but the session was worked at $65/hr and
    // paid $81.25. History must not be recomputed from today's number.
    const earning: EarningRow = {
      earning_id: "earn_1",
      session_id: "sess_1",
      amount_cents: 8125,
      currency: "USD",
      status: "paid",
      rate_amount_cents: 6500,
      rate_unit: "hourly",
    };
    const map = buildPayMap(
      [session()],
      [engagement({ class_id: CLASS, rate_amount_cents: 9900 })],
      [earning],
    );
    expect(map.get("sess_1")).toEqual({ rate: "$81.25", status: "paid" });
  });

  it("maps ledger statuses onto the three badge states", () => {
    const base: EarningRow = {
      earning_id: "e",
      session_id: "sess_1",
      amount_cents: 8125,
      currency: "USD",
      status: "pending",
      rate_amount_cents: 6500,
      rate_unit: "hourly",
    };
    const statusFor = (s: EarningRow["status"]) =>
      buildPayMap([session()], [], [{ ...base, status: s }]).get("sess_1")?.status;

    expect(statusFor("paid")).toBe("paid");
    expect(statusFor("approved")).toBe("pending");
    expect(statusFor("pending")).toBe("pending");
    // Voided money is money that will not arrive.
    expect(statusFor("void")).toBe("unpaid");
  });

  it("shows NO badge rather than $0 when there is no agreement on file", () => {
    expect(buildPayMap([session()], [], []).size).toBe(0);
  });
});

describe("pay never reaches a non-teacher card", () => {
  it("omits pay for a student even if a pay map is passed", () => {
    const payMap = buildPayMap(
      [session()],
      [engagement({ class_id: CLASS, rate_amount_cents: 6500 })],
      [],
    );
    // The teacher's own card carries it...
    expect(toCalendarEvent(session(), "teacher", NY, payMap).pay).toEqual({
      rate: "$65/hr",
      status: "unpaid",
    });
    // ...and a student's card does not, even given the same map. A parent has no
    // business seeing what their child's teacher is paid.
    expect(toCalendarEvent(session(), "student", NY, payMap).pay).toBeUndefined();
  });
});
