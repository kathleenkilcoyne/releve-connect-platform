// The EventCard — the heart of the mockup's card anatomy:
//   • rounded rectangle, soft shadow, ivory surface
//   • a THICK colour-matched LEFT edge (category colour)
//   • bold serif title top-left; solid category tag pill top-right
//   • muted role-smart detail line with " · " separators
//   • attachment chips (when present)
//   • pay rate + payment status on teaching/booked cards
//
// The left edge colour repeats the tag's colour, so colour is redundant with
// the always-present text label — never the only signal.

import { categoryColor } from "@/lib/this-week/categories";
import type { CalendarEvent } from "@/lib/this-week/types";
import { AttachmentChip } from "./AttachmentChip";
import { CategoryTag } from "./CategoryTag";
import { PayBadge } from "./PayBadge";

function formatTime(event: CalendarEvent): string {
  const { start, end } = event.time;
  return end ? `${start}–${end}` : start;
}

export function EventCard({ event }: { event: CalendarEvent }) {
  const detailLine = [formatTime(event), ...event.detail].join(" · ");

  return (
    <article
      className="rc-card-shadow overflow-hidden rounded-xl border border-[var(--rc-hairline)] bg-[var(--rc-ivory)]"
      style={{ borderLeft: `6px solid ${categoryColor(event.category)}` }}
    >
      <div className="px-4 py-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="rc-serif text-lg font-semibold leading-snug text-[var(--rc-ink)]">
            {event.title}
          </h3>
          <CategoryTag category={event.category} />
        </div>

        <p className="mt-1 text-sm text-[var(--rc-muted)]">{detailLine}</p>

        {(event.pay || event.attachments?.length) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {event.pay && <PayBadge pay={event.pay} />}
            {event.attachments?.map((att) => (
              <AttachmentChip key={att.id} attachment={att} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
