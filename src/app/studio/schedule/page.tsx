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
    .select("name")
    .eq("employer_id", employerId)
    .maybeSingle();
  const studioName = (prof as { name: string | null } | null)?.name?.trim() || "Your studio";

  const { scheduleEntries, teacherOptions, roster, groups } = await loadStudioScheduleData(
    db,
    employerId,
  );

  // The "Your dancers" list adds the studio-safe age bracket (never DOB); the
  // schedule picker uses the name-only roster.
  const rosterIds = roster.map((r) => r.student_id);
  const ageById = new Map<string, string | null>();
  if (rosterIds.length) {
    const { data: ages } = await db
      .from("students")
      .select("student_id, age_range")
      .in("student_id", rosterIds);
    for (const s of (ages ?? []) as { student_id: string; age_range: string | null }[]) {
      ageById.set(s.student_id, s.age_range);
    }
  }
  const rosterStudents = roster.map((r) => ({
    student_id: r.student_id,
    display_name: r.display_name,
    age_range: ageById.get(r.student_id) ?? null,
  }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · Studio schedule
        </p>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-neutral-500 underline" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">{studioName}</h1>
      <p className="mt-3 text-neutral-600">
        Build your studio&apos;s week in one place, and Relevé shares each schedule item with the
        families who need it.
      </p>

      <nav aria-label="Studio" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-neutral-200 py-3 text-sm">
        <Link href="/studio/setup" className="text-neutral-700 underline">
          Studio profile
        </Link>
        <Link href="/this-week" className="text-neutral-700 underline">
          This Week
        </Link>
      </nav>

      {/* ── Studio roster (groups + individual dancers) ── */}
      <StudioRoster groups={groups} roster={rosterStudents} />

      {/* ── Schedule ── */}
      <section className="mt-10 border-t border-neutral-200 pt-6">
        <h2 className="text-lg font-semibold text-neutral-900">Schedule</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Add rehearsals, private lessons, competitions, meetings, and other important dates. Choose
          the dancers or groups involved, and the event appears in each family&apos;s{" "}
          <span className="italic">This Week</span>.
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
