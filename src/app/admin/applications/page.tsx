// Admin — the vetting queue (build spec §4). Reads every application via the
// service role (bypasses RLS). All actions go through the gated
// /api/admin/applications/[id] route (signed-in admin required). Mirrors the Signature-Works
// admin console pattern.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/admin-page-auth";
import { isProfessionalServicesEnabled, type ServiceRow } from "@/lib/services";
import { toAdminService, type AdminService } from "@/lib/services/admin";
import ApplicationsConsole from "./ApplicationsConsole";

export const dynamic = "force-dynamic";

export type FeeStatus = "pending" | "paid" | "refunded" | "credited" | "forfeited" | "waived" | null;

// The admin projection (and the rule about what a reviewer may see) lives in
// @/lib/services/admin so it can be unit-tested. Re-exported here because
// ApplicationsConsole imports its types from this module.
export type { AdminService };

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
  /** Any Professional Services on this person's profile (empty when none). */
  services: AdminService[];
};

export default async function AdminApplicationsPage() {
  // This page renders real applicants' PII. Gate BEFORE any query runs.
  await requireAdminPage("/admin/applications");

  const db = createAdminClient();

  const { data: appData } = await db
    .from("applications")
    .select(
      "application_id, user_id, email, first_name, last_name, roles, primary_role, city, state_province, " +
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

  // Professional Services this person listed on their profile, keyed by user.
  // Only queried when the flag is on, so with it OFF this console issues no
  // extra reads and renders exactly as before.
  const servicesByUser = new Map<string, AdminService[]>();
  if (isProfessionalServicesEnabled()) {
    const userIds = [
      ...new Set(
        ((appData ?? []) as unknown as Array<{ user_id: string | null }>)
          .map((a) => a.user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (userIds.length > 0) {
      const { data: profileRows } = await db
        .from("talent_profiles")
        .select("profile_id, user_id")
        .in("user_id", userIds);
      const userByProfile = new Map(
        ((profileRows ?? []) as Array<{ profile_id: string; user_id: string }>).map((p) => [
          p.profile_id,
          p.user_id,
        ]),
      );
      if (userByProfile.size > 0) {
        const { data: serviceRows } = await db
          .from("professional_services")
          .select(
            "id, profile_id, category, category_other_label, business_name, short_description, " +
              "location, service_type, website_url, social_url, business_email, " +
              "business_phone, status, moderation_status, sort_order",
          )
          .in("profile_id", [...userByProfile.keys()])
          .order("sort_order", { ascending: true });

        type Row = ServiceRow & { profile_id: string };
        for (const s of (serviceRows ?? []) as unknown as Row[]) {
          const uid = userByProfile.get(s.profile_id);
          if (!uid) continue;
          const list = servicesByUser.get(uid) ?? [];
          // Allowlist projection — see toAdminService. Never a spread of the row.
          list.push(toAdminService(s));
          servicesByUser.set(uid, list);
        }
      }
    }
  }

  const applications: ApplicationRow[] = (
    (appData ?? []) as unknown as Array<ApplicationRow & { user_id: string | null }>
  ).map((a) => ({
    ...a,
    fee_status: feeByApp.get(a.application_id) ?? null,
    services: (a.user_id && servicesByUser.get(a.user_id)) || [],
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Relevé · Admin</p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Applications — the vetting queue</h1>
      <p className="mt-3 text-neutral-600">
        A real person reads every application. Approve, approve a choreographer at a marketplace tier,
        confer honorifics, ask for more, or decline. During the founding period, approving also
        grants a <span className="font-medium">complimentary membership</span> and sends the
        welcome email.
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
