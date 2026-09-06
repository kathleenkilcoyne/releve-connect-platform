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
import { resolveStudioForUser } from "@/lib/studio/access";
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

/**
 * The org this signed-in user administers (owner or staff admin), if any.
 *
 * Used ONLY on the empty-payload path below, to decide that a real
 * organisation must never be shown the fabricated sample week. Costs one
 * lookup, and only when the viewer has neither a professional nor a family
 * week, so the normal render path is unaffected.
 */
async function resolveOrgHome(
  userId: string,
): Promise<{ name: string; isTeam: boolean } | null> {
  const employerId = await resolveStudioForUser(userId);
  if (!employerId) return null;
  const { data } = await createAdminClient()
    .from("employer_profiles")
    .select("name, org_type")
    .eq("employer_id", employerId)
    .maybeSingle();
  const row = data as { name: string | null; org_type: string | null } | null;
  const isTeam = row?.org_type === "dance_team";
  return { name: row?.name?.trim() || (isTeam ? "Your team" : "Your studio"), isTeam };
}

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

  // Signed in, but this viewer has neither a professional week nor a family /
  // self week.
  //
  // A LIVE ORGANISATION must never land on the sample week here. A studio
  // owner or Team Director who is signed in and simply hasn't built anything
  // out yet must see a real (empty) state, not Kathleen's fabricated sample
  // week — showing invented people under their own login is misleading, not
  // a demo. They get a real empty state pointing at their dashboard instead.
  //
  // Everyone else who is signed in with nothing yet keeps the sample: that is
  // the case demo mode was written for, and it stays clearly labelled.
  if (payload.isEmpty && !payload.professional && !payload.family) {
    const orgHome = await resolveOrgHome(user.id);
    if (!orgHome) {
      return <ThisWeekScreen mode="demo" weekOffset={weekOffset} greeting={greeting} />;
    }
    return (
      <ThisWeekScreen
        mode="live"
        weekOffset={weekOffset}
        payload={payload}
        greeting={greeting}
        initialView={initialView}
        orgHome={orgHome}
      />
    );
  }

  return (
    <ThisWeekScreen
      mode="live"
      weekOffset={weekOffset}
      payload={payload}
      greeting={greeting}
      initialView={initialView}
    />
  );
}
