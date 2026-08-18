// PUBLIC "Available This Week" section on /[handle] — service_availability,
// joined to My Services, read-only.
//
// This is the OTHER half of the write path built 2026-08-18
// (lib/this-week/entry.ts + app/this-week/actions.ts): a member can now publish
// a window, but until this component existed nothing showed it to a studio.
// "The database can publish availability" and "a studio can discover it" turned
// out to be two different things, and this is the second one.
//
// The section is flag-free and simply returns null when there is nothing to
// show — a profile with no published windows renders exactly as before.

import {
  formatWindowDate,
  formatWindowTimeRange,
  formatWindowTimezone,
  type PublicAvailabilityWindow,
} from "@/lib/profile/public-availability";

export default function AvailabilityWindowsSection({
  windows,
}: {
  windows: PublicAvailabilityWindow[];
}) {
  if (windows.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-neutral-500">
        Available This Week
      </h2>
      <ul className="mt-3 space-y-2">
        {windows.map((w) => (
          <li
            key={w.id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
          >
            <span className="text-sm font-medium text-neutral-900">{w.offeringTitle}</span>
            <span className="text-sm text-neutral-600">
              {formatWindowDate(w)} · {formatWindowTimeRange(w)} {formatWindowTimezone(w)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
