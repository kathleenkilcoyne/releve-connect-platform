// Admin — read-only review of ONE studio's submission, then Approve / Publish.
//
// The admin reads the full submitted profile here BEFORE deciding — no approving
// blind from the list. Everything is display-only (no editable inputs). The
// decision controls (ReviewActions) and a plain "Back to studios" link let the
// admin act OR leave without acting.
//
// Service-role read (the profile isn't public until live, and it may be unowned/
// mid-review), gated on a signed-in admin.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/admin-page-auth";
import ReviewActions from "./ReviewActions";
import FamilyJoinCode, { type FamilyCode } from "./FamilyJoinCode";
import ScheduleEditor, { type ScheduleRow, type TeacherOption } from "./ScheduleEditor";
import { reconcileTeamEnrollments } from "@/lib/studio/team-enrollments";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  in_progress: "In progress",
  submitted: "Submitted",
  approved: "Approved",
  live: "Live",
};

type ProfileRow = {
  employer_id: string;
  name: string | null;
  artistic_director: string[] | null;
  culture_note: string | null;
  unique_note: string | null;
  mission: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  year_founded: number | null;
  student_count_band: string | null;
  staff_count: number | null;
  room_count: number | null;
  accessible_by_train: boolean | null;
  accessible_by_bus: boolean | null;
  car_required: boolean | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  promo_video_url: string | null;
  bio: string | null;
  status: string;
  submitted_at: string | null;
};

const STUDENT_BAND_LABEL: Record<string, string> = {
  under_50: "Under 50",
  "50_99": "50–99",
  "100_199": "100–199",
  "200_plus": "200+",
};

/** Best-effort absolute URL from a stored handle-or-URL, for a given platform. */
function toUrl(kind: "website" | "instagram" | "tiktok" | "facebook" | "video", raw: string): string {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  switch (kind) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "facebook":
      return `https://facebook.com/${handle}`;
    default:
      return `https://${v}`;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-100 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-neutral-900">{children}</dd>
    </div>
  );
}

/** Render a value or the em dash for anything empty. */
function val(v: string | number | null | undefined): React.ReactNode {
  if (v === null || v === undefined) return <span className="text-neutral-400">—</span>;
  const s = String(v).trim();
  return s === "" ? <span className="text-neutral-400">—</span> : s;
}

