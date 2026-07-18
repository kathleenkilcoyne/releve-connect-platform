// Studio <-> family communication surfaces — the COORDINATION TOOL seams.
//
// Pass one renders these as visible, static, NON-functional UI so the loop's
// four surfaces have a real home on the child's-week view:
//   • ChangeAlert      — (a) change & cancellation alerts
//   • AnnouncementCard — (b) studio announcements
//   • MessageBubble    — (c) two-way messaging (parent <-> studio/teacher)
//   • NoteChip         — (d) prep & notes (reuses the attachment-chip anatomy)
//
// No transport is assumed, so live messaging / push can layer on later without
// a rewrite. Each takes its typed model from `types.ts`.

import { ATTACHMENT_GLYPH } from "@/lib/this-week/categories";
import type {
  AnnouncementComm,
  ChangeAlertComm,
  MessageComm,
  NoteComm,
} from "@/lib/this-week/types";

// A small shared "from · timestamp" meta line.
function Meta({ from, timestamp }: { from: string; timestamp: string }) {
  return (
    <p className="text-xs text-[var(--rc-muted)]">
      {from} · {timestamp}
    </p>
  );
}

/** (a) Change & cancellation alert. Uses a gold accent bar (not the category
 *  palette) and a text label so it reads as an alert without colour alone. */
export function ChangeAlert({ comm }: { comm: ChangeAlertComm }) {
  const tag = comm.severity === "cancellation" ? "Cancellation" : "Schedule change";
  return (
    <article
      className="rounded-xl border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] px-4 py-3"
      style={{ borderLeft: "6px solid var(--rc-gold)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-[var(--rc-gold-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--rc-ink)]">
          {tag}
        </span>
        <Meta from={comm.from} timestamp={comm.timestamp} />
      </div>
      <h3 className="rc-serif mt-2 font-semibold text-[var(--rc-ink)]">
        {comm.title}
      </h3>
      <p className="mt-0.5 text-sm text-[var(--rc-muted)]">{comm.body}</p>
    </article>
  );
}

/** (b) Studio announcement. */
export function AnnouncementCard({ comm }: { comm: AnnouncementComm }) {
  return (
    <article className="rounded-xl border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rc-muted)]">
          Announcement
        </span>
        <Meta from={comm.from} timestamp={comm.timestamp} />
      </div>
      <h3 className="rc-serif mt-2 font-semibold text-[var(--rc-ink)]">
        {comm.title}
      </h3>
      <p className="mt-0.5 text-sm text-[var(--rc-muted)]">{comm.body}</p>
    </article>
  );
}

/** (c) One message in the two-way parent <-> studio thread. Family messages sit
 *  to the right, studio/teacher messages to the left. Static in pass one. */
export function MessageBubble({ comm }: { comm: MessageComm }) {
  const fromFamily = comm.direction === "from_family";
  return (
    <div className={fromFamily ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-3.5 py-2",
          fromFamily
            ? "bg-[var(--rc-ink)] text-[var(--rc-cream)]"
            : "border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] text-[var(--rc-ink)]",
        ].join(" ")}
      >
        <p className="text-sm">{comm.body}</p>
        <p
          className={[
            "mt-1 text-[10px]",
            fromFamily ? "text-[var(--rc-gold-soft)]" : "text-[var(--rc-muted)]",
          ].join(" ")}
        >
          {comm.from} · {comm.timestamp}
        </p>
      </div>
    </div>
  );
}

/** (d) Prep / note chip — reuses the attachment-chip anatomy. Non-functional. */
export function NoteChip({ comm }: { comm: NoteComm }) {
  return (
    <article className="rounded-xl border border-dashed border-[var(--rc-hairline)] bg-[var(--rc-cream)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rc-muted)]">
          Prep note
        </span>
        <Meta from={comm.from} timestamp={comm.timestamp} />
      </div>
      <p className="mt-2 text-sm text-[var(--rc-ink)]">{comm.label}</p>
      {comm.attachment && (
        <button
          type="button"
          title="Preview coming in pass two"
          aria-label={`${comm.attachment.label} (attachment — preview coming soon)`}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] px-2.5 py-1 text-xs text-[var(--rc-ink)] transition-colors hover:bg-[var(--rc-gold-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)]"
        >
          <span aria-hidden="true" className="text-[var(--rc-muted)]">
            {ATTACHMENT_GLYPH[comm.attachment.kind]}
          </span>
          {comm.attachment.label}
        </button>
      )}
    </article>
  );
}
