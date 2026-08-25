// THE ROSTER — the public, searchable directory of vetted professionals
// (build spec §8; CLAUDE.md 4C, "the heart"). Reads the `roster_profiles` view
// with the service-role client (the view is server-only, and already returns
// only published/public/active-membership profiles regardless of who's
// asking) and filters it from the URL query params via the pure filter layer
// in src/lib/roster/filters.ts.
//
// Filter bar (clean, §8): style · level · certification · location · text
// search. Role is a CATEGORY (tabs), never a filter chip; honorifics render as
// recognition on cards but are NEVER filters (§13, no-endorsement).
//
// ── 2026-08-25 made public ──
// Browsing the Roster no longer requires signing in or holding a membership
// (founder decision: the Roster is a public "Who's Who" — seeing respected
// professionals listed is what creates the desire to join, so membership must
// not gate merely SEEING who's on it). The former sign-in + active-membership
// redirect gate is removed; nothing else in this file ever depended on the
// signed-in user, since every real query here already ran through the
// service-role client. Gated actions — saving/favoriting (`/roster/saved`),
// messaging, booking, purchasing/licensing, Swing/This Week, profile editing —
// are UNCHANGED and still require sign-in, enforced on their own routes.
//
// ── 2026-08-25 repair ──
// This page was querying the deprecated single `primary_role` column, which no
// longer exists on `roster_profiles` (the view moved to a multi-role
// `role_slugs` array some time ago) — every Roster query was failing outright
// as a result (PostgREST 42703, "column does not exist"), so the page always
// rendered its normal empty state. Fixed: role now matches `role_slugs`
// (ANY-within), and the category tabs are read live from `role_types` instead
// of a hardcoded 3-role list, so every current and future talent role works
// without another list to maintain (see EXCLUDED_ROSTER_ROLES in filters.ts
// for the one deliberate exclusion — studio_owner).
//
// Availability (general + "currently accepting") is REMOVED from this page
// (founder decision, 2026-08-25) — Available This Week is the real, actionable
// answer to "when can I book this person." The `availability_tags` table,
// `profile_availability` join, and the view's `availability_slugs` column are
// untouched; only this page's fetch/filter/copy surface is gone.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseRosterParams,
  hasNoActiveFilters,
  EXCLUDED_ROSTER_ROLES,
  ROSTER_PAGE_SIZE,
  type RosterFilters,
} from "@/lib/roster/filters";

export const dynamic = "force-dynamic";

type Option = { slug: string; label: string };
type RegionOption = { id: string; label: string };

type Card = {
  profile_id: string;
  display_name: string;
  public_slug: string;
  role_slugs: string[] | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  headshot_url: string | null;
  verification_flag: boolean;
  honorifics: string[] | null;
  style_slugs: string[] | null;
  level_slugs: string[] | null;
  years_experience: string | null;
};

function titleCase(s: string) {
  return s.replace(/(^|[-_ ])(\w)/g, (_, sep, c) => (sep ? " " : "") + c.toUpperCase()).trim();
}

// Build a /roster query string from the current filters plus overrides.
function href(base: RosterFilters, patch: Partial<Record<string, string | string[] | null>>): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | string[] | null | undefined) => {
    if (v == null || (Array.isArray(v) && v.length === 0) || v === "") return;
    (Array.isArray(v) ? v : [v]).forEach((x) => p.append(k, x));
  };
  const merged: Record<string, string | string[] | null | undefined> = {
    role: base.role,
    style: base.styles,
    level: base.levels,
    cert: base.certs,
    region: base.region,
    state: base.state,
    q: base.q,
    page: base.page > 1 ? String(base.page) : null,
    ...patch,
  };
  for (const [k, v] of Object.entries(merged)) set(k, v ?? null);
  const s = p.toString();
  return s ? `/roster?${s}` : "/roster";
}

