import { describe, it, expect } from "vitest";
import {
  parseSwingRadius,
  buildSwingAvailabilityRow,
  SWING_MAX_RADIUS_MILES,
} from "./availability";

describe("parseSwingRadius", () => {
  it("parses a plain integer", () => {
    expect(parseSwingRadius("25")).toBe(25);
    expect(parseSwingRadius("  40 ")).toBe(40);
    expect(parseSwingRadius("0")).toBe(0);
  });

  it("returns null for blank / missing / non-numeric input", () => {
    expect(parseSwingRadius("")).toBeNull();
    expect(parseSwingRadius("   ")).toBeNull();
    expect(parseSwingRadius(null)).toBeNull();
    expect(parseSwingRadius(undefined)).toBeNull();
    expect(parseSwingRadius("far")).toBeNull();
  });

  it("rejects negatives and floors fractionals", () => {
    expect(parseSwingRadius("-5")).toBeNull();
    expect(parseSwingRadius("12.9")).toBe(12);
  });

  it("clamps to the max radius", () => {
    expect(parseSwingRadius("99999")).toBe(SWING_MAX_RADIUS_MILES);
  });
});

describe("buildSwingAvailabilityRow", () => {
  it("normalizes a fully-filled available teacher", () => {
    expect(
      buildSwingAvailabilityRow({
        available: true,
        homeLocation: "  Montclair, NJ ",
        travelRadiusRaw: "25",
        notes: " Weekday mornings ",
      }),
    ).toEqual({
      is_available: true,
      home_location: "Montclair, NJ",
      travel_radius_miles: 25,
      notes: "Weekday mornings",
    });
  });

  it("blanks empty text to null and keeps the toggle off", () => {
    expect(
      buildSwingAvailabilityRow({
        available: false,
        homeLocation: "",
        travelRadiusRaw: "",
        notes: "   ",
      }),
    ).toEqual({
      is_available: false,
      home_location: null,
      travel_radius_miles: null,
      notes: null,
    });
  });

  it("allows available with fields still blank (fill-in-later is fine)", () => {
    const row = buildSwingAvailabilityRow({
      available: true,
      homeLocation: null,
      travelRadiusRaw: null,
      notes: null,
    });
    expect(row.is_available).toBe(true);
    expect(row.home_location).toBeNull();
    expect(row.travel_radius_miles).toBeNull();
  });
});
