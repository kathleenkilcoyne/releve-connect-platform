// A category tag pill (used top-right on cards) and its dot (used on filter
// chips). Colour is the ONLY place the category palette appears — and it is
// always paired with the text label, so colour is never the sole signal (a11y).

import { CATEGORY_META, categoryColor } from "@/lib/this-week/categories";
import type { EventCategory } from "@/lib/this-week/types";

/** The solid uppercase tag pill shown on a card, top-right. */
export function CategoryTag({ category }: { category: EventCategory }) {
  const meta = CATEGORY_META[category];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white"
      style={{ backgroundColor: categoryColor(category) }}
    >
      {meta.label}
    </span>
  );
}

/** The small colour dot used on the pale filter chips. */
export function CategoryDot({ category }: { category: EventCategory }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: categoryColor(category) }}
    />
  );
}
