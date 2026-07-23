import { describe, it, expect } from "vitest";
import {
  parseCount,
  parseEnum,
  parseYearFounded,
  parseTriBool,
  buildEmployerProfileRow,
  addressChanged,
  STUDENT_COUNT_BANDS,
  STUDENT_COUNT_LABELS,
  PARKING_KINDS,
  type StudioInput,
  type StudioRow,
} from "./profile";

/** A fully-blank studio form (only name required) — spread + override per test. */
const blank: StudioInput = {
  name: "Studio A",
  website: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateProvince: "",
  postalCode: "",
  country: "",
  yearFounded: "",
  studentCountBand: "",
  staffCount: "",
  roomCount: "",
  nearestTransit: "",
  carRequired: "",
  parking: "",
  directionsNote: "",
  cultureNote: "",
  bio: "",
};

describe("parseCount", () => {
  it("parses non-negative integers, floors, blanks to null", () => {
    expect(parseCount("12")).toBe(12);
    expect(parseCount(" 3 ")).toBe(3);
    expect(parseCount("4.8")).toBe(4);
    expect(parseCount("0")).toBe(0);
    expect(parseCount("")).toBeNull();
    expect(parseCount(null)).toBeNull();
    expect(parseCount("-2")).toBeNull();
    expect(parseCount("lots")).toBeNull();
  });
});

describe("parseEnum", () => {
  it("keeps allowed values only", () => {
    expect(parseEnum("onsite", PARKING_KINDS)).toBe("onsite");
    expect(parseEnum(" street ", PARKING_KINDS)).toBe("street");
    expect(parseEnum("valet", PARKING_KINDS)).toBeNull();
    expect(parseEnum("", PARKING_KINDS)).toBeNull();
    expect(parseEnum("200_plus", STUDENT_COUNT_BANDS)).toBe("200_plus");
    // The bands were re-banded 2026-07-23; the retired keys must not sneak back
    // in through an old form post or a stale draft.
    expect(parseEnum("under_100", STUDENT_COUNT_BANDS)).toBeNull();
    expect(parseEnum("300_plus", STUDENT_COUNT_BANDS)).toBeNull();
  });
});

describe("STUDENT_COUNT_BANDS", () => {
  it("covers every studio size with no gap and no overlap", () => {
    // The founder's first draft (0-50, 50-100, 100-150, 200-above) left a
    // 151–199 hole and double-counted 50 and 100. Guard against a repeat.
    expect([...STUDENT_COUNT_BANDS]).toEqual(["under_50", "50_99", "100_199", "200_plus"]);
    expect(Object.values(STUDENT_COUNT_LABELS)).toEqual([
      "Under 50",
      "50–99",
      "100–199",
      "200+",
    ]);
  });
});

describe("parseYearFounded", () => {
  const now = new Date("2026-07-13T00:00:00Z");
  it("accepts plausible years", () => {
    expect(parseYearFounded("1998", now)).toBe(1998);
    expect(parseYearFounded(" 2026 ", now)).toBe(2026);
    expect(parseYearFounded("2027", now)).toBe(2027); // next year OK
  });
  it("rejects implausible / non-integer / blank", () => {
    expect(parseYearFounded("1700", now)).toBeNull();
    expect(parseYearFounded("2030", now)).toBeNull(); // beyond next year
    expect(parseYearFounded("99", now)).toBeNull();
    expect(parseYearFounded("19.9", now)).toBeNull();
    expect(parseYearFounded("", now)).toBeNull();
    expect(parseYearFounded(null, now)).toBeNull();
  });
});

describe("parseTriBool", () => {
  it("maps yes/no/blank to true/false/null", () => {
    expect(parseTriBool("yes")).toBe(true);
    expect(parseTriBool("no")).toBe(false);
    expect(parseTriBool("")).toBeNull();
    expect(parseTriBool(null)).toBeNull();
    expect(parseTriBool("maybe")).toBeNull();
  });
});

describe("buildEmployerProfileRow", () => {
  const now = new Date("2026-07-13T00:00:00Z");

  it("requires a studio name", () => {
    const res = buildEmployerProfileRow({ ...blank, name: "   " }, now);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/name/i);
  });

  it("accepts a name-only studio (light onboarding — everything else optional)", () => {
    const res = buildEmployerProfileRow({ ...blank, name: "Elevate Dance" }, now);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.name).toBe("Elevate Dance");
      expect(res.row.city).toBeNull();
      expect(res.row.parking).toBeNull();
      expect(res.row.car_required).toBeNull();
    }
  });

  it("normalizes a fully-filled studio", () => {
    const res = buildEmployerProfileRow(
      {
        name: "  Montclair Dance Collective  ",
        website: " https://mdc.example ",
        addressLine1: "12 Bloomfield Ave",
        addressLine2: "Suite 3",
        city: "Montclair",
        stateProvince: "NJ",
        postalCode: "07042",
        country: "USA",
        yearFounded: "2005",
        studentCountBand: "100_199",
        staffCount: "8",
        roomCount: "3",
        nearestTransit: "Walnut St (Montclair-Boonton Line); bus 28",
        carRequired: "no",
        parking: "street",
        directionsNote: "Enter on Label St",
        cultureNote: "Warm, technique-forward",
        bio: "A community studio.",
      },
      now,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row).toEqual<StudioRow>({
        name: "Montclair Dance Collective",
        website: "https://mdc.example",
        address_line1: "12 Bloomfield Ave",
        address_line2: "Suite 3",
        city: "Montclair",
        state_province: "NJ",
        postal_code: "07042",
        country: "USA",
        year_founded: 2005,
        student_count_band: "100_199",
        staff_count: 8,
        room_count: 3,
        nearest_transit: "Walnut St (Montclair-Boonton Line); bus 28",
        car_required: false,
        parking: "street",
        directions_note: "Enter on Label St",
        culture_note: "Warm, technique-forward",
        bio: "A community studio.",
      });
    }
  });

  it("drops out-of-vocab band/parking and a typo year rather than failing the save", () => {
    const res = buildEmployerProfileRow(
      { ...blank, studentCountBand: "500", parking: "valet", yearFounded: "20205" },
      now,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.student_count_band).toBeNull();
      expect(res.row.parking).toBeNull();
      expect(res.row.year_founded).toBeNull();
    }
  });
});

describe("addressChanged", () => {
  const base: StudioRow = {
    name: "S",
    website: null,
    address_line1: "12 Bloomfield Ave",
    address_line2: null,
    city: "Montclair",
    state_province: "NJ",
    postal_code: "07042",
    country: "USA",
    year_founded: null,
    student_count_band: null,
    staff_count: null,
    room_count: null,
    nearest_transit: null,
    car_required: null,
    parking: null,
    directions_note: null,
    culture_note: null,
    bio: null,
  };

  it("is true when there is no previous row (first save → needs a pin)", () => {
    expect(addressChanged(null, base)).toBe(true);
  });

  it("is false when address fields are unchanged (keep the pin)", () => {
    expect(addressChanged({ ...base }, base)).toBe(false);
  });

  it("is true when any address field changes (invalidate the stale pin)", () => {
    expect(addressChanged({ ...base, city: "Newark" }, base)).toBe(true);
    expect(addressChanged({ ...base, postal_code: "07043" }, base)).toBe(true);
  });

  it("ignores non-address field changes", () => {
    expect(addressChanged({ ...base, culture_note: "different" }, base)).toBe(false);
  });
});
