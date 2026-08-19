// PUBLIC "Available This Week" section on /[handle] — service_availability,
// joined to My Services, read-only.
//
// This is the OTHER half of the write path built 2026-08-18
// (lib/this-week/entry.ts + app/this-week/actions.ts): a member can now publish
// a window, but until this component existed nothing showed it to a studio.
// "The database can publish availability" and "a studio can discover it" turned
// out to be two different things, and this is the second one.
//
// ── Prominence (founder direction, 2026-08-18) ──
// "It should NOT look like another small metadata field." Card treatment
// mirrors My Services (OfferingsSection) exactly — same rounded-2xl/border/
// bg-neutral-50 language — so the pair reads as one storefront: what you can
// hire them for, and when. The section heading itself is set at hero scale
// (not the small uppercase eyebrow style used by Credentials/Selected Work),
// specifically so this never reads as a tag row.
//
// The section returns null when there is nothing to show — a profile with no
// published windows renders exactly as before. `windows` already arrives
// pre-filtered to a genuinely valid, live, upcoming, published window (see
// loadPublicAvailability in page.tsx: status='open', a real My Service,
// not yet ended) — this component adds no filtering of its own.
//
// ── The Inquire action (new, 2026-08-18) ──
// Built on the SAME InquireButton used by My Services, so the send/error/
// pending/sent behavior is identical, not a second implementation. The
// prefilled note names the service AND the exact date/time
// (windowInquiryPrefillMessage) — built from ONLY the four public fields on
// PublicAvailabilityWindow, which is the same firewall the read path already
// enforces. There is no path from here to a private title, note, or location.

import {
  formatWindowDate,
  formatWindowTimeRange,
  formatWindowTimezone,
  windowInquiryPrefillMessage,
  type PublicAvailabilityWindow,
} from "@/lib/profile/public-availability";
import { InquireButton } from "./InquireButton";

type ViewerContext = {
  profileId: string;
  handle: string;
  firstName: string;
  canAct: boolean;
  isOwner: boolean;
};

export default function AvailabilityWindowsSection({
  windows,
  ...viewer
}: { windows: PublicAvailabilityWindow[] } & ViewerContext) {
  if (windows.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold text-neutral-900">Available This Week</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Open windows, ready to book. Reach out and hold your time.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {windows.map((w) => (
          <WindowCard key={w.id} window={w} viewer={viewer} />
        ))}
      </div>
    </section>
  );
}

function WindowCard({
  window: w,
  viewer,
}: {
  window: PublicAvailabilityWindow;
  viewer: ViewerContext;
}) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
      {/* 1 · Service — the primary line, matching My Services' card. */}
      <h3 className="text-lg font-semibold leading-snug text-neutral-900">{w.offeringTitle}</h3>

      {/* 2 · When — secondary eyebrow beneath the title, same treatment as
             My Services' type+price line. */}
      <p className="mt-1.5 text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
        {formatWindowDate(w)}
        <span className="text-neutral-400"> · </span>
        {formatWindowTimeRange(w)} {formatWindowTimezone(w)}
      </p>

      {/* 3 · Action — the same InquireButton My Services uses, so an inquiry
             about a window behaves identically to one about a service. */}
      <div className="mt-5">
        <InquireButton
          prefillMessage={windowInquiryPrefillMessage(viewer.firstName, w)}
          noteLabel={
            <>
              Your note to {viewer.firstName} about &ldquo;{w.offeringTitle}&rdquo; —{" "}
              {formatWindowDate(w)} · {formatWindowTimeRange(w)} {formatWindowTimezone(w)}
            </>
          }
          profileId={viewer.profileId}
          firstName={viewer.firstName}
          handle={viewer.handle}
          canAct={viewer.canAct}
          isOwner={viewer.isOwner}
        />
      </div>
    </article>
  );
}
