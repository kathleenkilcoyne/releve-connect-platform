// Pure display logic for a professional's PUBLISHED availability windows on the
// public profile ("Available This Week"). No DB, no React — the query lives in
// [handle]/page.tsx; this only turns already-safe rows into what a visitor reads.
//
// ── THE FIREWALL, expressed as a type ──
// `PublicAvailabilityWindow` is a closed whitelist of five fields: an id, which
// service, and when. There is no `title`, `note`, `location` or `category`
// field to leak, because the loader in page.tsx never selects them from
// `service_availability` in the first place — the same discipline
// `toPublicWindow` in lib/this-week/entry.ts applies on the write side. A studio
// reading this can learn WHEN someone is free and WHAT they're free for. Never
// WHY they are otherwise busy.
//
// Time is rendered in the WINDOW's own timezone (the member's own, chosen when
// they published it) rather than the visitor's browser zone — deterministic on
// the server, and the honest answer to "when are they free" is "free in their
// own time", with the zone named explicitly so nobody has to guess.

export type PublicAvailabilityWindow = {
  id: string;
  offeringId: string;
  offeringTitle: string;
  /** ISO instant. */
  startsAt: string;
  /** ISO instant. */
  endsAt: string;
  /** IANA zone, e.g. "America/New_York". */
  timezone: string;
};

/** "Thu, Aug 20" */
export function formatWindowDate(w: Pick<PublicAvailabilityWindow, "timezone" | "startsAt">): string {
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
export function formatWindowTimeRange(
  w: Pick<PublicAvailabilityWindow, "timezone" | "startsAt" | "endsAt">,
): string {
  const start = clockLabel(w.timezone, w.startsAt);
  const end = clockLabel(w.timezone, w.endsAt);
  const sameMeridiem = /(AM|PM)\s*$/i.exec(start)?.[1] === /(AM|PM)\s*$/i.exec(end)?.[1];
  const startLabel = sameMeridiem ? start.replace(/\s*(AM|PM)\s*$/i, "") : start;
  return `${startLabel} – ${end}`;
}

/** "EDT" / "PST" — the correct abbreviation for THIS instant, DST included. */
export function formatWindowTimezone(
  w: Pick<PublicAvailabilityWindow, "timezone" | "startsAt">,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: w.timezone,
    timeZoneName: "short",
  }).formatToParts(new Date(w.startsAt));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? w.timezone;
}

/** True while the window has not yet ended — the only ones worth showing. */
export function isUpcoming(w: Pick<PublicAvailabilityWindow, "endsAt">, now: Date = new Date()): boolean {
  return new Date(w.endsAt).getTime() > now.getTime();
}
