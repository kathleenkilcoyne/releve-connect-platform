// Admin — the vetting queue (build spec §4). Reads every application via the
// service role (bypasses RLS). All actions go through the gated
// /api/admin/applications/[id] route (signed-in admin required). Mirrors the Signature-Works
// admin console pattern.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/admin-page-auth";
import ApplicationsConsole from "./ApplicationsConsole";

export const dynamic = "force-dynamic";

export type ApplicationRow = {
  application_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  roles: string[] | null;
  primary_role: string | null;
  city: string | null;
  state_province: string | null;
  state: string; // lifecycle: draft|submitted|in-review|approved|more-info|declined
  approved_tier: string | null;
  honorifics: string[] | null;
  is_founding_25: boolean;
  submitted_at: string | null;
  created_at: string;
  answers: Record<string, unknown> | null;
};

export default async function AdminApplicationsPage() {
  // This page renders real applicants' PII. Gate BEFORE any query runs.
  await requireAdminPage("/admin/applications");

  const db = createAdminClient();

  const { data: appData } = await db
    .from("applications")
    .select(
      "application_id, email, first_name, last_name, roles, primary_role, city, state_province, " +
        "state, approved_tier, honorifics, is_founding_25, submitted_at, created_at, answers",
    )
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  // Payment is NOT part of vetting (2026-08-12): the application is free, and the
  // $30 lives in the post-approval profile-activation flow. So no fee status is
  // loaded or shown here. The payment plumbing itself is preserved elsewhere.
  const applications: ApplicationRow[] = (appData ?? []) as unknown as ApplicationRow[];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Relevé · Admin</p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Professional Roster Review</h1>
      <p className="mt-3 text-neutral-600">
        Review applications for the Relevé Professional Roster. Approve, request additional
        information, or decline. Approved professionals can build and publish their Relevé
        Professional Profile.
      </p>

      {/* Way OUT of the console (2026-07-23). Signing in as an admin now lands
          here, which is right for reviewing — but this page had no links at all,
          so an admin who wanted her own profile was stuck in the queue with
          nowhere to go. Every page needs a door on both sides. */}
      <nav aria-label="Admin" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-neutral-200 pt-4 text-sm">
        <Link href="/profile/edit" className="text-neutral-700 underline">
          Build your profile
        </Link>
        <Link href="/roster" className="text-neutral-700 underline">
          The Roster
        </Link>
        <Link href="/admin/studios" className="text-neutral-700 underline">
          Founding Studios
        </Link>
        <Link href="/" className="text-neutral-500 underline">
          ← Back to Relevé
        </Link>
      </nav>

      <ApplicationsConsole applications={applications} />
    </main>
  );
}
