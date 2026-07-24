"use client";

// The client root for "This Week".
//
// Pass one fetched its own (mock) data here. It no longer fetches: the server
// component resolves the viewer and reads the real week, and this screen renders
// what it is handed. That was the whole point of routing everything through the
// seams — the components below are untouched.
//
// It still owns the genuinely interactive bits: which view is showing and which
// category filter is active. Week navigation moved to the URL, because changing
// weeks is now a real query the server has to run.

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AVA_VIEWER, KATHLEEN, getThisWeek } from "@/lib/this-week/data";
import type { LiveWeekPayload } from "@/lib/this-week/live";
import type { ProfessionalViewer, WeekBundle } from "@/lib/this-week/types";
import { ChildWeek } from "./ChildWeek";
import { DashboardRollup } from "./DashboardRollup";
import { GreetingBand, type GreetingTrack } from "./GreetingBand";
import { FilterBar, type FilterValue } from "./FilterBar";
import { ViewSwitch, type ViewKey } from "./ViewSwitch";
import { WeekNav } from "./WeekNav";
import { WeekView } from "./WeekView";

export function ThisWeekScreen({
  mode,
  weekOffset,
  payload,
  greeting,
  initialView,
  initialStudentId,
}: {
  mode: "live" | "demo";
  weekOffset: number;
  payload?: LiveWeekPayload;
  /** "You Matter Here" — resolved on the server so the daily line can't flicker. */
  greeting?: { message: string; track: GreetingTrack | null };
  /** Force the opening surface (set by the family-join redirect). */
  initialView?: ViewKey;
  /** Open on this specific dancer among a family's children (join redirect). */
  initialStudentId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // In demo mode the sample bundles come from the mock seams, exactly as in
  // pass one. In live mode they arrive as props.
  const demoPro = useMemo(() => getThisWeek(KATHLEEN), []);
  const demoStudent = useMemo(() => getThisWeek(AVA_VIEWER), []);

  const proBundle: WeekBundle | null =
    mode === "live" ? (payload?.professional ?? null) : demoPro;

  // Which dancer to show. Normally the first (guardianships are ordered
  // primary-first); when the join redirect names a specific child, open on that
  // one so a just-enrolled dancer is the one selected.
  const liveStudent =
    (initialStudentId
      ? payload?.students.find(
          (s) => s.bundle.viewer.kind === "student" && s.bundle.viewer.student.id === initialStudentId,
        )
      : undefined) ??
    payload?.students[0] ??
    null;
  const studentBundle: WeekBundle | null =
    mode === "live" ? (liveStudent?.bundle ?? null) : demoStudent;

  // Open on whichever view the member actually has. A guardian with no talent
  // profile should land on their child's week, not an empty professional one —
  // and a multi-role member arriving from a family join is forced onto the
  // student view by `initialView`, so their teacher week doesn't shadow the
  // dancer they just added.
  const [view, setView] = useState<ViewKey>(
    initialView ?? (proBundle ? "professional" : "student"),
  );
  const [filter, setFilter] = useState<FilterValue>("all");

  const goToWeek = (next: number) => {
    router.push(next === 0 ? pathname : `${pathname}?week=${next}`);
  };

  const pro = proBundle?.viewer as ProfessionalViewer | undefined;

  const proEvents =
    proBundle && filter !== "all"
      ? proBundle.events.filter((e) => e.category === filter)
      : (proBundle?.events ?? []);

  const showSwitch = Boolean(proBundle && studentBundle);
  const activeView: ViewKey = view === "student" && !studentBundle ? "professional" : view;

  return (
    <main className="this-week-scope mx-auto min-h-screen w-full max-w-2xl flex-1 px-5 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between">
        <span className="rc-serif text-sm font-semibold uppercase tracking-[0.2em] text-[var(--rc-ink)]">
          Relevé Connect
        </span>
        <span className="rounded-full border border-[var(--rc-gold)] px-3 py-1 text-xs font-medium text-[var(--rc-ink)]">
          This Week
        </span>
      </div>

      {/* "You Matter Here" — the first thing on the page, before the week. */}
      {greeting && (
        <div className="mt-6">
          <GreetingBand message={greeting.message} track={greeting.track} />
        </div>
      )}

      {/* Demo mode says so plainly. Showing sample data unlabelled next to a
          real member's name would be the one genuinely misleading outcome. */}
      {mode === "demo" && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-dashed border-[var(--rc-hairline)] bg-[var(--rc-ivory)] px-4 py-2.5 text-xs text-[var(--rc-muted)]"
        >
          <strong className="font-semibold text-[var(--rc-ink)]">Sample week.</strong>{" "}
          This is example data showing how This Week works — not a real schedule.
          Sign in and add classes to see your own.
        </p>
      )}

      {showSwitch && (
        <div className="mt-6">
          <ViewSwitch
            value={activeView}
            onChange={setView}
            professionalLabel={`${pro?.displayName ?? "You"} · ${pro?.roles.join(" · ") ?? ""}`}
            studentLabel={`${
              studentBundle?.viewer.kind === "student"
                ? studentBundle.viewer.student.displayName
                : "Student"
            } · Student`}
          />
        </div>
      )}

      {activeView === "professional" && proBundle && pro ? (
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
            rangeLabel={proBundle.week.label}
            timezone={proBundle.week.timezone}
            offset={weekOffset}
            onPrev={() => goToWeek(weekOffset - 1)}
            onNext={() => goToWeek(weekOffset + 1)}
            onToday={() => goToWeek(0)}
          />

          <FilterBar value={filter} onChange={setFilter} />

          <WeekView
            week={proBundle.week}
            events={proEvents}
            emptyHint={
              proBundle.events.length === 0
                ? "Nothing scheduled this week."
                : "No cards match this filter — try All."
            }
          />

          {filter === "all" && proBundle.rollups.length > 0 && (
            <div className="space-y-4 pt-1">
              {proBundle.rollups.map((r) => (
                <DashboardRollup key={r.id} rollup={r} />
              ))}
            </div>
          )}
        </div>
      ) : studentBundle ? (
        <div className="mt-8">
          <ChildWeek
            bundle={studentBundle}
            communications={liveStudent?.communications}
            access={liveStudent?.access}
            weekOffset={weekOffset}
            onWeekChange={goToWeek}
          />
        </div>
      ) : null}

      <footer className="mt-12 border-t border-[var(--rc-hairline)] pt-4 text-xs text-[var(--rc-muted)]">
        {mode === "live"
          ? "Your week, read live from your studio's schedule."
          : "Sample data · getThisWeek · getCommunications · hasFamilyAccess."}
      </footer>
    </main>
  );
}
