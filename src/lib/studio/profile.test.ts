import { describe, it, expect } from "vitest";
import {
  parseCount,
  parseEnum,
  parseYearFounded,
  parseTriBool,
  parseNameList,
  buildEmployerProfileRow,
  addressChanged,
  STUDENT_COUNT_BANDS,
  STUDENT_COUNT_LABELS,
  PARKING_KINDS,
  type StudioInput,
  type StudioRow,
} from "./profile";

/**
 * A blank studio form — spread + override per test. It carries a valid city +
 * state because those are REQUIRED (no location, no Swing/Flex match); the
 * "location is required" tests deliberately blank them back out.
 */
const blank: StudioInput = {
  name: "Studio A",
  artisticDirector: "",
  uniqueNote: "",
  mission: "",
  website: "",
  instagram: "",
  tiktok: "",
  facebook: "",
  promoVideoUrl: "",
  addressLine1: "",
  addressLine2: "",
  city: "Montclair",
  stateProvince: "NJ",
  postalCode: "",
  country: "",
  yearFounded: "",
  studentCountBand: "",
  staffCount: "",
  roomCount: "",
  accessibleByTrain: "",
  accessibleByBus: "",
  carRequired: "",
  cultureNote: "",
  bio: "",
  brandAccent: "",
  brandAccent2: "",
  teamMotto: "",
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

describe("parseNameList", () => {
  it("splits on commas and newlines, trims, drops blanks", () => {
    expect(parseNameList("Roberta Mathes")).toEqual(["Roberta Mathes"]);
    expect(parseNameList("Roberta Mathes, Jamie Lee")).toEqual(["Roberta Mathes", "Jamie Lee"]);
    expect(parseNameList("A\nB , C")).toEqual(["A", "B", "C"]);
    expect(parseNameList("  ,  ")).toEqual([]);
    expect(parseNameList("")).toEqual([]);
    expect(parseNameList(null)).toEqual([]);
  });
});

describe("buildEmployerProfileRow", () => {
  const now = new Date("2026-07-13T00:00:00Z");

  it("requires a studio name", () => {
    const res = buildEmployerProfileRow({ ...blank, name: "   " }, now);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/name/i);
  });

  it("requires a location — city and state (no location, no match)", () => {
    const noCity = buildEmployerProfileRow({ ...blank, city: "  " }, now);
    expect(noCity.ok).toBe(false);
    if (!noCity.ok) expect(noCity.message).toMatch(/location|city|state/i);

    const noState = buildEmployerProfileRow({ ...blank, stateProvince: "" }, now);
    expect(noState.ok).toBe(false);
    if (!noState.ok) expect(noState.message).toMatch(/location|city|state/i);
  });

  it("accepts a studio with name + location, everything else optional (light onboarding)", () => {
    const res = buildEmployerProfileRow(
      { ...blank, name: "Elevate Dance", city: "Newark", stateProvince: "NJ" },
      now,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.name).toBe("Elevate Dance");
      expect(res.row.city).toBe("Newark");
      expect(res.row.state_province).toBe("NJ");
      expect(res.row.artistic_director).toEqual([]);
      expect(res.row.unique_note).toBeNull();
      expect(res.row.mission).toBeNull();
      // Unchecked accessibility boxes are false (a checkbox has no "unknown").
      expect(res.row.accessible_by_train).toBe(false);
      expect(res.row.accessible_by_bus).toBe(false);
      expect(res.row.car_required).toBe(false);
    }
  });

  it("normalizes a fully-filled studio", () => {
    const res = buildEmployerProfileRow(
      {
        name: "  Montclair Dance Collective  ",
        artisticDirector: "Roberta Mathes, Jamie Lee",
        uniqueNote: "Conservatory training with a heart for college prep.",
        mission: "Training the whole artist.",
        website: " https://mdc.example ",
        instagram: " @mdc ",
        tiktok: "@mdc.dance",
        facebook: "facebook.com/mdc",
        promoVideoUrl: " https://youtu.be/abc ",
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
        accessibleByTrain: "on",
        accessibleByBus: "on",
        carRequired: "on",
        cultureNote: "Warm, technique-forward",
        bio: "A community studio.",
        brandAccent: "#1a1a2e",
        brandAccent2: "",
        teamMotto: "Together we rise",
      },
      now,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row).toEqual<StudioRow>({
        name: "Montclair Dance Collective",
        artistic_director: ["Roberta Mathes", "Jamie Lee"],
        culture_note: "Warm, technique-forward",
        unique_note: "Conservatory training with a heart for college prep.",
        mission: "Training the whole artist.",
        website: "https://mdc.example",
        instagram: "@mdc",
        tiktok: "@mdc.dance",
        facebook: "facebook.com/mdc",
        promo_video_url: "https://youtu.be/abc",
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
        accessible_by_train: true,
        accessible_by_bus: true,
        car_required: true,
        bio: "A community studio.",
        brand_accent: "#1a1a2e",
        brand_accent_2: null,
        team_motto: "Together we rise",
      });
    }
  });

  it("drops an out-of-vocab band and a typo year rather than failing the save", () => {
    const res = buildEmployerProfileRow(
      { ...blank, studentCountBand: "500", yearFounded: "20205" },
      now,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.student_count_band).toBeNull();
      expect(res.row.year_founded).toBeNull();
    }
  });

  it("maps the Accessible-by checkboxes (present → true, absent → false)", () => {
    const res = buildEmployerProfileRow(
      { ...blank, accessibleByTrain: "on", accessibleByBus: "", carRequired: "on" },
      now,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.accessible_by_train).toBe(true);
      expect(res.row.accessible_by_bus).toBe(false);
      expect(res.row.car_required).toBe(true);
    }
  });

  it("normalizes branding accents and keeps a valid motto", () => {
    const res = buildEmployerProfileRow(
      { ...blank, brandAccent: "#ABC", brandAccent2: "not-a-color", teamMotto: "  Rise together  " },
      now,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.brand_accent).toBe("#aabbcc"); // expanded + lowercased
      expect(res.row.brand_accent_2).toBeNull(); // invalid hex dropped
      expect(res.row.team_motto).toBe("Rise together"); // trimmed
    }
  });

  it("rejects a motto longer than 60 characters", () => {
    const res = buildEmployerProfileRow({ ...blank, teamMotto: "a".repeat(61) }, now);
    expect(res.ok).toBe(false);
  });
});

describe("addressChanged", () => {
  const base: StudioRow = {
    name: "S",
    artistic_director: [],
    culture_note: null,
    unique_note: null,
    mission: null,
    website: null,
    instagram: null,
    tiktok: null,
    facebook: null,
    promo_video_url: null,
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
    accessible_by_train: false,
    accessible_by_bus: false,
    car_required: false,
    bio: null,
    brand_accent: null,
    brand_accent_2: null,
    team_motto: null,
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
