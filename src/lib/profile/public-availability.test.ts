import { describe, it, expect } from "vitest";
import {
  formatWindowDate,
  formatWindowTimeRange,
  formatWindowTimezone,
  isUpcoming,
  type PublicAvailabilityWindow,
} from "./public-availability";

// "Available This Week" on the public profile. The type itself is the firewall
// — PublicAvailabilityWindow has no field a private calendar entry could leak
// through. These tests are about getting the TIME right; entry.test.ts and the
// production verification cover the privacy boundary.

const window = (over: Partial<PublicAvailabilityWindow> = {}): PublicAvailabilityWindow => ({
  id: "w1",
  offeringId: "svc1",
  offeringTitle: "Guest Teaching",
  startsAt: "2026-08-20T18:00:00.000Z", // 2:00 PM EDT
  endsAt: "2026-08-20T20:00:00.000Z", // 4:00 PM EDT
  timezone: "America/New_York",
  ...over,
});

describe("formatWindowDate", () => {
  it("renders weekday, month, day", () => {
    expect(formatWindowDate(window())).toBe("Thu, Aug 20");
  });

  it("uses the WINDOW's timezone, not UTC", () => {
    // 2026-08-21T02:00:00Z is 10 PM Aug 20 in New York, but Aug 21 in UTC.
    const w = window({ startsAt: "2026-08-21T02:00:00.000Z", timezone: "America/New_York" });
    expect(formatWindowDate(w)).toBe("Thu, Aug 20");
  });
});

describe("formatWindowTimeRange", () => {
  it("collapses a shared meridiem onto the end time only", () => {
    expect(formatWindowTimeRange(window())).toBe("2:00 – 4:00 PM");
  });

  it("keeps both meridiems when they differ", () => {
    const w = window({ startsAt: "2026-08-20T14:00:00.000Z", endsAt: "2026-08-20T18:00:00.000Z" });
    // 10:00 AM – 2:00 PM in New York
    expect(formatWindowTimeRange(w)).toBe("10:00 AM – 2:00 PM");
  });

  it("respects a different timezone entirely", () => {
    const w = window({ timezone: "America/Los_Angeles" });
    // 2026-08-20T18:00Z is 11:00 AM PDT; 20:00Z is 1:00 PM PDT.
    expect(formatWindowTimeRange(w)).toBe("11:00 AM – 1:00 PM");
  });
});

describe("formatWindowTimezone", () => {
  it("gives the correct DST abbreviation for the instant, not a static guess", () => {
    expect(formatWindowTimezone(window())).toBe("EDT"); // August → daylight time
  });

  it("gives standard time for a window outside DST", () => {
    const w = window({ startsAt: "2026-01-20T18:00:00.000Z" });
    expect(formatWindowTimezone(w)).toBe("EST");
  });

  it("handles a non-US zone", () => {
    const w = window({ timezone: "America/Los_Angeles" });
    expect(formatWindowTimezone(w)).toBe("PDT");
  });
});

describe("isUpcoming", () => {
  it("is true for a window that has not ended", () => {
    const w = window();
    expect(isUpcoming(w, new Date("2026-08-20T17:00:00.000Z"))).toBe(true);
  });

  it("is false once the window has ended", () => {
    const w = window();
    expect(isUpcoming(w, new Date("2026-08-20T21:00:00.000Z"))).toBe(false);
  });

  it("is false at the exact end instant (half-open)", () => {
    const w = window();
    expect(isUpcoming(w, new Date(w.endsAt))).toBe(false);
  });
});
