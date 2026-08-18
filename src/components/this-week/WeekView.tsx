// Groups events by day (in the week's day order) and renders a DayGroup per day
// that has events.
//
// ── The empty state (redesigned 2026-08-18) ──
// Two DIFFERENT kinds of "nothing to show" exist, and they must not share
// copy: a genuinely quiet week (nothing scheduled at all) is a normal, fine
// thing — it deserves the same editorial, unhurried voice as the rest of the
// page, not a placeholder box. A filtered-to-zero view is a different fact
// entirely — the week isn't empty, the FILTER is just narrow — and dressing
// that up the same way would be dishonest, so it stays plain and says so.
//
// `emptyHint` still exists for the family/child callers (FamilyWeekView,
// ChildWeek), whose own wording ("Ava has a clear week — no classes
// scheduled.") is context they know and this component doesn't — only the
// PROFESSIONAL view (ThisWeekScreen) now relies on the built-in default. Every
// caller gets the same calm ivory treatment either way.

import type { CalendarEvent, WeekRange } from "@/lib/this-week/types";
import { DayGroup } from "./DayGroup";

export function WeekView({
  week,
  events,
  isFiltered = false,
  emptyHint,
}: {
  week: WeekRange;
  events: CalendarEvent[];
  /** True when a category filter — not the week itself — is why this is empty. */
  isFiltered?: boolean;
  /** Caller-supplied detail line for a genuinely empty week. Defaults below. */
  emptyHint?: string;
}) {
  if (events.length === 0) {
    if (isFiltered) {
      return (
        <div className="rounded-xl bg-[var(--rc-ivory)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--rc-muted)]">
            No cards match this filter — choose All to see the rest of your week.
          </p>
        </div>
      );
    }

    // A genuinely quiet week. Intentional and beautiful, not empty — the same
    // ivory-and-serif voice as the rest of the page, generous room rather than
    // a dashed placeholder box (founder direction, 2026-08-18).
    return (
      <div className="rounded-2xl bg-[var(--rc-ivory)] px-8 py-16 text-center">
        <p className="rc-serif text-xl italic text-[var(--rc-ink)]">A quiet week.</p>
        <p className="mt-2 text-sm text-[var(--rc-muted)]">
          {emptyHint ?? "Nothing on the calendar yet — add what's ahead whenever you're ready."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {week.days.map((day) => {
        const dayEvents = events.filter((e) => e.day === day.key);
        return <DayGroup key={day.key} day={day} events={dayEvents} />;
      })}
    </div>
  );
}
