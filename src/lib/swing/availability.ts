// The Swing — pure normalization for a teacher's availability (Step 5, Slice A).
// Kept dependency-free so the rules can be unit-tested without a DB or React.
// The profile editor's save action builds the swing_availability row from this.

/** A sane cap so a stray keystroke can't set a 99999-mile radius. */
export const SWING_MAX_RADIUS_MILES = 500;

/**
 * Parse a travel-radius input (miles) into a non-negative integer, or null.
 * Empty / non-numeric / negative → null; fractional values floor; anything over
 * the cap clamps to the cap.
 */
export function parseSwingRadius(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.floor(n), SWING_MAX_RADIUS_MILES);
}

export type SwingInput = {
  available: boolean;
  homeLocation: string | null | undefined;
  travelRadiusRaw: string | null | undefined;
  notes: string | null | undefined;
};

export type SwingRow = {
  is_available: boolean;
  home_location: string | null;
  travel_radius_miles: number | null;
  notes: string | null;
};

/**
 * Normalize the raw form values into the swing_availability row shape. Trims
 * text to null when blank, parses the radius. The toggle is stored as-is: a
 * teacher can be available with fields still blank (they can fill them in), and
 * turning OFF preserves the other fields (they simply stop being matched).
 */
export function buildSwingAvailabilityRow(input: SwingInput): SwingRow {
  const trimOrNull = (v: string | null | undefined): string | null => {
    const t = (v ?? "").trim();
    return t === "" ? null : t;
  };
  return {
    is_available: Boolean(input.available),
    home_location: trimOrNull(input.homeLocation),
    travel_radius_miles: parseSwingRadius(input.travelRadiusRaw),
    notes: trimOrNull(input.notes),
  };
}
