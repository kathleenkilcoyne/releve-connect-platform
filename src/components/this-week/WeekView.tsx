// Groups events by day (in the week's day order) and renders a DayGroup per day
// that has events. Shows an inviting empty state when the week is clear.

import type { CalendarEvent, WeekRange } from "@/lib/this-week/types";
import { DayGroup } from "./DayGroup";

export function WeekView({
  week,
  events,
  emptyHint,
}: {
  week: WeekRange;
  events: CalendarEvent[];
  emptyHint?: string;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--rc-hairline)] bg-[var(--rc-ivory)] px-6 py-12 text-center">
        <p className="rc-serif text-lg text-[var(--rc-ink)]">
          Nothing on the calendar this week.
        </p>
        <p className="mt-1 text-sm text-[var(--rc-muted)]">
          {emptyHint ?? "A clear week — enjoy the rest, or plan ahead."}
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
