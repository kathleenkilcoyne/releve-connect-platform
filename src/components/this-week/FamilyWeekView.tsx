// The merged family week (Slice 3). ONE personalized week for the whole family:
// every child's items plus the studio-wide items, de-duped and labeled by child
// (each EventCard shows `who`). Whole-family items (Full Studio Event) carry no
// child tag. For a self-managed college dancer this renders their own week
// (selfManaged), same merge, no sibling framing.
//
// Gated by the single family-access seam, exactly like the per-child view was.

import type { AccessResult, CalendarEvent, Communication, WeekRange } from "@/lib/this-week/types";
import type {
  AnnouncementComm,
  ChangeAlertComm,
  MessageComm,
  NoteComm,
} from "@/lib/this-week/types";
import type { OrgBrand } from "@/lib/studio/branding";
import { AnnouncementCard, ChangeAlert, MessageBubble, NoteChip } from "./comms";
import { TeamBrandHeader } from "./TeamBrandHeader";
import { WeekNav } from "./WeekNav";
import { WeekView } from "./WeekView";

export interface FamilyWeekData {
  week: WeekRange;
  events: CalendarEvent[];
  childNames: string[];
  studioNames: string[];
  selfManaged: boolean;
  /** What the team calls its members (self-managed header line). */
  memberLabel: string;
  /** The affiliated org's branding (logo/accents/motto) for the co-branded header. */
  brand: OrgBrand | null;
  access: AccessResult;
  communications: Communication[];
}

/** "Team Members" → "Team Member", "Dancers" → "Dancer". Leaves non-plurals be. */
function singularMember(label: string): string {
  const t = label.trim();
  return t.endsWith("s") ? t.slice(0, -1) : t;
}

export function FamilyWeekView({
  data,
  weekOffset = 0,
  onWeekChange,
}: {
  data: FamilyWeekData;
  weekOffset?: number;
  onWeekChange?: (next: number) => void;
}) {
  const { events, childNames, studioNames, selfManaged, memberLabel, brand, access, communications } = data;
  const studioLabel = studioNames.join(" · ") || "your studio";
  // A self member leads with their TEAM name; the sub-line names their role using
  // the team's own singularized member_label ("Self-managed team member" /
  // "Self-managed dancer").
  const heading = selfManaged ? studioNames[0] || "Your team" : "Your family";
  const whoLabel = selfManaged
    ? `Self-managed ${singularMember(memberLabel).toLowerCase()}`
    : childNames.length > 0
      ? childNames.join(" · ")
      : "Your dancers";

  // REVENUE ON-RAMP: the whole family view is gated by the single access seam.
  if (!access.allowed) {
    return (
      <div className="rounded-xl border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] px-6 py-10 text-center">
        <p className="rc-serif text-xl text-[var(--rc-ink)]">
          {selfManaged ? "Your week" : "Your family's week"} is part of your subscription
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--rc-muted)]">
          Reactivate your plan to follow the schedule and stay in the loop with {studioLabel}.
        </p>
        <span className="mt-4 inline-block rounded-full bg-[var(--rc-ink)] px-4 py-2 text-sm font-medium text-[var(--rc-cream)]">
          Manage plan
        </span>
        <p className="mt-3 text-[11px] uppercase tracking-wider text-[var(--rc-muted)]">
          Access seam · status: {access.reason}
        </p>
      </div>
    );
  }

  const alerts = communications.filter((c): c is ChangeAlertComm => c.kind === "alert");
  const announcements = communications.filter((c): c is AnnouncementComm => c.kind === "announcement");
  const notes = communications.filter((c): c is NoteComm => c.kind === "note");
  const messages = communications.filter((c): c is MessageComm => c.kind === "message");

  return (
    <div className="space-y-7">
      {/* Co-branded band — the member's own org, above the calendar. Relevé's own
          mark stays in the top chrome; this personalizes, it doesn't replace. */}
      {brand && (
        <div className="border-b border-[var(--rc-hairline)] pb-5">
          <TeamBrandHeader brand={brand} />
        </div>
      )}

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="rc-serif text-3xl font-semibold text-[var(--rc-ink)]">{heading}</h1>
          <span className="rounded-full border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--rc-muted)]">
            {selfManaged ? "You" : "Family only"}
          </span>
        </div>
        <p className="rc-serif mt-1 text-lg italic text-[var(--rc-muted)]">{whoLabel}</p>
        {/* A self-managed member isn't gated by a family subscription, so the
            "Access · {reason}" badge (which would read "none") is not shown, and
            the team is already the heading. Guardians keep their access badge. */}
        {!selfManaged && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--rc-muted)]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--rc-gold-soft)] px-2.5 py-1 font-medium text-[var(--rc-ink)]">
              Family access · {access.reason}
            </span>
            {studioNames.length > 0 && <span>Affiliated studio: {studioLabel}</span>}
          </div>
        )}
      </header>

      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((c) => (
            <ChangeAlert key={c.id} comm={c} />
          ))}
        </div>
      )}

      {onWeekChange && (
        <WeekNav
          rangeLabel={data.week.label}
          timezone={data.week.timezone}
          offset={weekOffset}
          onPrev={() => onWeekChange(weekOffset - 1)}
          onNext={() => onWeekChange(weekOffset + 1)}
          onToday={() => onWeekChange(0)}
        />
      )}

      <WeekView
        week={data.week}
        events={events}
        emptyHint={
          selfManaged
            ? "A clear week — nothing scheduled yet."
            : "A clear week for your dancers — nothing scheduled yet."
        }
      />

      {(announcements.length > 0 || notes.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rc-ink)]">
            From {studioLabel}
          </h2>
          {announcements.map((c) => (
            <AnnouncementCard key={c.id} comm={c} />
          ))}
          {notes.map((c) => (
            <NoteChip key={c.id} comm={c} />
          ))}
        </section>
      )}

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
        </section>
      )}
    </div>
  );
}
