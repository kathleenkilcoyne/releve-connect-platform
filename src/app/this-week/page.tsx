// Route: /this-week
//
// The server component that FEEDS the calendar. Pass one rendered a hardcoded
// week; this now resolves the viewer from the authenticated session and reads
// their real week through RLS.
//
// ── Two modes, one screen ──
//   LIVE — a signed-in member with a calendar. Their own classes (as a teacher)
//          and their children's (as a guardian), served by two different RLS
//          policies from one login.
//   DEMO — nobody signed in, or a member whose calendar is still empty. Falls
//          back to the pass-one sample week, clearly labelled as a sample, so
//          the feature stays showable to a studio without pretending the data
//          is theirs.
//
// Week navigation is a URL searchParam (`?week=-1`) rather than client state,
// because moving weeks now means a real query — the server has to refetch.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildLiveWeek } from "@/lib/this-week/live";
import { messageForDay } from "@/lib/this-week/daily-message";
import { getCurrentTrack } from "@/lib/this-week/music";
import { ThisWeekScreen } from "@/components/this-week/ThisWeekScreen";
import "@/components/this-week/tokens.css";

export const metadata = {
  title: "This Week · Relevé Connect",
  description: "One calendar, every role — your week on Relevé Connect.",
};

// The week depends on who is asking and on today's date, so it can't be static.
export const dynamic = "force-dynamic";

/** Clamp the week offset so a hand-edited URL can't walk the expander forever. */
function parseWeekOffset(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(value)) return 0;
  return Math.max(-52, Math.min(52, value));
}

export default async function ThisWeekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const weekOffset = parseWeekOffset(params.week);

  // Which surface to open on, and which dancer. Set by the join redirect so a
  // freshly-enrolled family lands on their new dancer's week, not a multi-role
  // member's professional view. Both are optional; absent = the normal default.
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const initialView = rawView === "student" || rawView === "professional" ? rawView : undefined;
  const rawChild = Array.isArray(params.child) ? params.child[0] : params.child;
  const initialStudentId = rawChild?.trim() || undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The greeting is resolved on the SERVER: the daily line must not flicker or
  // change between the server render and hydration, and the track config is a
  // read the client has no business doing.
  const greeting = {
    message: messageForDay(),
    track: await getCurrentTrack(supabase),
  };

  // Signed out → the sample week (still gets the greeting; it costs nothing and
  // it's the warmest part of the page).
  if (!user) {
    return <ThisWeekScreen mode="demo" weekOffset={weekOffset} greeting={greeting} />;
  }

  const payload = await buildLiveWeek(
    supabase,
    createAdminClient(),
    user.id,
    weekOffset,
  );

  // Signed in but nothing scheduled and no children: show the sample rather than
  // an empty page, per the demo-mode decision. `isEmpty` is scoped to the week
  // being viewed, so paging into a quiet week correctly falls back too.
  if (payload.isEmpty && !payload.professional && payload.students.length === 0) {
    return <ThisWeekScreen mode="demo" weekOffset={weekOffset} greeting={greeting} />;
  }

  return (
    <ThisWeekScreen
      mode="live"
      weekOffset={weekOffset}
      payload={payload}
      greeting={greeting}
      initialView={initialView}
      initialStudentId={initialStudentId}
    />
  );
}
