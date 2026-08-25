// Roster search — the pure filter layer (no DB, no React), so search-filter
// correctness can be unit-tested (CLAUDE.md guardrail #6: "search returning
// correct filtered results" is a flow that MUST NOT break).
//
// `parseRosterParams` turns raw URL query params into a validated filter object;
// `profileMatchesFilters` is the reference predicate the SQL query mirrors (each
// facet = an array overlap / equality; text is Postgres full-text in the real
// query, approximated here as a name substring). The Roster page builds its
// Supabase query from the same parsed filters.
//
// ── 2026-08-25 repair ──
// Role used to be validated against a hardcoded 3-category allowlist
// (teacher/choreographer/working_dancer) and matched against the deprecated
// single `primary_role` column. The live `roster_profiles` view moved to a
// multi-role `role_slugs` array (via `profile_roles`) some time ago; this
// module — and the page that queries the view — had not been updated to
// match, and every Roster query was failing outright as a result (selecting a
// column, `primary_role`, that no longer exists on the view). Fixed here:
// role now matches against `role_slugs` (ANY-within, same shape as style/level/
// cert), and the category TAB LIST is no longer a fixed array — it's read live
// from `role_types` by the page (which already has DB access), so every
// current and future talent role works without another hardcoded list to
// maintain. The one deliberate exclusion (studios are the employer side, not
// talent — build spec §8) is kept as an explicit, named set below, not a
// fixed allowlist, and shared with the page so there is one source of truth.
//
// Availability (general + "currently accepting") is REMOVED from the Roster
// entirely (founder decision, 2026-08-25): Available This Week is the real,
// actionable answer to "when can I book this person," not vague chips. The
// `availability_tags` table, `profile_availability` join, and the view's
// `availability_slugs` column are untouched — this is a UI/query-surface
// removal only.

/** Result page size. */
export const ROSTER_PAGE_SIZE = 24;

/**
 * Role categories that must NEVER appear as a Roster tab, even though a role
 * may be a completely ordinary `role_types` row someone holds — studios are
 * the employer side, not talent (build spec §8), so `studio_owner` never
 * shows up as a talent-search category. An explicit exclusion, not an
 * allowlist, so every OTHER current or future talent role works automatically.
 * Exported so the page building the live tab list from `role_types` uses this
 * same single source of truth.
 */
export const EXCLUDED_ROSTER_ROLES = new Set(["studio_owner"]);

export type RosterFilters = {
  role: string | null; // a role_types slug, or null (= all). Not validated
  // against a fixed list here — role_types is dynamic and this module has no
  // DB access; EXCLUDED_ROSTER_ROLES is the one deliberate exception.
  styles: string[];
  levels: string[];
  certs: string[];
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
  cert_slugs: string[] | null;
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
  const role = roleRaw && !EXCLUDED_ROSTER_ROLES.has(roleRaw) ? roleRaw : null;

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
 * within a facet). Text `q` is approximated as a case-insensitive name substring
 * (the live query uses Postgres full-text over name+bio). Role is now an
 * ANY-within-facet match against `role_slugs` — a profile may hold several
 * roles, and matches the tab if it holds the one selected.
 */
export function profileMatchesFilters(row: RosterRow, f: RosterFilters): boolean {
  if (!row.owner_active) return false;
  if (f.role && !(row.role_slugs ?? []).includes(f.role)) return false;
  if (!overlaps(row.style_slugs, f.styles)) return false;
  if (!overlaps(row.level_slugs, f.levels)) return false;
  if (!overlaps(row.cert_slugs, f.certs)) return false;
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
    !f.region &&
    !f.state &&
    !f.q
  );
}
