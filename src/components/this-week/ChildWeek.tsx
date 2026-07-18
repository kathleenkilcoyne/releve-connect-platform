// The parent/student "child's week" view — family-only, scoped to one child.
//
// This is the strategic core rendered statically. It shows, in one place:
//   • the PASSPORT framing: "Ava — Student · managed by Kathleen", a family-only
//     badge, and the entitlement banner from the single access seam
//   • the child's week (same WeekView the professional view uses)
//   • the COORDINATION loop's four surfaces (alert, announcement, prep note,
//     two-way message) as static seams
//
// It renders ONLY when `hasFamilyAccess()` allows — the gate that billing will
// later drive. If access is denied, it shows the upgrade seam instead.

import { getCommunications, hasFamilyAccess } from "@/lib/this-week/data";
import type {
  AnnouncementComm,
  ChangeAlertComm,
  MessageComm,
  NoteComm,
  StudentViewer,
  WeekBundle,
} from "@/lib/this-week/types";
import {
  AnnouncementCard,
  ChangeAlert,
  MessageBubble,
  NoteChip,
} from "./comms";
import { WeekView } from "./WeekView";

export function ChildWeek({ bundle }: { bundle: WeekBundle }) {
  const viewer = bundle.viewer as StudentViewer;
  const { student, guardian } = viewer;
  const access = hasFamilyAccess(guardian);

  // REVENUE ON-RAMP: the entire view is gated by the single access seam.
  if (!access.allowed) {
    return (
      <div className="rounded-xl border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] px-6 py-10 text-center">
        <p className="rc-serif text-xl text-[var(--rc-ink)]">
          {student.displayName}&apos;s week is part of your family subscription
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--rc-muted)]">
          Reactivate your family plan to follow {student.displayName}&apos;s
          schedule and stay in the loop with {student.studioAffiliation}.
        </p>
        <span className="mt-4 inline-block rounded-full bg-[var(--rc-ink)] px-4 py-2 text-sm font-medium text-[var(--rc-cream)]">
          Manage family plan
        </span>
        <p className="mt-3 text-[11px] uppercase tracking-wider text-[var(--rc-muted)]">
          Access seam · status: {access.reason}
        </p>
      </div>
    );
  }

  const comms = getCommunications(viewer);
  const alerts = comms.filter((c): c is ChangeAlertComm => c.kind === "alert");
  const announcements = comms.filter(
    (c): c is AnnouncementComm => c.kind === "announcement",
  );
  const notes = comms.filter((c): c is NoteComm => c.kind === "note");
  const messages = comms.filter((c): c is MessageComm => c.kind === "message");

  return (
    <div className="space-y-7">
      {/* Passport header: who this is, that it's family-only, and the entitlement. */}
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="rc-serif text-3xl font-semibold text-[var(--rc-ink)]">
            {student.displayName}
          </h1>
          <span className="rounded-full border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--rc-muted)]">
            Family only
          </span>
        </div>
        <p className="rc-serif mt-1 text-lg italic text-[var(--rc-muted)]">
          Student · {student.managedByLabel}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--rc-muted)]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--rc-gold-soft)] px-2.5 py-1 font-medium text-[var(--rc-ink)]">
            Family access · {access.reason}
          </span>
          {student.studioAffiliation && (
            <span>Affiliated studio: {student.studioAffiliation}</span>
          )}
        </div>
      </header>

      {/* Change & cancellation alerts surface at the top of the week. */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((c) => (
            <ChangeAlert key={c.id} comm={c} />
          ))}
        </div>
      )}

      {/* The child's week itself. */}
      <WeekView
        week={bundle.week}
        events={bundle.events}
        emptyHint={`${student.displayName} has a clear week — no classes scheduled.`}
      />

      {/* The coordination surfaces live below the week. */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rc-ink)]">
          From {student.studioAffiliation ?? "the studio"}
        </h2>
        {announcements.map((c) => (
          <AnnouncementCard key={c.id} comm={c} />
        ))}
        {notes.map((c) => (
          <NoteChip key={c.id} comm={c} />
        ))}
      </section>

      {/* Two-way messaging seam. */}
      {messages.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rc-ink)]">
            Messages
          </h2>
          <div className="space-y-2">
            {messages.map((c) => (
              <MessageBubble key={c.id} comm={c} />
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] px-4 py-2 text-sm text-[var(--rc-muted)]">
            <span>Message {student.studioAffiliation ?? "the studio"}…</span>
            <span className="ml-auto text-[11px] uppercase tracking-wider">
              Seam · pass two
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
