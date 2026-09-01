import { describe, it, expect } from "vitest";
import {
  formatBookingDate,
  formatBookingTimeRange,
  formatBookingTimezone,
  formatBookingWindow,
  isBookingWindowUpcoming,
} from "./format";

// A window in a fixed, unambiguous zone/instant so the tests are deterministic
// regardless of the machine's local timezone.
const window = {
  startsAt: "2026-09-04T18:00:00.000Z", // 2:00 PM EDT
  endsAt: "2026-09-04T20:00:00.000Z", // 4:00 PM EDT
  timezone: "America/New_York",
};

describe("formatBookingDate", () => {
  it("renders a short weekday/month/day", () => {
    expect(formatBookingDate(window)).toBe("Fri, Sep 4");
  });
});

describe("formatBookingTimeRange", () => {
  it("drops the repeated meridiem when both ends share one", () => {
    expect(formatBookingTimeRange(window)).toBe("2:00 – 4:00 PM");
  });

  it("keeps both meridiems when they differ", () => {
    const crossesNoon = { ...window, startsAt: "2026-09-04T15:00:00.000Z" }; // 11:00 AM EDT
    expect(formatBookingTimeRange(crossesNoon)).toBe("11:00 AM – 4:00 PM");
  });
});

describe("formatBookingTimezone", () => {
  it("names the correct DST-aware abbreviation", () => {
    expect(formatBookingTimezone(window)).toBe("EDT");
  });
});

describe("formatBookingWindow", () => {
  it("composes one readable phrase", () => {
    expect(formatBookingWindow(window)).toBe("Fri, Sep 4 · 2:00 – 4:00 PM EDT");
  });
});

describe("isBookingWindowUpcoming", () => {
  it("true when the window ends in the future", () => {
    expect(isBookingWindowUpcoming(window, new Date("2026-09-01T00:00:00.000Z"))).toBe(true);
  });
  it("false once the window has ended", () => {
    expect(isBookingWindowUpcoming(window, new Date("2026-09-05T00:00:00.000Z"))).toBe(false);
  });
});
