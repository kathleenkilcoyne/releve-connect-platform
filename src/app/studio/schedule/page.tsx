// /studio/schedule — the STUDIO's own place to run its comp calendar
// (Smart Calendar, Slice 1). Studio owner/staff only, gated by resolveStudioForUser
// (NOT admin). It shows the studio's roster (the dancers who joined via its family
// code) and the schedule editor (reused from the admin assist view), scoped to the
// caller's own studio — a different studio's owner resolves to their OWN studio,
// never this one, and a family/guardian administers no studio, so they can't reach
// the editor at all.
//
// Service-role reads/writes are scoped to the resolved employer_id (the caller's
// verified own studio), the same pattern the admin editor and /studio/setup use;
// RLS is not weakened for anyone else.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudioForUser } from "@/lib/studio/access";
import { loadStudioScheduleData } from "@/lib/studio/schedule-data";
import ScheduleEditor from "@/app/admin/studios/[id]/ScheduleEditor";
import StudioRoster from "./StudioRoster";
import TeamJoinCode, { type TeamCode } from "./TeamJoinCode";
import { memberLabelOf } from "@/lib/studio/team-types";

export const dynamic = "force-dynamic";

/** A form-less notice (used when the signed-in user administers no studio). */
function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-lg flex-1 px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect · For Studios
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{title}</h1>
      <div className="mt-4 text-neutral-600">{children}</div>
      <Link href="/" className="mt-8 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}

export default async function StudioSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/studio/schedule")}`);

  const employerId = await resolveStudioForUser(user.id);
  if (!employerId) {
    return (
      <Notice title="This is your studio's schedule">
        <p>
          Only a studio&apos;s own owner or staff can manage its schedule. If you run a Founding
          Studio and expected to land here, make sure you&apos;re signed in with the email your
          studio was set up under.
        </p>
      </Notice>
    );
  }

  const db = createAdminClient();

  const { data: prof } = await db
    .from("employer_profiles")
    .select("name, org_type, team_type, member_label")
    .eq("employer_id", employerId)
    .maybeSingle();
  const p = prof as
    | { name: string | null; org_type: string | null; team_type: string | null; member_label: string | null }
    | null;
  const isTeam = p?.org_type === "dance_team";
  const orgName = p?.name?.trim() || (isTeam ? "Your team" : "Your studio");
  const memberLabel = memberLabelOf(p?.member_label);

  const { scheduleEntries, teacherOptions, roster, groups } = await loadStudioScheduleData(
    db,
    employerId,
  );

  // A college team's coach-facing team join code (separate from family codes).
  let teamCode: TeamCode | null = null;
  if (isTeam) {
    const { data: tc } = await db
      .from("studio_invites")
      .select("code, use_count")
      .eq("employer_id", employerId)
      .eq("kind", "team")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = tc as { code: string; use_count: number } | null;
    teamCode = row ? { code: row.code, use_count: row.use_count } : null;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          {isTeam ? "Relevé · Dance team schedule" : "Relevé · Studio schedule"}
        </p>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-neutral-500 underline" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">{orgName}</h1>
      <p className="mt-3 text-neutral-600">
        {isTeam
          ? "Build your college team's week in one place, and Relevé shares each schedule item with the dancers who need it."
          : "Build your studio's week in one place, and Relevé shares each schedule item with the families who need it."}
      </p>

      <nav aria-label={isTeam ? "Team" : "Studio"} className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-neutral-200 py-3 text-sm">
        <Link href="/studio/setup" className="text-neutral-700 underline">
          {isTeam ? "Team profile" : "Studio profile"}
        </Link>
        <Link href="/this-week" className="text-neutral-700 underline">
          This Week
        </Link>
      </nav>

      {/* ── Roster (dancers + groups) ── */}
      <StudioRoster groups={groups} roster={roster} isTeam={isTeam} memberLabel={memberLabel} />

      {/* ── Team join code (dance teams only) ── */}
      {isTeam && <TeamJoinCode code={teamCode} memberLabel={memberLabel} />}

      {/* ── Schedule ── */}
      <section className="mt-10 border-t border-neutral-200 pt-6">
        <h2 className="text-lg font-semibold text-neutral-900">Schedule</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Add rehearsals, private lessons, competitions, meetings, and other important dates. Choose
          the dancers or groups involved, and the event appears in each{" "}
          {isTeam ? "dancer" : "family"}&apos;s <span className="italic">This Week</span>.
        </p>
        <ScheduleEditor
          endpointBase="/api/studio/schedule/classes"
          classes={scheduleEntries}
          teachers={teacherOptions}
          roster={roster}
          groups={groups}
        />
      </section>

      <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
