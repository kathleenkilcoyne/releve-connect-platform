// Route: /this-week
//
// The server component that FEEDS the calendar. Pass one rendered a hardcoded
// week; this now resolves the viewer from the authenticated session and reads
// their real week through RLS.
//
// ── Two modes, one screen ──
//   LIVE — EVERY signed-in visitor, no exceptions (founder direction,
//          2026-08-18: "Demo mode should only be explicit for a genuinely
//          signed-out visitor"). A professional with an empty week, or a
//          member with no profile and no family relationship yet, still gets
//          mode="live" — ThisWeekScreen renders its own quiet-week /
//          no-calendar-yet state for them. It must never fall through to
//          sample data pretending to be theirs.
//   DEMO — ONLY a visitor with no session at all. This used to also catch a
//          real signed-in member whose week/profile/family were all empty,
//          which is exactly the "hybrid" state the founder flagged after
//          seeing "Good evening, Kathleen" next to fake Jan 12–18 sample
//          events, "PREVIEW · WHOSE WEEK", and "Ava · Student". That
//          second fallback is gone — see below.
//
// Week navigation is a URL searchParam (`?week=-1`) rather than client state,
// because moving weeks now means a real query — the server has to refetch.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildLiveWeek } from "@/lib/this-week/live";
import { messageForDay, timeOfDayGreeting } from "@/lib/this-week/daily-message";
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

  // Which surface to open on. Set by the join redirect so a freshly-enrolled
  // family lands on their merged family week, not a multi-role member's
  // professional view. Optional; absent = the normal default.
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const initialView = rawView === "student" || rawView === "professional" ? rawView : undefined;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Log distinctly from a genuine sign-out (2026-08-18). Session refresh is
  // already handled correctly on every request by src/proxy.ts +
  // lib/supabase/middleware.ts, so this should be rare — but if it ever
  // fires, it must be diagnosable (this codebase's own [this-week] console
  // convention, not a raw unlabeled SDK dump) rather than silently falling
  // through to demo mode with no trace of what happened.
  if (userError) {
    console.error("[this-week] getUser failed — treating as signed out:", userError.message);
  }

  // The greeting is resolved on the SERVER: the daily line must not flicker or
  // change between the server render and hydration, and the track config is a
  // read the client has no business doing. `timeOfDay` (2026-08-18) is the same
  // discipline extended to the warm "Good afternoon, Kathleen" line that
  // replaced the old role/job-title header — it must agree with the zone the
  // rest of the page is anchored to, not the browser's local clock.
  const greeting = {
    message: messageForDay(),
    timeOfDay: timeOfDayGreeting(),
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

  // ── My Services, for the write path (2026-08-18) ──
  // This Week asks WHEN someone is available for the services they ALREADY
  // offer. So the picker in the add-entry form is fed from the source of truth
  // — `professional_offerings` — and never asks anyone to name a service twice.
  // Read as the caller, so RLS returns only their own. Empty for a guardian with
  // no talent profile, which correctly hides the whole control.
  let myServices: Array<{ id: string; title: string }> = [];
  const proViewer = payload.professional?.viewer;
  if (proViewer?.kind === "professional") {
    const { data } = await supabase
      .from("professional_offerings")
      .select("id, title")
      .eq("profile_id", proViewer.id)
      .eq("status", "active")
      .order("sort_order");
    myServices = (data ?? []) as Array<{ id: string; title: string }>;
  }

  // EVERY signed-in visitor gets mode="live" — never demo, regardless of an
  // empty week, no professional profile, or no family relationship (founder
  // direction, 2026-08-18: "never demo/sample data" for a real member).
  // ThisWeekScreen handles the two real-member "nothing here" cases itself:
  //   · a professional/family bundle with zero events this week → the
  //     "A quiet week." state already built into WeekView.
  //   · neither a professional profile nor a family relationship at all →
  //     the new no-calendar-yet state in ThisWeekScreen's render chain.
  return (
    <ThisWeekScreen
      mode="live"
      weekOffset={weekOffset}
      payload={payload}
      greeting={greeting}
      initialView={initialView}
      myServices={myServices}
    />
  );
}
