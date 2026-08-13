// Admin — the licensing review queue. Reads submitted / in-review works via the
// service role (bypasses RLS), joined to the artist's name + handle. Actions run
// through the gated server action (signed-in admin required). Mirrors the
// applications console pattern.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/admin-page-auth";
import type { WorkStatus } from "@/lib/professional/licensing";
import LicensingQueue from "./LicensingQueue";

export const dynamic = "force-dynamic";

export interface QueueWork {
  work_id: string;
  artistName: string;
  artistSlug: string | null;
  title: string;
  work_type: string | null;
  style: string | null;
  cast_size: string | null;
  duration: string | null;
  level_audience: string | null;
  year_created: number | null;
  description: string | null;
  preview_video_url: string | null;
  origin: string | null;
  license_type: string | null;
  status: WorkStatus;
  review_notes: string | null;
  submitted_at: string | null;
  created_at: string;
}

type Joined = { display_name: string | null; public_slug: string | null };

export default async function AdminLicensingPage() {
  await requireAdminPage("/admin/licensing");

  const db = createAdminClient();
  const { data } = await db
    .from("works")
    .select(
      "work_id, title, work_type, style, cast_size, duration, level_audience, " +
        "year_created, description, preview_video_url, origin, license_type, status, " +
        "review_notes, submitted_at, created_at, talent_profiles(display_name, public_slug)",
    )
    .in("status", ["submitted", "in_review"])
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const works: QueueWork[] = (
    (data ?? []) as unknown as Array<
      Omit<QueueWork, "artistName" | "artistSlug"> & {
        talent_profiles: Joined | Joined[] | null;
      }
    >
  ).map((r) => {
    const tp = Array.isArray(r.talent_profiles) ? r.talent_profiles[0] : r.talent_profiles;
    return {
      work_id: r.work_id,
      artistName: tp?.display_name ?? "Unknown artist",
      artistSlug: tp?.public_slug ?? null,
      title: r.title,
      work_type: r.work_type,
      style: r.style,
      cast_size: r.cast_size,
      duration: r.duration,
      level_audience: r.level_audience,
      year_created: r.year_created,
      description: r.description,
      preview_video_url: r.preview_video_url,
      origin: r.origin,
      license_type: r.license_type,
      status: r.status,
      review_notes: r.review_notes,
      submitted_at: r.submitted_at,
      created_at: r.created_at,
    };
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Relevé · Admin</p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Licensing — review queue</h1>
      <p className="mt-3 text-neutral-600">
        A real person reviews every work before it can appear publicly. Approve a work to make it
        visible on the artist&apos;s profile, return it with a note for changes, or decline it.
        Only <span className="font-medium">approved</span> works are ever public.
      </p>

      <nav
        aria-label="Admin"
        className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-neutral-200 pt-4 text-sm"
      >
        <Link href="/admin/applications" className="text-neutral-700 underline">
          Applications
        </Link>
        <Link href="/roster" className="text-neutral-700 underline">
          The Roster
        </Link>
        <Link href="/" className="text-neutral-500 underline">
          ← Back to Relevé
        </Link>
      </nav>

      <LicensingQueue works={works} />
    </main>
  );
}
