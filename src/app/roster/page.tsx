// THE ROSTER — the public, searchable directory of vetted professionals
// (build spec §8; CLAUDE.md 4C, "the heart"). Reads the `roster_profiles` view
// with the service-role client (the view is server-only, and already returns
// only published/public/active-membership profiles regardless of who's
// asking) and filters it from the URL query params via the pure filter layer
// in src/lib/roster/filters.ts.
//
// ── 2026-08-25 redesigned ──
// Visual redesign only (founder direction: "results first, filters second" —
// a curated, prestigious "Who's Who," not a database form). NONE of the data
// fetching, query building, or filter semantics below changed from the
// pre-redesign page — same fields, same predicates, same `filters.ts`. Only
// the JSX changed: a compact cream/gold hero (scoped via
// components/roster/tokens.css, the same pattern the homepage and This Week
// already use — see that file's header), role tabs capped to the first 3
// (by sort_order, after EXCLUDED_ROSTER_ROLES) plus a "+ More" disclosure,
// the Region/State/Style/Level/Cert controls moved into RosterFilterTray (a
// single collapsed <details>, closed by default, no client JS), and each
// result rendered as a portrait RosterProfileCard instead of a small avatar
// row. The hero search field and the filter tray share ONE <form> (as
// before), so Enter-to-search and Apply-filters both submit every active
// param together.
//
// Public access, the auth-free gate removed 2026-08-25, [handle] public
// profiles, and every gated member action (/roster/saved, messaging,
// booking, Swing/This Week, profile editing) are UNCHANGED by this pass.
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
import RosterProfileCard from "./RosterProfileCard";
import RosterFilterTray from "./RosterFilterTray";
import "@/components/roster/tokens.css";

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

/** The role row stays compact — Everyone plus the first few roles, never a
 *  wall of tabs. The rest live behind "+ More". Driven by role_types'
 *  existing sort_order, not a second hardcoded list — today that's exactly
 *  Teacher / Educator, Choreographer, Dancer. */
const FEATURED_ROLE_COUNT = 3;

