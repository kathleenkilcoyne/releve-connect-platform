// Admin — Relevé-controlled trust signals on professional PROFILES.
//
// The counterpart to /admin/applications. That console reviews people BEFORE they
// are members and writes to `applications`; this one manages the standing of
// people who already have a profile, and writes to `talent_profiles`.
//
// It exists because conferring an honorific used to do nothing for anyone who
// already had a profile: the value was copied from the application at profile
// creation and never read again (founder decision A). It is also the only place
// Founding 25 can be awarded — never inferred from the application's fee-waiver
// flag (founder decision B).
//
// Reads run server-side via the service role (profiles + their audit history);
// all WRITES go through the gated /api/admin/profiles/[profileId]/trust route.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/admin-page-auth";
import TrustConsole, { type ProfileRow, type TrustEvent } from "./TrustConsole";

export const dynamic = "force-dynamic";

export default async function AdminProfilesPage() {
  await requireAdminPage("/admin/profiles");

  const db = createAdminClient();

  const { data: profileData } = await db
    .from("talent_profiles")
    .select(
      "profile_id, display_name, public_slug, primary_role, city, state_province, " +
        "profile_status, visibility, verification_flag, honorifics, founder_distinction, " +
        "choreographer_tier, prefilled_from_application_id, created_at",
    )
    .order("created_at", { ascending: false });

  const profiles = (profileData ?? []) as unknown as ProfileRow[];

  // The audit history. Best-effort: profile_trust_events may not be migrated yet,
  // in which case the console simply shows no history rather than failing.
  let events: TrustEvent[] = [];
  try {
    const { data } = await db
      .from("profile_trust_events")
      .select("event_id, profile_id, field, previous_value, new_value, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    events = (data ?? []) as unknown as TrustEvent[];
  } catch {
    events = [];
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · Admin
        </p>
        <div className="flex items-center gap-4">
          <Link href="/admin/applications" className="text-sm text-neutral-500 underline">
            Applications
          </Link>
          <Link href="/admin/founding-professionals" className="text-sm text-neutral-500 underline">
            Founding Professionals
          </Link>
        </div>
      </div>

      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Trust signals</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Honorifics, founding distinctions, and choreographer tiers are conferred by Relevé — they
        are never purchased and never self-entered. Members cannot edit anything on this page.
        Every change is recorded with your name and your stated reason.
      </p>

      <div className="mt-6 rounded-xl border border-[#e3d9c3] bg-[#f6f1e7] px-5 py-4 text-sm text-[#6f6656]">
        <p>
          <span className="font-medium">Founding 25 is conferred here, deliberately.</span> It is
          never inferred from an application&apos;s fee waiver — the $30 waiver and the distinction
          are different things, and this badge is permanent provenance.
        </p>
        <p className="mt-2">
          The <span className="font-medium">✓ Verified Member</span> mark is not editable here. It
          is granted automatically at activation, and a lapsed membership never removes it — Relevé
          vetted the person, and that stays true.
        </p>
      </div>

      <p className="mt-6 text-sm text-neutral-500">
        {profiles.length} {profiles.length === 1 ? "profile" : "profiles"}
      </p>

      <TrustConsole profiles={profiles} events={events} />

      <Link href="/" className="mt-12 inline-block text-sm text-neutral-400 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
