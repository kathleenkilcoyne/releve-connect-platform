// Dance team — the first-run "Let's get your team ready" welcome + checklist
// on /studio/schedule. This builds NOTHING new: every step is a pointer at a
// panel that already exists on this same page (or at /this-week), and every
// checkmark is read straight off data the page already loaded — no new
// queries, no new tables, no invite-tracking infrastructure.
//
// A plain anchor (<a href="#id">) is enough for "scroll to the existing
// control" — no client JS needed, so this stays a server component like the
// rest of the page.
//
// "Invite your dancers" is checked off once a dancer has actually JOINED
// (roster connection === "connected"), not once the coach has clicked Send —
// there is deliberately no per-invitation tracking (see PR #18), so this is
// the only honest, DB-backed signal available without inventing one.
// "View This Week" has no independent signal (no page-view tracking exists or
// should exist for this) — it's derived from the same signal as "add your
// first event," since that's the real prerequisite for This Week to show
// anything.

import Link from "next/link";

type ChecklistItem = {
  key: string;
  label: string;
  doneLabel: string;
  pendingHint: string;
  done: boolean;
  actionLabel: string;
  href: string;
  /** Keep showing the action even once done — for a step whose button is a
   *  navigation link rather than a one-time setup action (only "View This
   *  Week": it shares its `done` signal with "add your first event", so once
   *  that flips true the link must NOT disappear — that's the moment it
   *  actually becomes useful to click). */
  alwaysShowAction?: boolean;
};

export default function DanceTeamSetupChecklist({
  orgName,
  memberLabel,
  hasGroup,
  hasCode,
  hasJoinedDancer,
  hasScheduleEntry,
}: {
  orgName: string;
  memberLabel: string;
  hasGroup: boolean;
  hasCode: boolean;
  hasJoinedDancer: boolean;
  hasScheduleEntry: boolean;
}) {
  const membersLower = memberLabel.toLowerCase();

  const items: ChecklistItem[] = [
    {
      key: "group",
      label: "Create your first group",
      doneLabel: "First group created",
      pendingHint: `Group your ${membersLower} (like "Varsity" or "Freshman") so you can schedule events for everyone in it with one tap.`,
      done: hasGroup,
      actionLabel: "Create a group",
      href: "#team-groups",
    },
    {
      key: "code",
      label: "Generate your team join link",
      doneLabel: "Team join link generated",
      pendingHint: "Mint the link your dancers use to set up their own account and join your team.",
      done: hasCode,
      actionLabel: "Get your join link",
      href: "#team-join-code",
    },
    {
      key: "invite",
      label: `Invite your ${membersLower}`,
      doneLabel: `${memberLabel} have started joining`,
      pendingHint: `Send the join link straight to your ${membersLower}' email addresses — this checks off once they join.`,
      done: hasJoinedDancer,
      actionLabel: "Invite by email",
      href: "#team-invite-email",
    },
    {
      key: "event",
      label: "Add your first rehearsal or event",
      doneLabel: "First event added",
      pendingHint: "Build a rehearsal (recurring, weekly) or a one-time event like a competition.",
      done: hasScheduleEntry,
      actionLabel: "Add an event",
      href: "#team-schedule",
    },
    {
      key: "thisweek",
      label: "View This Week",
      doneLabel: "Your team's week is ready to view",
      pendingHint: "Once you've added something, see exactly what your team will see.",
      done: hasScheduleEntry,
      actionLabel: "View This Week",
      href: "/this-week",
      alwaysShowAction: true,
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  if (allDone) {
    return (
      <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-neutral-800">
        <span className="font-medium">✓ Your team is set up.</span> Groups, a join link, invited{" "}
        {membersLower}, and a scheduled event are all in place — keep building your week below.
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border-l-4 border-amber-400 bg-amber-50 p-5">
      <h2 className="text-lg font-semibold text-neutral-900">Welcome to {orgName}</h2>
      <p className="mt-1 text-sm text-neutral-700">
        Let&apos;s get your team ready. {doneCount} of {items.length} steps done.
      </p>

      <ol className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item.key}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
              item.done ? "border-green-200 bg-green-50" : "border-neutral-200 bg-white"
            }`}
          >
            <div className="min-w-0">
              <p className={`text-sm font-medium ${item.done ? "text-green-800" : "text-neutral-900"}`}>
                {item.done ? "✓ " : ""}
                {item.done ? item.doneLabel : item.label}
              </p>
              {!item.done && <p className="mt-0.5 text-xs text-neutral-500">{item.pendingHint}</p>}
            </div>
            {(!item.done || item.alwaysShowAction) &&
              (item.href.startsWith("#") ? (
                <a
                  href={item.href}
                  className="shrink-0 rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                >
                  {item.actionLabel}
                </a>
              ) : (
                <Link
                  href={item.href}
                  className="shrink-0 rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
                >
                  {item.actionLabel}
                </Link>
              ))}
          </li>
        ))}
      </ol>
    </section>
  );
}