const CLEARED: Partial<RosterFilters> = {
  styles: [],
  levels: [],
  certs: [],
  region: null,
  state: null,
  q: null,
  page: 1,
};

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // No sign-in / membership gate here — the Roster is public (see header).
  const filters = parseRosterParams(await searchParams);

  // ---- Pick-lists for the filter bar / category tabs (world-readable) ----
  const admin = createAdminClient();
  const [stylesRes, levelsRes, certsRes, regionsRes, roleTypesRes] = await Promise.all([
    admin.from("styles").select("slug, label").eq("is_active", true).order("sort_order"),
    admin.from("levels").select("slug, label").eq("is_active", true).order("sort_order"),
    admin.from("certifications").select("slug, label").eq("is_active", true).order("sort_order"),
    admin.from("regions").select("id, label").eq("is_active", true).order("sort_order"),
    admin.from("role_types").select("slug, label").eq("is_active", true).order("sort_order"),
  ]);
  const styleOptions = (stylesRes.data ?? []) as Option[];
  const levelOptions = (levelsRes.data ?? []) as Option[];
  const certOptions = (certsRes.data ?? []) as Option[];
  const regionOptions = (regionsRes.data ?? []) as RegionOption[];
  // Live from role_types, minus the deliberate exclusion (studios aren't a
  // talent category) — the whole point of the repair is that this list needs
  // no further maintenance as roles are added.
  const roleOptions = ((roleTypesRes.data ?? []) as Option[]).filter(
    (r) => !EXCLUDED_ROSTER_ROLES.has(r.slug),
  );
  const labelOf = (opts: Option[]) => Object.fromEntries(opts.map((o) => [o.slug, o.label]));
  const styleLabel = labelOf(styleOptions);
  const levelLabel = labelOf(levelOptions);
  const roleLabel = labelOf(roleOptions);

  // ---- Query the roster view (server-only) with the applied filters ------
  const from = (filters.page - 1) * ROSTER_PAGE_SIZE;
  let query = admin
    .from("roster_profiles")
    .select(
      "profile_id, display_name, public_slug, role_slugs, city, state_province, country, " +
        "headshot_url, verification_flag, honorifics, style_slugs, level_slugs, years_experience",
      { count: "exact" },
    )
    .eq("owner_active", true);

  if (filters.role) query = query.overlaps("role_slugs", [filters.role]);
  if (filters.styles.length) query = query.overlaps("style_slugs", filters.styles);
  if (filters.levels.length) query = query.overlaps("level_slugs", filters.levels);
  if (filters.certs.length) query = query.overlaps("cert_slugs", filters.certs);
  if (filters.region) query = query.eq("region_id", filters.region);
  if (filters.state) query = query.ilike("state_province", filters.state);
  if (filters.q) query = query.textSearch("search_tsv", filters.q, { type: "websearch" });

  const { data, count } = await query
    .order("display_name", { ascending: true })
    .range(from, from + ROSTER_PAGE_SIZE - 1);

  const cards = (data ?? []) as unknown as Card[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / ROSTER_PAGE_SIZE));

  const inputCls =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
  const chipCls =
    "inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white";

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · The Roster
        </p>
        <div className="flex items-center gap-4">
          <Link href="/roster/saved" className="text-sm font-medium text-neutral-700 underline">
            ★ Saved
          </Link>
          <Link href="/" className="text-sm text-neutral-500 underline">
            ← Relevé
          </Link>
        </div>
      </div>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Find a professional</h1>
      <p className="mt-2 text-neutral-600">
        Vetted, verified dance professionals. Search by style, level, certification, and location.
      </p>

      {/* Category tabs (role) — a category, not a filter (§8). Switching a tab
          keeps your other filters. Read live from role_types, not a hardcoded
          list. */}
      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          href={href(filters, { role: null, page: null })}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            filters.role === null
              ? "bg-neutral-900 text-white"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          Everyone
        </Link>
        {roleOptions.map((c) => (
          <Link
            key={c.slug}
            href={href(filters, { role: c.slug, page: null })}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filters.role === c.slug
                ? "bg-neutral-900 text-white"
                : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      {/* Filter bar — plain GET form (no client JS). Preserves the active tab. */}
      <form method="get" action="/roster" className="mt-6 space-y-5 rounded-xl border border-neutral-200 p-5">
        {filters.role && <input type="hidden" name="role" value={filters.role} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-neutral-600">Search name or bio</label>
            <input name="q" defaultValue={filters.q ?? ""} placeholder="e.g. ballet, Juilliard, Ava…" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Region</label>
            <select name="region" defaultValue={filters.region ?? ""} className={inputCls}>
              <option value="">Any region</option>
              {regionOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">State / Province</label>
            <input name="state" defaultValue={filters.state ?? ""} placeholder="e.g. NJ" className={inputCls} />
          </div>
        </div>

        <FilterChips title="Style" name="style" options={styleOptions} selected={filters.styles} chipCls={chipCls} />
        <FilterChips title="Teaching level" name="level" options={levelOptions} selected={filters.levels} chipCls={chipCls} />
        <FilterChips title="Certification" name="cert" options={certOptions} selected={filters.certs} chipCls={chipCls} />

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white">
            Apply filters
          </button>
          {!hasNoActiveFilters(filters) && (
            <Link href={href({ ...filters, ...CLEARED }, {})} className="text-sm text-neutral-500 underline">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      {/* Results */}
      <div className="mt-8 flex items-baseline justify-between">
        <p className="text-sm text-neutral-500">
          {total} {total === 1 ? "professional" : "professionals"}
        </p>
        {total > 0 && (
          <p className="text-sm text-neutral-400">
            Page {filters.page} of {lastPage}
          </p>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center">
          <p className="text-neutral-600">No professionals match these filters yet.</p>
          {!hasNoActiveFilters(filters) && (
            <Link href={href({ ...filters, ...CLEARED }, {})} className="mt-3 inline-block text-sm text-neutral-500 underline">
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const location = [c.city, c.state_province, c.country].filter(Boolean).join(", ");
            const roles = c.role_slugs ?? [];
            const roleText = roles.map((r) => roleLabel[r] ?? titleCase(r)).join(" / ");
            const chips = [
              ...(c.style_slugs ?? []).map((s) => styleLabel[s] ?? titleCase(s)),
              ...(c.level_slugs ?? []).map((l) => levelLabel[l] ?? titleCase(l)),
            ].slice(0, 4);
            return (
              <li key={c.profile_id} className="rounded-xl border border-neutral-200 p-5 hover:border-neutral-300">
                <Link href={`/${c.public_slug}`} className="flex items-start gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200">
                    {c.headshot_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.headshot_url} alt={c.display_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-neutral-300">☺</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-neutral-900">{c.display_name}</span>
                      {c.verification_flag && (
                        <span title="Verified Member" className="shrink-0 text-sky-600">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-neutral-600">
                      {roleText}
                      {roleText && location ? " · " : ""}
                      {location}
                    </p>
                  </div>
                </Link>
                {chips.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {chips.map((chip) => (
                      <span key={chip} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600">
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {total > ROSTER_PAGE_SIZE && (
        <div className="mt-10 flex items-center justify-between">
          {filters.page > 1 ? (
            <Link href={href(filters, { page: String(filters.page - 1) })} className="text-sm font-medium text-neutral-700 underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {filters.page < lastPage ? (
            <Link href={href(filters, { page: String(filters.page + 1) })} className="text-sm font-medium text-neutral-700 underline">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  );
}

function FilterChips({
  title,
  name,
  options,
  selected,
  chipCls,
}: {
  title: string;
  name: string;
  options: Option[];
  selected: string[];
  chipCls: string;
}) {
  if (options.length === 0) return null;
  const sel = new Set(selected);
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.slug} className={chipCls}>
            <input type="checkbox" name={name} value={o.slug} defaultChecked={sel.has(o.slug)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
