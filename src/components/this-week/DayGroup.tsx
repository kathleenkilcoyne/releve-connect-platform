// A day group: an uppercase, letter-spaced header (MONDAY · JAN 12) with a thin
// divider rule, then that day's cards in time order. Today's header is marked
// (aria-current + a gold accent) so the highlight isn't colour-only.

import type { CalendarEvent, DayMeta } from "@/lib/this-week/types";
import { EventCard } from "./EventCard";

export function DayGroup({
  day,
  events,
}: {
  day: DayMeta;
  events: CalendarEvent[];
}) {
  if (events.length === 0) return null;

  return (
    <section aria-current={day.isToday ? "date" : undefined}>
      <div className="flex items-baseline gap-3 border-b border-[var(--rc-hairline)] pb-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rc-ink)]">
          {day.label} · {day.dateLabel}
        </h2>
        {day.isToday && (
          <span className="rounded-full bg-[var(--rc-gold-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--rc-ink)]">
            Today
          </span>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}
