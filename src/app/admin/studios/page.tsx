// Admin — Founding Studios: invite, review, approve, publish.
//
// Mirrors /admin/applications: a service-role read of every studio + its
// invitation, gated on a signed-in admin. All writes go through the gated
// /api/admin/studio-invites and /api/admin/studios/[id] routes.
//
// The profile's `status` is the source of truth for publication; the invite row
// supplies the invited email + redemption state.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/admin-page-auth";
import StudiosConsole from "./StudiosConsole";

export const dynamic = "force-dynamic";

export type StudioRow = {
  employer_id: string;
  email: string;
  name: string | null;
  org_type: string | null;
  status: string; // invited | in_progress | submitted | approved | live
  city: string | null;
  state_province: string | null;
  public_slug: string | null;
  redeemed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  pilot_status: string | null;
  pilot_note: string | null;
};

export default async function AdminStudiosPage() {
  await requireAdminPage("/admin/studios");

  const db = createAdminClient();

  const { data: inviteData } = await db
    .from("founding_studio_invites")
    .select("invite_id, email, employer_id, redeemed_at, created_at")
    .order("created_at", { ascending: false });
  const invites = (inviteData ?? []) as Array<{
    email: string;
    employer_id: string;
    redeemed_at: string | null;
    created_at: string;
  }>;

  const employerIds = invites.map((i) => i.employer_id);
  const profileByEmployer = new Map<
    string,
    {
      name: string | null;
      org_type: string | null;
      status: string;
      city: string | null;
      state_province: string | null;
      public_slug: string | null;
      submitted_at: string | null;
      pilot_status: string | null;
      pilot_note: string | null;
    }
  >();
  if (employerIds.length) {
    const { data: profData } = await db
      .from("employer_profiles")
      .select(
        "employer_id, name, org_type, status, city, state_province, public_slug, submitted_at, pilot_status, pilot_note",
      )
      .in("employer_id", employerIds);
    for (const p of (profData ?? []) as Array<{
      employer_id: string;
      name: string | null;
      org_type: string | null;
      status: string;
      city: string | null;
      state_province: string | null;
      public_slug: string | null;
      submitted_at: string | null;
      pilot_status: string | null;
      pilot_note: string | null;
    }>) {
      profileByEmployer.set(p.employer_id, p);
    }
  }

  const studios: StudioRow[] = invites.map((i) => {
    const p = profileByEmployer.get(i.employer_id);
    return {
      employer_id: i.employer_id,
      email: i.email,
      name: p?.name ?? null,
      org_type: p?.org_type ?? null,
      status: p?.status ?? "invited",
      city: p?.city ?? null,
      state_province: p?.state_province ?? null,
      public_slug: p?.public_slug ?? null,
      redeemed_at: i.redeemed_at,
      submitted_at: p?.submitted_at ?? null,
      created_at: i.created_at,
      pilot_status: p?.pilot_status ?? null,
      pilot_note: p?.pilot_note ?? null,
    };
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Relevé · Admin</p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Founding Studios</h1>
      <p className="mt-3 text-neutral-600">
        Invite a studio by email, then review what they submit. <span className="font-medium">Approve</span>{" "}
        accepts the content; <span className="font-medium">Publish</span> is the only step that makes a
        studio public. Nothing goes live on its own.
      </p>

      <nav aria-label="Admin" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-neutral-200 pt-4 text-sm">
        <Link href="/admin/applications" className="text-neutral-700 underline">
          Applications
        </Link>
        <Link href="/studios" className="text-neutral-700 underline">
          Studios (public page)
        </Link>
        <Link href="/" className="text-neutral-500 underline">
          ← Back to Relevé
        </Link>
      </nav>

      <StudiosConsole studios={studios} />
    </main>
  );
}
