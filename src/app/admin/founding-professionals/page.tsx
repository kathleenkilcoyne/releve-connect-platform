// Admin — Founding Professionals (the invited founding cohort).
//
// Confer Founding Professional status on an invited person (by email), choose
// their complimentary billing flavor PER PERSON, correct that flavor later, or
// revoke a mistake — all with an audit trail. The cohort is OPEN-ENDED: add
// people here whenever you choose; nothing about the count or the names lives in
// code. Identity (Founding Professional + Verified) is separate from billing
// (permanent vs 12-month complimentary), so changing one never disturbs the other.
//
// Reads via the service role (the ledger is admin-only); all writes go through the
// gated /api/admin/founding-professionals routes.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/admin-page-auth";
import { FOUNDER_COMP_SOURCES } from "@/lib/founding/founding-professional";
import FoundingProfessionalsConsole from "./FoundingProfessionalsConsole";

export const dynamic = "force-dynamic";

export type GrantRow = {
  id: string;
  email: string;
  entitlement_kind: "permanent" | "comp_12mo";
  note: string | null;
  granted_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
  user_id: string | null;
  // Enriched (not stored on the grant):
  membership_status: string | null; // the live billing state, if claimed
  membership_source: string | null;
  renewal_date: string | null;
};

export default async function FoundingProfessionalsPage() {
  await requireAdminPage("/admin/founding-professionals");

  const db = createAdminClient();

  const { data: grantData } = await db
    .from("founding_professional_grants")
    .select("id, email, entitlement_kind, note, granted_at, claimed_at, revoked_at, user_id")
    .order("granted_at", { ascending: false });

  const grants = (grantData ?? []) as unknown as Array<Omit<
    GrantRow,
    "membership_status" | "membership_source" | "renewal_date"
  >>;

  // Enrich claimed grants with their live complimentary-membership state (billing),
  // so the console can show whether the entitlement is active/permanent/timed.
  const userIds = grants.map((g) => g.user_id).filter((v): v is string => Boolean(v));
  const membershipByUser = new Map<string, { status: string; source: string | null; renewal_date: string | null }>();
  if (userIds.length > 0) {
    const { data: memData } = await db
      .from("memberships")
      .select("user_id, membership_status, source, renewal_date")
      .in("user_id", userIds)
      .in("source", FOUNDER_COMP_SOURCES as unknown as string[]);
    for (const m of (memData ?? []) as Array<{
      user_id: string;
      membership_status: string;
      source: string | null;
      renewal_date: string | null;
    }>) {
      if (!membershipByUser.has(m.user_id)) {
        membershipByUser.set(m.user_id, {
          status: m.membership_status,
          source: m.source,
          renewal_date: m.renewal_date,
        });
      }
    }
  }

  const rows: GrantRow[] = grants.map((g) => {
    const m = g.user_id ? membershipByUser.get(g.user_id) : undefined;
    return {
      ...g,
      membership_status: m?.status ?? null,
      membership_source: m?.source ?? null,
      renewal_date: m?.renewal_date ?? null,
    };
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Relevé · Admin</p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Founding Professionals</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Personally invited founders you&apos;ve already selected — they don&apos;t apply. Confer
        Founding Professional status here and they build the same full Professional profile everyone
        does. Their <span className="font-medium">identity</span> as a Founding Professional is
        permanent; their <span className="font-medium">complimentary billing</span> (permanent or
        12&#8209;month) is separate and can be changed without touching that identity.
      </p>

      <nav
        aria-label="Admin"
        className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-neutral-200 pt-4 text-sm"
      >
        <Link href="/admin/applications" className="text-neutral-700 underline">
          Applications
        </Link>
        <Link href="/admin/studios" className="text-neutral-700 underline">
          Founding Studios
        </Link>
        <Link href="/" className="text-neutral-500 underline">
          ← Back to Relevé
        </Link>
      </nav>

      <FoundingProfessionalsConsole grants={rows} />
    </main>
  );
}
