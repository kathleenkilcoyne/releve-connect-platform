// Age Divisions — the studio's per-dancer competitive category (Slice refinement,
// 2026-07-31). STUDIO-CONTROLLED, never derived from age: competitions define
// divisions differently and a dancer can age into a new one mid-season.
//
// App-level constant, deliberately NOT a DB enum, so a studio's set can extend
// without a migration. Stored on the studio-scoped `affiliations.division`.

export const AGE_DIVISIONS = [
  "Mini",
  "Petite",
  "Junior",
  "Pre-Teen",
  "Teen",
  "Senior",
  "Open",
  "Adult",
] as const;

export type AgeDivision = (typeof AGE_DIVISIONS)[number];

export function isValidDivision(v: string): boolean {
  return (AGE_DIVISIONS as readonly string[]).includes(v);
}
