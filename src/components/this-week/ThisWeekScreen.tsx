"use client";

// The client root for "This Week". Owns the small amount of interactive state
// (which viewer, which category filter, which week offset) and composes the
// presentational pieces. Everything it renders comes through the data seams, so
// pass two swaps `getThisWeek`'s body and this screen is unchanged.

import { useMemo, useState } from "react";

import { AVA_VIEWER, KATHLEEN, getThisWeek } from "@/lib/this-week/data";
import type { ProfessionalViewer } from "@/lib/this-week/types";
import { ChildWeek } from "./ChildWeek";
import { DashboardRollup } from "./DashboardRollup";
import { FilterBar, type FilterValue } from "./FilterBar";
import { ViewSwitch, type ViewKey } from "./ViewSwitch";
import { WeekNav } from "./WeekNav";
import { WeekView } from "./WeekView";

export function ThisWeekScreen() {
  const [view, setView] = useState<ViewKey>("professional");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [offset, setOffset] = useState(0); // 0 = the seeded current week

  // The professional bundle (always fetched so the header stays stable).
  const proBundle = useMemo(() => getThisWeek(KATHLEEN), []);
  const studentBundle = useMemo(() => getThisWeek(AVA_VIEWER), []);

  const pro = proBundle.viewer as ProfessionalViewer;

  // Pass one seeds only the current week; other offsets are the empty state.
  const proEvents =
    offset === 0
      ? filter === "all"
        ? proBundle.events
        : proBundle.events.filter((e) => e.category === filter)
      : [];

  const shiftedRangeLabel =
    offset === 0
      ? proBundle.week.label
      : offset < 0
        ? `${Math.abs(offset)} week${Math.abs(offset) > 1 ? "s" : ""} earlier`
        : `${offset} week${offset > 1 ? "s" : ""} ahead`;

  return (
    <main className="this-week-scope mx-auto min-h-screen w-full max-w-2xl flex-1 px-5 py-8 sm:px-6 sm:py-10">
      {/* Wordmark + contextual pill (mockup chrome, in black/cream/gold). */}
      <div className="flex items-center justify-between">
        <span className="rc-serif text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rc-ink)]">
          Relevé Connect
        </span>
        <span className="rounded-full border border-[var(--rc-gold)] px-3 py-1 text-xs font-medium text-[var(--rc-ink)]">
          This Week
        </span>
      </div>

      {/* Preview-only: whose week to show (see ViewSwitch note). */}
      <div className="mt-6">
        <ViewSwitch
          value={view}
          onChange={setView}
          professionalLabel={`${pro.displayName} · ${pro.roles.join(" · ")}`}
          studentLabel={`${studentBundle.viewer.kind === "student" ? studentBundle.viewer.student.displayName : "Student"} · Student`}
        />
      </div>

      {view === "professional" ? (
        <div className="mt-8 space-y-7">
          <header>
            <h1 className="rc-serif text-4xl font-semibold text-[var(--rc-ink)]">
              This Week
            </h1>
            <p className="rc-serif mt-1 text-lg italic text-[var(--rc-muted)]">
              {pro.displayName} — {pro.roles.join(" · ")} | {pro.tagline}
            </p>
          </header>

          <WeekNav
            rangeLabel={shiftedRangeLabel}
            timezone={proBundle.week.timezone}
            offset={offset}
            onPrev={() => setOffset((o) => o - 1)}
            onNext={() => setOffset((o) => o + 1)}
            onToday={() => setOffset(0)}
          />

          <FilterBar value={filter} onChange={setFilter} />

          <WeekView
            week={proBundle.week}
            events={proEvents}
            emptyHint={
              offset === 0
                ? "No cards match this filter — try All."
                : "Nothing scheduled yet. Pass two loads real weeks here."
            }
          />

          {/* Role dashboards stack below the personal week. */}
          {offset === 0 && filter === "all" && proBundle.rollups.length > 0 && (
            <div className="space-y-4 pt-1">
              {proBundle.rollups.map((r) => (
                <DashboardRollup key={r.id} rollup={r} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8">
          <ChildWeek bundle={studentBundle} />
        </div>
      )}

      <footer className="mt-12 border-t border-[var(--rc-hairline)] pt-4 text-xs text-[var(--rc-muted)]">
        Pass-one static prototype · data flows through getThisWeek ·
        getCommunications · hasFamilyAccess. No backend wired.
      </footer>
    </main>
  );
}
