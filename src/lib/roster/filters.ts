// Roster search — the pure filter layer (no DB, no React), so search-filter
// correctness can be unit-tested (CLAUDE.md guardrail #6: "search returning
// correct filtered results" is a flow that cannot break).
//
// `parseRosterParams` turns raw URL query params into a validated filter object;
// `profileMatchesFilters` is the reference predicate the SQL query mirrors (each
// facet = an array overlap / equality; text is Postgres full-text in the real
// query, approximated here as a name substring). The Roster page builds its
// Supabase query from the same parsed filters.

import { canonicalServiceSlugs, legacyAvailabilityAsServices } from "./services";

/** Result page size. */
export const ROSTER_PAGE_SIZE = 24;

/**
 * The role CATEGORIES shown as tabs. Role is a category, deliberately kept OUT of
 * the filter bar (build spec §8); studios are the employer side, not talent, so
 * studio_owner is excluded from the talent Roster.
 */
export const ROSTER_CATEGORIES: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: "teacher", label: "Teachers" },
  { slug: "choreographer", label: "Choreographers" },
  { slug: "working_dancer", label: "Performers" },
];

const CATEGORY_SLUGS = new Set(ROSTER_CATEGORIES.map((c) => c.slug));

export type RosterFilters = {
  role: string | null; // one of CATEGORY_SLUGS, else null (= all)
  styles: string[];
  levels: string[];
  certs: string[];
  // Availability tags — BOTH kinds ("general" like weekends/travel, and
  // "currently" like accepting-choreography) share one facet, because they
  // filter identically and a studio combining them ("weekends AND accepting
  // master classes") wants a single ANY-within / AND-across rule, not two.
  availability: string[];
  /**
   * MY SERVICES — what the professional offers. Sourced from
   * `professional_offerings` via `roster_profiles.service_slugs`; the Roster
   * keeps no vocabulary of its own (the 2026-08-18 principle: one fact, one
   * source of truth). Replaces the retired `kind = currently` availability tags.
   */
  services: string[];
  region: string | null; // region_id (uuid) as string
  state: string | null; // state/province, case-insensitive
  q: string | null; // free-text (name/bio)
  page: number; // 1-based
};

/** A row from the `roster_profiles` view (the fields the filter cares about). */
export type RosterRow = {
  primary_role: string | null;
  style_slugs: string[] | null;
  level_slugs: string[] | null;
  cert_slugs: string[] | null;
  availability_slugs: string[] | null;
  /** Derived from the member's ACTIVE My Services rows (the source of truth). */
  service_slugs: string[] | null;
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
  const roleRaw = firstString(sp.role).toLowerCase();
  const role = CATEGORY_SLUGS.has(roleRaw) ? roleRaw : null;

  const region = firstString(sp.region) || null;
  const state = firstString(sp.state) || null;
  const q = firstString(sp.q) || null;

  const pageNum = Number.parseInt(firstString(sp.page), 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return {
    role,
    styles: multi(sp.style),
    levels: multi(sp.level),
    certs: multi(sp.cert),
    availability: multi(sp.avail),
    services: multi(sp.svc),
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
 * The availability facet, with the retired tags kept working.
 *
 * A profile satisfies an `avail` value if it still HOLDS that tag, **or** if it
 * offers the service that replaced it. Both paths are honoured because the four
 * `kind = 'currently'` tags became My Services on 2026-08-18 and the tags were
 * deliberately kept (inactive) rather than deleted:
 *
 *   · an existing member who held the tag keeps matching — nothing lost today;
 *   · a member who joined AFTERWARDS has the service and no tag, and now
 *     matches too — which the tag-only path could never have done;
 *   · and it keeps matching once the tags are finally deleted.
 *
 * A plain `general` availability filter (weekends, willing to travel) expands to
 * no services and behaves exactly as it always did.
 */
function matchesAvailability(row: RosterRow, want: string[]): boolean {
  if (want.length === 0) return true;
  if (overlaps(row.availability_slugs, want)) return true;
  const asServices = legacyAvailabilityAsServices(want);
  return asServices.length > 0 && overlaps(row.service_slugs, asServices);
}

/**
 * Reference predicate the SQL query mirrors: a profile matches when it's an
 * active-owner row AND satisfies every applied facet (AND across facets, ANY
 * within a facet). Text `q` is approximated as a case-insensitive name substring
 * (the live query uses Postgres full-text over name+bio).
 */
export function profileMatchesFilters(row: RosterRow, f: RosterFilters): boolean {
  if (!row.owner_active) return false;
  if (f.role && row.primary_role !== f.role) return false;
  if (!overlaps(row.style_slugs, f.styles)) return false;
  if (!overlaps(row.level_slugs, f.levels)) return false;
  if (!overlaps(row.cert_slugs, f.certs)) return false;
  if (!matchesAvailability(row, f.availability)) return false;
  // Resolved through the alias table, so a retired service slug
  // (private-audition-coaching) still finds the service that absorbed it.
  if (!overlaps(row.service_slugs, canonicalServiceSlugs(f.services))) return false;
  if (f.region && row.region_id !== f.region) return false;
  if (f.state && (row.state_province ?? "").toLowerCase() !== f.state.toLowerCase()) return false;
  if (f.q && !row.display_name.toLowerCase().includes(f.q.toLowerCase())) return false;
  return true;
}

/** True when no facet/text filter is applied (only category/paging may be set). */
export function hasNoActiveFilters(f: RosterFilters): boolean {
  return (
    f.styles.length === 0 &&
    f.levels.length === 0 &&
    f.certs.length === 0 &&
    f.availability.length === 0 &&
    f.services.length === 0 &&
    !f.region &&
    !f.state &&
    !f.q
  );
}
