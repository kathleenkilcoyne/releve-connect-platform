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
import { reconcileTeamEnrollments } from "@/lib/studio/team-enrollments";
import ScheduleEditor, { type ScheduleRow, type TeacherOption } from "@/app/admin/studios/[id]/ScheduleEditor";

export const dynamic = "force-dynamic";

const STUDENT_BAND = "text-xs text-neutral-500";

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

  // Keep the team roster enrolled in the studio's active entries (idempotent), so
  // a family that joined after an entry was made is picked up on this view.
  const roster = await reconcileTeamEnrollments(db, employerId);

  // Schedule entries for this studio.
  const { data: classData } = await db
    .from("studio_classes")
    .select(
      "class_id, title, kind, recurrence, default_start, default_end, series_start, series_end, room, location, teacher_profile_id",
    )
    .eq("employer_id", employerId)
    .order("created_at", { ascending: true });
  const scheduleRows = (classData ?? []) as Omit<ScheduleRow, "teacher_name">[];

  // Roster: the dancers who joined via this studio's family code (affiliations),
  // shown studio-safe (display name + age bracket only — never date of birth).
  const { data: affRows } = await db
    .from("affiliations")
    .select("subject_id")
    .eq("employer_id", employerId)
    .eq("subject_kind", "student")
    .eq("status", "active");
  const rosterStudentIds = [
    ...new Set(((affRows ?? []) as { subject_id: string }[]).map((r) => r.subject_id)),
  ];
  const rosterStudents = rosterStudentIds.length
    ? (
        (
          await db
            .from("students")
            .select("student_id, display_name, age_range")
            .in("student_id", rosterStudentIds)
        ).data ?? []
      ).map((s) => s as { student_id: string; display_name: string; age_range: string | null })
    : [];
  rosterStudents.sort((a, b) => a.display_name.localeCompare(b.display_name));

  // Teacher options + names (talent affiliated to this studio as teacher/staff,
  // plus anyone already assigned to an entry).
  const { data: teacherAff } = await db
    .from("affiliations")
    .select("subject_id")
    .eq("employer_id", employerId)
    .eq("subject_kind", "talent")
    .in("role", ["teacher", "staff"])
    .eq("status", "active");
  const teacherIds = new Set<string>([
    ...((teacherAff ?? []) as { subject_id: string }[]).map((r) => r.subject_id),
    ...(scheduleRows.map((r) => r.teacher_profile_id).filter(Boolean) as string[]),
  ]);
  const teacherNameById = new Map<string, string>();
  if (teacherIds.size) {
    const { data: tp } = await db
      .from("talent_profiles")
      .select("profile_id, display_name")
      .in("profile_id", [...teacherIds]);
    for (const t of (tp ?? []) as { profile_id: string; display_name: string | null }[]) {
      teacherNameById.set(t.profile_id, t.display_name ?? "Teacher");
    }
  }
  const scheduleEntries: ScheduleRow[] = scheduleRows.map((r) => ({
    ...r,
    teacher_name: r.teacher_profile_id ? teacherNameById.get(r.teacher_profile_id) ?? null : null,
  }));
  const teacherOptions: TeacherOption[] = [...teacherNameById.entries()].map(
    ([profile_id, display_name]) => ({ profile_id, display_name }),
  );

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
        Enter each event once and it appears in the right families&apos; <span className="italic">This
        Week</span> automatically. Change it once and every affected family sees the change.
      </p>

      <nav aria-label="Studio" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-neutral-200 py-3 text-sm">
        <Link href="/studio/setup" className="text-neutral-700 underline">
          Studio profile
        </Link>
        <Link href="/this-week" className="text-neutral-700 underline">
          This Week
        </Link>
      </nav>

      {/* ── Roster ── */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-neutral-900">Your dancers</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Everyone who joined with your family code ({rosterStudents.length}{" "}
          {rosterStudents.length === 1 ? "dancer" : "dancers"}).
        </p>
        {rosterStudents.length === 0 ? (
          <p className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
            No dancers yet. Share your family join code (on your admin studio page) with your
            competition families — each one who joins shows up here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {rosterStudents.map((s) => (
              <li key={s.student_id} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-medium text-neutral-900">{s.display_name}</span>
                {s.age_range && <span className={STUDENT_BAND}>Age {s.age_range}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Schedule ── */}
      <section className="mt-10 border-t border-neutral-200 pt-6">
        <h2 className="text-lg font-semibold text-neutral-900">Schedule</h2>
        <ScheduleEditor
          endpointBase="/api/studio/schedule/classes"
          classes={scheduleEntries}
          teachers={teacherOptions}
          roster={{ students: roster.students, classes: roster.classes }}
        />
      </section>

      <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
