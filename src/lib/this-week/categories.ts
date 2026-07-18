// "This Week" — category + attachment presentation metadata.
//
// Colour is a DESIGN TOKEN, never a raw hex here: each category points at a CSS
// variable defined in `tokens.css` (scoped to `.this-week-scope`). Components
// reference these via `categoryColor()` in inline styles for the left edge, the
// tag pill and the dot — the only three places colour is allowed to appear.

import type { AttachmentKind, EventCategory } from "./types";

export interface CategoryMeta {
  /** Chip / tag text, e.g. "Teaching". Also the a11y label so colour is never
   *  the only signal. */
  label: string;
  /** CSS custom property holding the colour (in `tokens.css`). */
  colorVar: string;
  /** True → shown as a filter chip in the FilterBar. False → tag-only. */
  isFilter: boolean;
}

export const CATEGORY_META: Record<EventCategory, CategoryMeta> = {
  taking: { label: "Taking", colorVar: "--rc-cat-taking", isFilter: true },
  teaching: { label: "Teaching", colorVar: "--rc-cat-teaching", isFilter: true },
  subbing: { label: "Subbing", colorVar: "--rc-cat-subbing", isFilter: true },
  rehearsing: { label: "Rehearsing", colorVar: "--rc-cat-rehearsing", isFilter: true },
  auditioning: { label: "Auditioning", colorVar: "--rc-cat-auditioning", isFilter: true },
  coaching: { label: "Coaching", colorVar: "--rc-cat-coaching", isFilter: true },
  personal: { label: "Personal", colorVar: "--rc-cat-personal", isFilter: true },
  // Extra event types — tags only, not filter lenses:
  availability: { label: "Availability", colorVar: "--rc-cat-availability", isFilter: false },
  deadline: { label: "Deadline", colorVar: "--rc-cat-deadline", isFilter: false },
  performance: { label: "Performance", colorVar: "--rc-cat-performance", isFilter: false },
};

/** The `var(--…)` reference for a category's colour, for inline styles. */
export function categoryColor(category: EventCategory): string {
  return `var(${CATEGORY_META[category].colorVar})`;
}

/** Ordered list of filter chips: the pseudo-category "all" first, then the
 *  seven role categories in the spec's order. */
export const FILTER_ORDER: Array<"all" | EventCategory> = [
  "all",
  "taking",
  "teaching",
  "subbing",
  "rehearsing",
  "auditioning",
  "coaching",
  "personal",
];

/** Leading glyph for an attachment chip. Kept as simple unicode so pass one
 *  needs no icon dependency; pass two can swap in an icon set behind the chip. */
export const ATTACHMENT_GLYPH: Record<AttachmentKind, string> = {
  music: "♪", // ♪
  notes: "✎", // ✎
  video: "▶", // ▶
  document: "╤", // ╤ (sheet)
  runOrder: "↘", // ↘
  costume: "☷", // ☷
};
