// Studio (§7) — pure normalization/validation for the light studio profile.
// Dependency-free so the rules can be unit-tested without a DB or React. The
// /studio/edit save action builds the employer_profiles row from this.
//
// Studios are the buyer side (light onboarding, no vetting) — but the fields a
// sub needs to decide "can I get there?" are structured + controlled so the
// dispatch loop and radius search can query them later.

/** Controlled bands / enums (mirror the DB check constraints in migration 20260713000000). */
export const STUDENT_COUNT_BANDS = ["under_100", "100_299", "300_plus"] as const;
export type StudentCountBand = (typeof STUDENT_COUNT_BANDS)[number];

export const PARKING_KINDS = ["onsite", "street", "none"] as const;
export type ParkingKind = (typeof PARKING_KINDS)[number];

/** Human labels for the bands/enums (used by the editor + display). */
export const STUDENT_COUNT_LABELS: Record<StudentCountBand, string> = {
  under_100: "Under 100",
  "100_299": "100–299",
  "300_plus": "300+",
};
export const PARKING_LABELS: Record<ParkingKind, string> = {
  onsite: "On-site",
  street: "Street",
  none: "None",
};

const trimOrNull = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

/** Keep only a value that's in the allowed set; otherwise null. */
export function parseEnum<T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[],
): T | null {
  const t = (raw ?? "").trim();
  return (allowed as readonly string[]).includes(t) ? (t as T) : null;
}

/** Parse a non-negative integer count (staff / rooms). Blank/invalid/negative → null; floors. */
export function parseCount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/**
 * Parse a founding year. Blank → null. Must be a plausible 4-digit year between
 * 1800 and next year (matches the DB check); otherwise null (silently dropped
 * rather than blocking the whole save on a typo).
 */
export function parseYearFounded(
  raw: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isInteger(n)) return null;
  const max = now.getFullYear() + 1;
  if (n < 1800 || n > max) return null;
  return n;
}

/** A boolean tri-state from a radio/select: "yes"/"no"/"" → true/false/null. */
export function parseTriBool(raw: string | null | undefined): boolean | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "yes" || t === "true" || t === "on") return true;
  if (t === "no" || t === "false" || t === "off") return false;
  return null;
}

export type StudioInput = {
  name: string | null | undefined;
  website: string | null | undefined;
  addressLine1: string | null | undefined;
  addressLine2: string | null | undefined;
  city: string | null | undefined;
  stateProvince: string | null | undefined;
  postalCode: string | null | undefined;
  country: string | null | undefined;
  yearFounded: string | null | undefined;
  studentCountBand: string | null | undefined;
  staffCount: string | null | undefined;
  roomCount: string | null | undefined;
  nearestTransit: string | null | undefined;
  carRequired: string | null | undefined;
  parking: string | null | undefined;
  directionsNote: string | null | undefined;
  cultureNote: string | null | undefined;
  bio: string | null | undefined;
};

export type StudioRow = {
  name: string;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  year_founded: number | null;
  student_count_band: StudentCountBand | null;
  staff_count: number | null;
  room_count: number | null;
  nearest_transit: string | null;
  car_required: boolean | null;
  parking: ParkingKind | null;
  directions_note: string | null;
  culture_note: string | null;
  bio: string | null;
};

export type StudioParseResult =
  | { ok: true; row: StudioRow }
  | { ok: false; message: string };

/**
 * Normalize + validate the raw studio form into the employer_profiles row shape.
 * The ONLY hard requirement is a studio name (everything else can be filled in
 * over time — light onboarding, no gate). Address changes clear a stale geocode
 * so the later backfill re-pins the studio; that clearing is handled in the save
 * action (it needs the previous row), not here.
 */
export function buildEmployerProfileRow(
  input: StudioInput,
  now: Date = new Date(),
): StudioParseResult {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, message: "Please enter your studio's name." };

  return {
    ok: true,
    row: {
      name,
      website: trimOrNull(input.website),
      address_line1: trimOrNull(input.addressLine1),
      address_line2: trimOrNull(input.addressLine2),
      city: trimOrNull(input.city),
      state_province: trimOrNull(input.stateProvince),
      postal_code: trimOrNull(input.postalCode),
      country: trimOrNull(input.country),
      year_founded: parseYearFounded(input.yearFounded, now),
      student_count_band: parseEnum(input.studentCountBand, STUDENT_COUNT_BANDS),
      staff_count: parseCount(input.staffCount),
      room_count: parseCount(input.roomCount),
      nearest_transit: trimOrNull(input.nearestTransit),
      car_required: parseTriBool(input.carRequired),
      parking: parseEnum(input.parking, PARKING_KINDS),
      directions_note: trimOrNull(input.directionsNote),
      culture_note: trimOrNull(input.cultureNote),
      bio: trimOrNull(input.bio),
    },
  };
}

/**
 * The address fields that, when changed, should invalidate a stored map pin so
 * the geocode backfill re-pins the studio. Used by the save action to decide
 * whether to null out lat/lng/geocoded_at.
 */
export function addressChanged(prev: Partial<StudioRow> | null, next: StudioRow): boolean {
  if (!prev) return true;
  const keys: (keyof StudioRow)[] = [
    "address_line1",
    "address_line2",
    "city",
    "state_province",
    "postal_code",
    "country",
  ];
  return keys.some((k) => (prev[k] ?? null) !== (next[k] ?? null));
}
