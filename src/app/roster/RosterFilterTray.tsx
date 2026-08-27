// The collapsed advanced-filter tray (Region · State · Style · Teaching level ·
// Certification) — founder direction, 2026-08-25: "results first, filters
// second." Closed by default, opened only when asked, on a single native
// <details>/<summary> disclosure. No client JavaScript at all: one DOM tree,
// styled responsively by plain CSS (inline reveal on mobile, a compact
// two-column tray on desktop) — this specifically can't reproduce the
// duplicate-mounted-tree bug class (`role=x&role=x` in the URL) an unrelated,
// separate in-progress branch once had to debug for the old filter UI, since
// there is only ever one tree here, not two.
//
// Filter FIELDS and their names are unchanged from the pre-redesign page —
// this component only changes where/how they're presented, not what they do.
// It must render inside the same <form method="get" action="/roster"> as the
// hero search field, so Apply submits everything together.

import type { RosterFilters } from "@/lib/roster/filters";

type Option = { slug: string; label: string };
type RegionOption = { id: string; label: string };

export default function RosterFilterTray({
  filters,
  regionOptions,
  styleOptions,
  levelOptions,
  certOptions,
  clearHref,
}: {
  filters: RosterFilters;
  regionOptions: RegionOption[];
  styleOptions: Option[];
  levelOptions: Option[];
  certOptions: Option[];
  clearHref: string;
}) {
  const activeCount =
    filters.styles.length +
    filters.levels.length +
    filters.certs.length +
    (filters.region ? 1 : 0) +
    (filters.state ? 1 : 0);

  const inputCls =
    "w-full rounded-lg border border-[color:var(--rc-line)] bg-white px-3 py-2 text-sm text-[color:var(--rc-ink)] focus:border-[color:var(--rc-gold)] focus:outline-none";
  const chipCls =
    "inline-flex cursor-pointer items-center gap-2 rounded-full border border-[color:var(--rc-line)] bg-white px-3 py-1.5 text-sm text-[color:var(--rc-ink-soft)] has-[:checked]:border-[color:var(--rc-black)] has-[:checked]:bg-[color:var(--rc-black)] has-[:checked]:text-white";

  return (
    <details className="group mx-auto mt-4 max-w-[900px]">
      <summary className="mx-auto flex w-fit list-none items-center gap-2 rounded-lg border border-[color:var(--rc-line)] bg-[color:var(--rc-paper)] px-4 py-2 text-[13px] font-semibold text-[color:var(--rc-ink)] [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[13px] w-[13px]">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="10" y1="18" x2="14" y2="18" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-[color:var(--rc-gold)] px-1.5 py-0.5 text-[11px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </summary>

      <div className="mt-4 grid grid-cols-1 gap-5 rounded-xl border border-[color:var(--rc-line)] bg-[color:var(--rc-paper)] p-5 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[color:var(--rc-muted)]">Region</p>
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
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[color:var(--rc-muted)]">State / Province</p>
          <input name="state" defaultValue={filters.state ?? ""} placeholder="e.g. NJ" className={inputCls} />
        </div>

        <FilterChipSet title="Style" name="style" options={styleOptions} selected={filters.styles} chipCls={chipCls} />
        <FilterChipSet title="Teaching level" name="level" options={levelOptions} selected={filters.levels} chipCls={chipCls} />
        <div className="sm:col-span-2">
          <FilterChipSet title="Certification" name="cert" options={certOptions} selected={filters.certs} chipCls={chipCls} />
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-[color:var(--rc-line)] pt-4 sm:col-span-2">
          {activeCount > 0 && (
            <a href={clearHref} className="text-sm text-[color:var(--rc-muted)] underline">
              Clear filters
            </a>
          )}
          <button
            type="submit"
            className="rounded-lg bg-[color:var(--rc-black)] px-5 py-2 text-sm font-semibold text-white"
          >
            Apply filters
          </button>
        </div>
      </div>
    </details>
  );
}

function FilterChipSet({
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
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--rc-muted)]">{title}</p>
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
