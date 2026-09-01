// Pure display logic for a bookable window (Professional Services transaction
// rail, Phase 1, 2026-09-01). No DB, no React — mirrors the date/time formatting
// approach used elsewhere in the profile (e.g. This Week), kept small and
// self-contained here since this rail's public UI has no separate "Available
// This Week" surface to share it with.

export type BookingWindow = {
  startsAt: string; // ISO instant
  endsAt: string; // ISO instant
  timezone: string; // IANA zone, e.g. "America/New_York"
};

/** "Thu, Sep 4" */
export function formatBookingDate(w: Pick<BookingWindow, "timezone" | "startsAt">): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: w.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(w.startsAt));
}

function clockLabel(timezone: string, iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/** "2:00 – 4:00 PM", or "10:00 AM – 2:00 PM" when the meridiem changes. */
export function formatBookingTimeRange(w: BookingWindow): string {
  const start = clockLabel(w.timezone, w.startsAt);
  const end = clockLabel(w.timezone, w.endsAt);
  const sameMeridiem = /(AM|PM)\s*$/i.exec(start)?.[1] === /(AM|PM)\s*$/i.exec(end)?.[1];
  const startLabel = sameMeridiem ? start.replace(/\s*(AM|PM)\s*$/i, "") : start;
  return `${startLabel} – ${end}`;
}

/** "EDT" / "PST" — the correct abbreviation for THIS instant, DST included. */
export function formatBookingTimezone(w: Pick<BookingWindow, "timezone" | "startsAt">): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: w.timezone,
    timeZoneName: "short",
  }).formatToParts(new Date(w.startsAt));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? w.timezone;
}

/** "Thu, Sep 4 · 2:00 – 4:00 PM EDT" — one readable phrase for a picker option. */
export function formatBookingWindow(w: BookingWindow): string {
  return `${formatBookingDate(w)} · ${formatBookingTimeRange(w)} ${formatBookingTimezone(w)}`;
}

/** True while the window has not yet ended — the only ones worth offering. */
export function isBookingWindowUpcoming(
  w: Pick<BookingWindow, "endsAt">,
  now: Date = new Date(),
): boolean {
  return new Date(w.endsAt).getTime() > now.getTime();
}
