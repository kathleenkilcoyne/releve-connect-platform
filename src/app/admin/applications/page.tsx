// Admin — the vetting queue (build spec §4). Reads every application via the
// service role (bypasses RLS). All actions go through the gated
// /api/admin/applications/[id] route (ADMIN_TOKEN). Mirrors the Signature-Works
// admin console pattern.

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/admin-page-auth";
import ApplicationsConsole from "./ApplicationsConsole";

export const dynamic = "force-dynamic";

export type FeeStatus = "pending" | "paid" | "refunded" | "credited" | "forfeited" | "waived" | null;

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
  fee_status: FeeStatus;
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

  const { data: feeData } = await db
    .from("application_fee_payments")
    .select("application_id, status, created_at")
    .order("created_at", { ascending: false });

  // Latest fee status per application.
  const feeByApp = new Map<string, FeeStatus>();
  for (const f of (feeData ?? []) as Array<{ application_id: string; status: FeeStatus }>) {
    if (!feeByApp.has(f.application_id)) feeByApp.set(f.application_id, f.status);
  }

  const applications: ApplicationRow[] = ((appData ?? []) as unknown as ApplicationRow[]).map((a) => ({
    ...a,
    fee_status: feeByApp.get(a.application_id) ?? null,
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Relevé · Admin</p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Applications — the vetting queue</h1>
      <p className="mt-3 text-neutral-600">
        A real person reads every application. Approve, approve a choreographer at a marketplace tier,
        confer honorifics, ask for more, or decline. During the founding period, approving also
        grants a <span className="font-medium">complimentary membership</span> and sends the
        welcome email. Actions need your{" "}
        <code className="mx-1 rounded bg-neutral-100 px-1">ADMIN_TOKEN</code>.
      </p>

      <ApplicationsConsole applications={applications} />
    </main>
  );
}
