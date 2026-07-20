// Tests for the "You Matter Here" daily message.
//
// The whole promise of this feature is that the line is the SAME all day and
// then changes. Both halves are easy to break silently — a naive
// `Math.random()` or a UTC-based day index would look fine in a screenshot and
// be wrong in use.

import { describe, expect, it } from "vitest";

import { DAILY_MESSAGES, messageForDay } from "./daily-message";

const NY = "America/New_York";

describe("the message bank", () => {
  it("holds all 30 of Kathleen's lines", () => {
    expect(DAILY_MESSAGES).toHaveLength(30);
  });

  it("has no blanks and no duplicates", () => {
    expect(DAILY_MESSAGES.every((m) => m.trim().length > 0)).toBe(true);
    expect(new Set(DAILY_MESSAGES).size).toBe(DAILY_MESSAGES.length);
  });
});

describe("messageForDay", () => {
  it("is STABLE across the whole day — morning and late evening match", () => {
    const morning = new Date("2026-07-20T12:00:00Z"); // 8:00 AM in New York
    const evening = new Date("2026-07-21T03:30:00Z"); // 11:30 PM the SAME NY day
    expect(messageForDay(NY, evening)).toBe(messageForDay(NY, morning));
  });

  it("does not flip early just because UTC has rolled over", () => {
    // 9:00 PM Jul 20 in New York is already Jul 21 in UTC. A naive UTC day
    // index would change the message while it is still someone's evening.
    const ninePmNY = new Date("2026-07-21T01:00:00Z");
    const noonNY = new Date("2026-07-20T16:00:00Z");
    expect(messageForDay(NY, ninePmNY)).toBe(messageForDay(NY, noonNY));
  });

  it("changes when the day changes", () => {
    const today = new Date("2026-07-20T16:00:00Z");
    const tomorrow = new Date("2026-07-21T16:00:00Z");
    expect(messageForDay(NY, tomorrow)).not.toBe(messageForDay(NY, today));
  });

  it("cycles about once a month, and wraps cleanly", () => {
    const day = (iso: string) => messageForDay(NY, new Date(iso));
    // 30 lines → the line 30 days later is the same one again.
    expect(day("2026-08-19T16:00:00Z")).toBe(day("2026-07-20T16:00:00Z"));
  });

  it("returns a real line for every day of a leap year", () => {
    // Day 366 must not fall off the end of the array.
    for (let i = 0; i < 366; i++) {
      const d = new Date(Date.UTC(2028, 0, 1 + i, 16));
      const msg = messageForDay(NY, d);
      expect(DAILY_MESSAGES).toContain(msg);
    }
  });

  it("gives Jan 1 the first line", () => {
    expect(messageForDay(NY, new Date("2026-01-01T16:00:00Z"))).toBe(DAILY_MESSAGES[0]);
  });

  it("resolves per timezone — two zones on different calendar days differ", () => {
    // 01:00 UTC Jul 21: still Jul 20 in New York, already Jul 21 in London.
    const instant = new Date("2026-07-21T01:00:00Z");
    expect(messageForDay(NY, instant)).not.toBe(messageForDay("Europe/London", instant));
  });
});
