"use client";

// The filter bar: rounded-pill chips that wrap onto two rows. The selected chip
// is a solid near-black fill with light text; the others are pale pills with a
// small category-colour dot + label. "All" is the default. Colour is paired with
// text on every chip, so it's never the only signal.

import { CATEGORY_META, FILTER_ORDER } from "@/lib/this-week/categories";
import type { EventCategory } from "@/lib/this-week/types";
import { CategoryDot } from "./CategoryTag";

export type FilterValue = "all" | EventCategory;

export function FilterBar({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter this week by category"
      className="flex flex-wrap gap-2"
    >
      {FILTER_ORDER.map((key) => {
        const selected = key === value;
        const label = key === "all" ? "All" : CATEGORY_META[key].label;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(key)}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)]",
              selected
                ? "bg-[var(--rc-ink)] text-[var(--rc-cream)]"
                : "border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] text-[var(--rc-ink)] hover:bg-[var(--rc-gold-soft)]",
            ].join(" ")}
          >
            {key !== "all" && <CategoryDot category={key} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