function rolePillCls(active: boolean) {
  return active
    ? "rounded-full bg-[color:var(--rc-black)] px-4 py-1.5 text-sm font-medium text-white"
    : "rounded-full border border-[color:var(--rc-line)] bg-[color:var(--rc-paper)] px-4 py-1.5 text-sm font-medium text-[color:var(--rc-ink-soft)] hover:border-[color:var(--rc-gold)] hover:text-[color:var(--rc-ink)]";
}

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
  const featuredRoles = roleOptions.slice(0, FEATURED_ROLE_COUNT);
  const moreRoles = roleOptions.slice(FEATURED_ROLE_COUNT);
  // If the active role is one that's tucked under "+ More", open that
  // disclosure by default so the current selection is never hidden.
  const activeRoleIsHidden = Boolean(filters.role) && moreRoles.some((r) => r.slug === filters.role);

  const labelOf = (opts: Option[]) => Object.fromEntries(opts.map((o) => [o.slug, o.label]));
  const styleLabel = labelOf(styleOptions);
  const levelLabel = labelOf(levelOptions);
  const roleLabel = labelOf(roleOptions);

  // ---- Query the roster view (server-only) with the applied filters ------
  // UNCHANGED from the pre-redesign page — same fields, same predicates.
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
  const clearHref = href({ ...filters, ...CLEARED }, {});

  return (
    <div className="roster-scope">
      {/* Utility bar */}
      <div className="mx-auto flex max-w-[1120px] items-center justify-end gap-5 px-6 pt-4 text-[13px] text-[color:var(--rc-muted)]">
        <Link href="/roster/saved" className="border-b border-[color:var(--rc-line)] pb-px hover:border-[color:var(--rc-gold)] hover:text-[color:var(--rc-ink)]">
          ★ Saved
        </Link>
        <Link href="/" className="border-b border-[color:var(--rc-line)] pb-px hover:border-[color:var(--rc-gold)] hover:text-[color:var(--rc-ink)]">
          ← Relevé
        </Link>
      </div>

      {/* Hero — tight on purpose. The first professional should be one scroll
          away on a phone, not several. */}
      <header className="border-b border-[color:var(--rc-line)] bg-[color:var(--rc-cream)]">
        <div className="mx-auto max-w-[1120px] px-6 pb-6 pt-6 text-center">
          <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[color:var(--rc-gold)]">
            Relevé Connect
          </p>
          <h1 className="mb-2 font-[family-name:var(--font-rc-serif)] text-[clamp(28px,4.2vw,42px)] font-normal leading-[1.08] text-[color:var(--rc-black)]">
            The Professional Roster
          </h1>
          <p className="mx-auto mb-[18px] max-w-[480px] font-[family-name:var(--font-rc-serif)] text-[15.5px] italic leading-[1.45] text-[color:var(--rc-ink-soft)]">
            Vetted, verified dance professionals — the industry&rsquo;s Who&rsquo;s Who.
          </p>

          {/* One shared form: the hero search field AND the collapsed filter
              tray below submit together, so Enter here or Apply there both
              carry every active param. */}
          <form method="get" action="/roster">
            {filters.role && <input type="hidden" name="role" value={filters.role} />}

            <div className="relative mx-auto max-w-[520px]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="pointer-events-none absolute left-[18px] top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--rc-muted)]"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Search by name, style, or specialty…"
                className="w-full rounded-full border border-[color:var(--rc-line)] bg-[color:var(--rc-paper)] py-[13px] pl-11 pr-[18px] text-[15px] text-[color:var(--rc-ink)] outline-none focus:border-[color:var(--rc-gold)] focus:ring-[3px] focus:ring-[rgba(182,145,47,0.14)]"
              />
            </div>

            {/* Role navigation — capped, never a wall of tabs. */}
            <nav className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href={href(filters, { role: null, page: null })} className={rolePillCls(filters.role === null)}>
                Everyone
              </Link>
              {featuredRoles.map((r) => (
                <Link key={r.slug} href={href(filters, { role: r.slug, page: null })} className={rolePillCls(filters.role === r.slug)}>
                  {r.label}
                </Link>
              ))}
              {moreRoles.length > 0 && (
                <details className="inline-block" open={activeRoleIsHidden}>
                  <summary
                    className={`inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-dashed px-4 py-1.5 text-sm font-semibold [&::-webkit-details-marker]:hidden ${
                      activeRoleIsHidden
                        ? "border-[color:var(--rc-black)] bg-[color:var(--rc-black)] text-white"
                        : "border-[color:var(--rc-gold)] text-[color:var(--rc-gold)]"
                    }`}
                  >
                    {activeRoleIsHidden ? roleLabel[filters.role as string] ?? "+ More" : "+ More"}
                  </summary>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {moreRoles.map((r) => (
                      <Link key={r.slug} href={href(filters, { role: r.slug, page: null })} className={rolePillCls(filters.role === r.slug)}>
                        {r.label}
                      </Link>
                    ))}
                  </div>
                </details>
              )}
            </nav>

            {/* Collapsed advanced filters — Region · State · Style · Teaching
                level · Certification. Closed by default; the trigger only
                shows a count once something is actually applied. */}
            <RosterFilterTray
              filters={filters}
              regionOptions={regionOptions}
              styleOptions={styleOptions}
              levelOptions={levelOptions}
              certOptions={certOptions}
              clearHref={clearHref}
            />
          </form>
        </div>
      </header>

      {/* Results — appear immediately below the hero, nothing else in between. */}
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="mt-[26px] flex items-baseline justify-between">
          <p className="font-[family-name:var(--font-rc-serif)] text-[14.5px] text-[color:var(--rc-ink-soft)]">
            <b className="font-semibold text-[color:var(--rc-black)]">{total}</b> {total === 1 ? "professional" : "professionals"}
          </p>
          {total > 0 && (
            <p className="text-xs text-[color:var(--rc-muted)]">
              Page {filters.page} of {lastPage}
            </p>
          )}
        </div>

        {cards.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[color:var(--rc-line)] px-6 py-16 text-center">
            <p className="text-[color:var(--rc-ink-soft)]">No professionals match these filters yet.</p>
            {!hasNoActiveFilters(filters) && (
              <a href={clearHref} className="mt-3 inline-block text-sm text-[color:var(--rc-muted)] underline">
                Clear filters
              </a>
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-[18px] sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {cards.map((c) => {
              const location = [c.city, c.state_province, c.country].filter(Boolean).join(", ");
              const roles = c.role_slugs ?? [];
              const roleText = roles.map((r) => roleLabel[r] ?? titleCase(r)).join(" / ");
              const tags = [
                ...(c.style_slugs ?? []).map((s) => styleLabel[s] ?? titleCase(s)),
                ...(c.level_slugs ?? []).map((l) => levelLabel[l] ?? titleCase(l)),
              ].slice(0, 2);
              // An editorial credit line, sourced from the admin-conferred
              // honorifics already fetched above (e.g. "Founding Artist",
              // "Master Teacher") — NOT founder_distinction ("Founding
              // Professional"/"Founding 25"), which the roster_profiles view
              // does not expose; adding it would need a schema change, out of
              // scope for this visual-only pass.
              const mark = (c.honorifics ?? [])[0] ?? null;
              return (
                <RosterProfileCard
                  key={c.profile_id}
                  slug={c.public_slug}
                  displayName={c.display_name}
                  headshotUrl={c.headshot_url}
                  verified={c.verification_flag}
                  roleText={roleText}
                  location={location}
                  tags={tags}
                  mark={mark}
                />
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {total > ROSTER_PAGE_SIZE && (
          <div className="mt-10 flex items-center justify-between pb-16">
            {filters.page > 1 ? (
              <Link href={href(filters, { page: String(filters.page - 1) })} className="text-sm font-medium text-[color:var(--rc-ink-soft)] underline">
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {filters.page < lastPage ? (
              <Link href={href(filters, { page: String(filters.page + 1) })} className="text-sm font-medium text-[color:var(--rc-ink-soft)] underline">
                Next →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
        {total <= ROSTER_PAGE_SIZE && <div className="pb-16" />}
      </div>
    </div>
  );
}
