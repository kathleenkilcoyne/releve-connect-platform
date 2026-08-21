// Roster search — the pure filter layer (no DB, no React), so search-filter
// correctness can be unit-tested (CLAUDE.md guardrail #6: "search returning
// correct filtered results" is a flow that cannot break).
//
// `parseRosterParams` turns raw URL query params into a validated filter object;
// `profileMatchesFilters` is the reference predicate the SQL query mirrors (each
// facet = an array overlap / equality; text is Postgres full-text in the real
// query, approximated here as a name substring). The Roster page builds its
// Supabase query from the same parsed filters.
//
// Phase 1 rebuild (founder-approved 2026-08-21): Professional Role moved from a
// single-select category tab (filtering on the deprecated `primary_role`
// column) to a proper multi-select facet, filtering on `role_slugs` — the same
// ANY-within/AND-across array-overlap mechanism every other facet already
// uses. Focus Areas and Professional Experience joined as new facets the same
// way. There is no longer a hardcoded role list here — the Roster page reads
// the live option list from `role_types` (see src/app/roster/page.tsx), so an
// admin adding a role never requires a code change.

/** Result page size. */
export const ROSTER_PAGE_SIZE = 24;

export type RosterFilters = {
  roles: string[];
  styles: string[];
  levels: string[];
  focusAreas: string[];
  certs: string[];
  experience: string[];
  // Availability tags — BOTH kinds ("general" like weekends/travel, and
  // "currently" like accepting-choreography) share one facet, because they
  // filter identically and a studio combining them ("weekends AND accepting
  // master classes") wants a single ANY-within / AND-across rule, not two.
  availability: string[];
  region: string | null; // region_id (uuid) as string
  state: string | null; // state/province, case-insensitive
  q: string | null; // free-text (name/bio)
  page: number; // 1-based
};

/** A row from the `roster_profiles` view (the fields the filter cares about). */
export type RosterRow = {
  role_slugs: string[] | null;
  style_slugs: string[] | null;
  level_slugs: string[] | null;
  focus_area_slugs: string[] | null;
  cert_slugs: string[] | null;
  experience_slugs: string[] | null;
  availability_slugs: string[] | null;
  region_id: string | null;
  state_province: string | null;
  display_name: string;
  owner_active: boolean;
};

type RawParams = Record<string, string | string[] | undefined>;

function firstString(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** Split a repeated or comma-separated multi-value param into a clean slug list. */
function multi(v: string | string[] | undefined): string[] {
  const raw = Array.isArray(v) ? v : v == null ? [] : [v];
  return [
    ...new Set(
      raw
        .flatMap((s) => s.split(","))
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

/** Normalize raw URL query params into a validated RosterFilters. */
export function parseRosterParams(sp: RawParams): RosterFilters {
  const region = firstString(sp.region) || null;
  const state = firstString(sp.state) || null;
  const q = firstString(sp.q) || null;

  const pageNum = Number.parseInt(firstString(sp.page), 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return {
    roles: multi(sp.role),
    styles: multi(sp.style),
    levels: multi(sp.level),
    focusAreas: multi(sp.focus),
    certs: multi(sp.cert),
    experience: multi(sp.exp),
    availability: multi(sp.avail),
    region,
    state,
    q,
    page,
  };
}

/** True if the two slug lists share at least one member (ANY-within-facet). */
function overlaps(have: string[] | null, want: string[]): boolean {
  if (want.length === 0) return true; // facet not filtered
  const set = new Set(have ?? []);
  return want.some((w) => set.has(w));
}

/**
 * Reference predicate the SQL query mirrors: a profile matches when it's an
 * active-owner row AND satisfies every applied facet (AND across facets, ANY
 * within a facet — including Role, now a facet like any other: selecting two
 * roles finds anyone with EITHER, not people who hold both simultaneously).
 * Text `q` is approximated as a case-insensitive name substring (the live
 * query uses Postgres full-text over name+bio).
 */
export function profileMatchesFilters(row: RosterRow, f: RosterFilters): boolean {
  if (!row.owner_active) return false;
  if (!overlaps(row.role_slugs, f.roles)) return false;
  if (!overlaps(row.style_slugs, f.styles)) return false;
  if (!overlaps(row.level_slugs, f.levels)) return false;
  if (!overlaps(row.focus_area_slugs, f.focusAreas)) return false;
  if (!overlaps(row.cert_slugs, f.certs)) return false;
  if (!overlaps(row.experience_slugs, f.experience)) return false;
  if (!overlaps(row.availability_slugs, f.availability)) return false;
  if (f.region && row.region_id !== f.region) return false;
  if (f.state && (row.state_province ?? "").toLowerCase() !== f.state.toLowerCase()) return false;
  if (f.q && !row.display_name.toLowerCase().includes(f.q.toLowerCase())) return false;
  return true;
}

/** True when no facet/text filter is applied (only paging may be set). */
export function hasNoActiveFilters(f: RosterFilters): boolean {
  return (
    f.roles.length === 0 &&
    f.styles.length === 0 &&
    f.levels.length === 0 &&
    f.focusAreas.length === 0 &&
    f.certs.length === 0 &&
    f.experience.length === 0 &&
    f.availability.length === 0 &&
    !f.region &&
    !f.state &&
    !f.q
  );
}
