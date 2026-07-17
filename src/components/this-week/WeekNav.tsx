"use client";

// Prev / next / today week navigation. Pass one has one seeded week (offset 0);
// other offsets render the inviting empty state (see WeekView). The control is
// real so pass two only has to feed it dated data.

export function WeekNav({
  rangeLabel,
  timezone,
  offset,
  onPrev,
  onNext,
  onToday,
}: {
  rangeLabel: string;
  timezone: string;
  offset: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous week"
          className="grid h-8 w-8 place-items-center rounded-full border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] text-[var(--rc-ink)] transition-colors hover:bg-[var(--rc-gold-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)]"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next week"
          className="grid h-8 w-8 place-items-center rounded-full border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] text-[var(--rc-ink)] transition-colors hover:bg-[var(--rc-gold-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)]"
        >
          ›
        </button>
      </div>

      <p className="text-sm font-medium text-[var(--rc-muted)]">{rangeLabel}</p>

      {offset !== 0 && (
        <button
          type="button"
          onClick={onToday}
          className="rounded-full border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] px-3 py-1 text-xs font-medium text-[var(--rc-ink)] transition-colors hover:bg-[var(--rc-gold-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)]"
        >
          Today
        </button>
      )}

      <span className="ml-auto text-xs text-[var(--rc-muted)]">
        Times in {timezone.replace("America/", "").replace("_", " ")} (ET)
      </span>
    </div>
  );
}