function LinkField({
  label,
  raw,
  kind,
}: {
  label: string;
  raw: string | null;
  kind: "website" | "instagram" | "tiktok" | "facebook" | "video";
}) {
  return (
    <Field label={label}>
      {raw && raw.trim() ? (
        <a
          href={toUrl(kind, raw)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-700 underline break-all"
        >
          {raw.trim()}
        </a>
      ) : (
        <span className="text-neutral-400">—</span>
      )}
    </Field>
  );
}

function boolWord(b: boolean | null): string {
  return b ? "Yes" : "No";
}

export default async function StudioReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminPage(`/admin/studios/${id}`);

  const db = createAdminClient();

  const { data: profRow } = await db
    .from("employer_profiles")
    .select(
      "employer_id, name, artistic_director, culture_note, unique_note, mission, address_line1, " +
        "address_line2, city, state_province, postal_code, country, year_founded, student_count_band, " +
        "staff_count, room_count, accessible_by_train, accessible_by_bus, car_required, website, " +
        "instagram, tiktok, facebook, promo_video_url, bio, status, submitted_at",
    )
    .eq("employer_id", id)
    .maybeSingle();
  const p = profRow as ProfileRow | null;
  if (!p) notFound();

  // The invited owner's email + the vocab joins (styles / concentration / certs).
  const [{ data: inviteRow }, styleRes, concRes, certRes] = await Promise.all([
    db.from("founding_studio_invites").select("email").eq("employer_id", id).maybeSingle(),
    db.from("employer_styles").select("styles(label)").eq("employer_id", id),
    db.from("employer_concentrations").select("studio_concentrations(label)").eq("employer_id", id),
    db.from("employer_certifications").select("certifications(label)").eq("employer_id", id),
  ]);
  const ownerEmail = (inviteRow as { email?: string } | null)?.email ?? null;
  const labelsOf = (rows: unknown, key: string): string[] =>
    ((rows as Array<Record<string, { label: string } | { label: string }[]>>) ?? [])
      .map((r) => {
        const v = r[key];
        return Array.isArray(v) ? v[0]?.label : v?.label;
      })
      .filter(Boolean) as string[];
  const styles = labelsOf(styleRes.data, "styles");
  const concentrations = labelsOf(concRes.data, "studio_concentrations");
  const certs = labelsOf(certRes.data, "certifications");

  // Active FAMILY join code(s) for this studio (Brick B1). Reads the EXISTING
  // family `studio_invites` table; the code is minted/replaced via the gated
  // /family-code route and validated as-is by /join.
  const { data: familyCodeRows } = await db
    .from("studio_invites")
    .select("code, use_count, max_uses, expires_at, created_at")
    .eq("employer_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  const familyCodes = (familyCodeRows ?? []) as FamilyCode[];

  // ── Schedule (Brick B2) ────────────────────────────────────────────────────
  // First reconcile the team roster (idempotent): every dancer affiliated to
  // this studio gets enrolled in its active entries, so a family that joined
  // AFTER the schedule was built is picked up now, on this admin page view.
  const roster = await reconcileTeamEnrollments(db, id);

  const { data: classData } = await db
    .from("studio_classes")
    .select(
      "class_id, title, kind, recurrence, default_start, default_end, series_start, series_end, room, location, teacher_profile_id",
    )
    .eq("employer_id", id)
    .order("created_at", { ascending: true });
  const scheduleRows = (classData ?? []) as Omit<ScheduleRow, "teacher_name">[];

  // Teacher options + names: talent affiliated to this studio as teacher/staff,
  // plus anyone already assigned to an entry (so an edit dropdown shows them).
  const { data: teacherAff } = await db
    .from("affiliations")
    .select("subject_id")
    .eq("employer_id", id)
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

  const address = [p.address_line1, p.address_line2, [p.city, p.state_province, p.postal_code].filter(Boolean).join(", "), p.country]
    .filter((line) => line && String(line).trim())
    .join("\n");
  const accessibleBy = [
    p.accessible_by_train ? "Train" : null,
    p.accessible_by_bus ? "Bus" : null,
    p.car_required ? "Car / parking" : null,
  ].filter(Boolean);

  const submitted = p.submitted_at
    ? new Date(p.submitted_at).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin/studios" className="text-sm text-neutral-500 underline">
        ← Back to studios
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · Studio review
        </p>
        <span className="inline-block rounded-full bg-neutral-100 px-3 py-0.5 text-xs font-medium text-neutral-700">
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
      </div>

      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
        {p.name?.trim() || <span className="text-neutral-400">— (unnamed)</span>}
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        Read the full submission below, then decide. Nothing is public until you publish.
      </p>

      {/* ── The submission, read-only ── */}
      <dl className="mt-8">
        <Field label="Owner email">{val(ownerEmail)}</Field>
        <Field label="Studio name">{val(p.name)}</Field>
        <Field label="Artistic Director">
          {p.artistic_director && p.artistic_director.length ? p.artistic_director.join(", ") : val(null)}
        </Field>
        <Field label="What is special about teaching at your school?">{val(p.culture_note)}</Field>
        <Field label="What makes your studio unique?">{val(p.unique_note)}</Field>
        <Field label="Your studio in one line (tagline)">{val(p.mission)}</Field>

        <Field label="Address">{address ? address : val(null)}</Field>
        <Field label="Year founded">{val(p.year_founded)}</Field>

        <Field label="Student-count band">
          {p.student_count_band ? STUDENT_BAND_LABEL[p.student_count_band] ?? p.student_count_band : val(null)}
        </Field>
        <Field label="Staff (teachers)">{val(p.staff_count)}</Field>
        <Field label="Studios / rooms">{val(p.room_count)}</Field>

        <Field label="Accessible by">
          {accessibleBy.length ? accessibleBy.join(" · ") : val(null)}
          <span className="ml-3 text-xs text-neutral-400">
            (Train: {boolWord(p.accessible_by_train)} · Bus: {boolWord(p.accessible_by_bus)} · Car:{" "}
            {boolWord(p.car_required)})
          </span>
        </Field>

        <Field label="Styles offered">{styles.length ? styles.join(", ") : val(null)}</Field>
        <Field label="Concentration / focus">{concentrations.length ? concentrations.join(", ") : val(null)}</Field>
        <Field label="Certifications valued">{certs.length ? certs.join(", ") : val(null)}</Field>

        <LinkField label="Website" raw={p.website} kind="website" />
        <LinkField label="Instagram" raw={p.instagram} kind="instagram" />
        <LinkField label="TikTok" raw={p.tiktok} kind="tiktok" />
        <LinkField label="Facebook" raw={p.facebook} kind="facebook" />
        <LinkField label="Promotional video" raw={p.promo_video_url} kind="video" />

        <Field label="Anything else about the studio">{val(p.bio)}</Field>
        <Field label="Submitted">{submitted ? submitted : val(null)}</Field>
      </dl>

      {/* ── Decision ── */}
      <div className="mt-10 border-t border-neutral-200 pt-6">
        <h2 className="text-lg font-semibold text-neutral-900">Decision</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Approve accepts the content; Publish is the separate step that makes the studio public.
          You can also just go back without deciding.
        </p>
        <div className="mt-4">
          <ReviewActions employerId={p.employer_id} status={p.status} />
        </div>
      </div>

      {/* ── Family join code (Brick B1 · concierge) ── */}
      <div className="mt-10 border-t border-neutral-200 pt-6">
        <h2 className="text-lg font-semibold text-neutral-900">Family join code</h2>
        <FamilyJoinCode employerId={p.employer_id} codes={familyCodes} />
      </div>

      {/* ── Schedule (Brick B2 · concierge) ── */}
      <div className="mt-10 border-t border-neutral-200 pt-6">
        <h2 className="text-lg font-semibold text-neutral-900">Schedule</h2>
        <ScheduleEditor
          endpointBase={`/api/admin/studios/${p.employer_id}/classes`}
          classes={scheduleEntries}
          teachers={teacherOptions}
          roster={{ students: roster.students, classes: roster.classes }}
        />
      </div>

      <Link href="/admin/studios" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to studios
      </Link>
    </main>
  );
}
