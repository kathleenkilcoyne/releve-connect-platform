// Studio (§7) — pure normalization/validation for the light studio profile.
// Dependency-free so the rules can be unit-tested without a DB or React. The
// /studio/edit save action builds the employer_profiles row from this.

import { normalizeHex, normalizeMotto, MOTTO_MAX } from "./branding";
//
// Studios are the buyer side (light onboarding, no vetting) — but the fields a
// sub needs to decide "can I get there?" are structured + controlled so the
// dispatch loop and radius search can query them later.

/** Controlled bands / enums (mirror the DB check constraints in migration 20260713000000). */
// Student-count bands, re-banded 2026-07-23 (founder). The old set was
// under_100 / 100_299 / 300_plus. Kathleen's first draft — 0-50, 50-100,
// 100-150, 200-above — had a HOLE (175 students fits nothing) and OVERLAPS
// (exactly 100 fits two), so these were ratified instead: contiguous, no gaps,
// every studio lands in exactly one. Keep them that way.
export const STUDENT_COUNT_BANDS = ["under_50", "50_99", "100_199", "200_plus"] as const;
export type StudentCountBand = (typeof STUDENT_COUNT_BANDS)[number];

export const PARKING_KINDS = ["onsite", "street", "none"] as const;
export type ParkingKind = (typeof PARKING_KINDS)[number];

/** Human labels for the bands/enums (used by the editor + display). */
export const STUDENT_COUNT_LABELS: Record<StudentCountBand, string> = {
  under_50: "Under 50",
  "50_99": "50–99",
  "100_199": "100–199",
  "200_plus": "200+",
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

/**
 * Parse a free-text "name(s)" field into a clean list. The Artistic Director
 * field allows more than one (co-directors / studio leadership), entered as a
 * comma- or newline-separated string. Blank → empty array.
 */
export function parseNameList(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

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

/**
 * A checkbox: a checked box posts a value ("on" by default); an unchecked box
 * posts nothing. So present/on/yes/true → true, absent → false (never null —
 * a checkbox has no "unknown" state).
 */
export function parseCheckbox(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim().toLowerCase();
  return t === "on" || t === "yes" || t === "true" || t === "1";
}

export type StudioInput = {
  name: string | null | undefined;
  artisticDirector: string | null | undefined; // free text, comma/newline separated
  uniqueNote: string | null | undefined;
  mission: string | null | undefined;
  website: string | null | undefined;
  instagram: string | null | undefined;
  tiktok: string | null | undefined;
  facebook: string | null | undefined;
  promoVideoUrl: string | null | undefined;
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
  // "Getting there" — a simple Accessible-by checkbox row. `carRequired` is the
  // existing column, reused for the "Car / parking" box. The retired free-text
  // fields (nearestTransit / parking / directionsNote) are no longer read here.
  accessibleByTrain: string | null | undefined;
  accessibleByBus: string | null | undefined;
  carRequired: string | null | undefined;
  cultureNote: string | null | undefined;
  bio: string | null | undefined;
  // Organization branding (optional). Accents are hex; the motto is <= 60 chars.
  brandAccent: string | null | undefined;
  brandAccent2: string | null | undefined;
  teamMotto: string | null | undefined;
};

export type StudioRow = {
  name: string;
  artistic_director: string[];
  culture_note: string | null;
  unique_note: string | null;
  mission: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  promo_video_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  // Location is REQUIRED (city + state at minimum) — buildEmployerProfileRow
  // refuses to build a row without them. Kept as `string | null` on the type so
  // the shape still matches reads of legacy/partial rows, but a freshly-built row
  // always carries non-empty city + state.
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  year_founded: number | null;
  student_count_band: StudentCountBand | null;
  staff_count: number | null;
  room_count: number | null;
  // "Getting there" flags. car_required is reused for "Car / parking".
  accessible_by_train: boolean;
  accessible_by_bus: boolean;
  car_required: boolean;
  bio: string | null;
  // Branding (normalized): invalid hex → null; motto trimmed (<= 60, enforced above).
  brand_accent: string | null;
  brand_accent_2: string | null;
  team_motto: string | null;
};

export type StudioParseResult =
  | { ok: true; row: StudioRow }
  | { ok: false; message: string };

/**
 * Normalize + validate the raw studio form into the employer_profiles row shape.
 *
 * TWO hard requirements: a studio NAME and a LOCATION (city + state at minimum).
 * Everything else — the story fields, transport, scale — is optional and can be
 * filled over time (light onboarding). Location is the one gate: no city/state,
 * no Swing/Flex match, so the profile cannot be saved without it (spec:
 * STUDIO-PROFILE-FROM-KATHLEEN.md §3, DoD #3). Address changes clear a stale
 * geocode so the later backfill re-pins the studio; that clearing is handled in
 * the save action (it needs the previous row), not here.
 */
export function buildEmployerProfileRow(
  input: StudioInput,
  now: Date = new Date(),
  isTeam: boolean = false,
): StudioParseResult {
  const noun = isTeam ? "team" : "studio";
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, message: `Please enter your ${noun}'s name.` };

  const city = (input.city ?? "").trim();
  const stateProvince = (input.stateProvince ?? "").trim();
  if (!city || !stateProvince) {
    return {
      ok: false,
      message:
        `Please enter your ${noun}'s city and state — location is required so we can match you ` +
        "with nearby teachers and subs.",
    };
  }

  const motto = normalizeMotto(input.teamMotto);
  if (motto && motto.length > MOTTO_MAX) {
    return {
      ok: false,
      message: `Your motto is a little long — please keep it to ${MOTTO_MAX} characters or fewer.`,
    };
  }

  return {
    ok: true,
    row: {
      name,
      artistic_director: parseNameList(input.artisticDirector),
      culture_note: trimOrNull(input.cultureNote),
      unique_note: trimOrNull(input.uniqueNote),
      mission: trimOrNull(input.mission),
      website: trimOrNull(input.website),
      instagram: trimOrNull(input.instagram),
      tiktok: trimOrNull(input.tiktok),
      facebook: trimOrNull(input.facebook),
      promo_video_url: trimOrNull(input.promoVideoUrl),
      address_line1: trimOrNull(input.addressLine1),
      address_line2: trimOrNull(input.addressLine2),
      city,
      state_province: stateProvince,
      postal_code: trimOrNull(input.postalCode),
      country: trimOrNull(input.country),
      year_founded: parseYearFounded(input.yearFounded, now),
      student_count_band: parseEnum(input.studentCountBand, STUDENT_COUNT_BANDS),
      staff_count: parseCount(input.staffCount),
      room_count: parseCount(input.roomCount),
      accessible_by_train: parseCheckbox(input.accessibleByTrain),
      accessible_by_bus: parseCheckbox(input.accessibleByBus),
      car_required: parseCheckbox(input.carRequired),
      bio: trimOrNull(input.bio),
      brand_accent: normalizeHex(input.brandAccent),
      brand_accent_2: normalizeHex(input.brandAccent2),
      team_motto: motto,
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
