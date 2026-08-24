// Admin — Private Invitations (bypasses the public application, no public
// distinction).
//
// Structurally separate from /admin/founding-professionals: reads
// private_invitations, never founding_professional_grants. A private
// invitation confers a complimentary Professional membership (permanent or
// 12-month, admin-selected per person) and the Verified Member mark — and
// NEVER a founder_distinction badge. Not Founding Professional, not
// Founding 25.
//
// Reads via the service role (the ledger is admin-only); all writes go through
// the gated /api/admin/private-invitations routes.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminPage } from "@/lib/admin-page-auth";
import { INVITED_PROFESSIONAL_COMP_SOURCES } from "@/lib/invited-professional/invited-professional";
import PrivateInvitationsConsole from "./PrivateInvitationsConsole";

export const dynamic = "force-dynamic";

export type InvitationRow = {
  id: string;
  email: string;
  entitlement_kind: "permanent" | "comp_12mo";
  note: string | null;
  granted_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
  user_id: string | null;
  // Enriched (not stored on the invitation):
  membership_status: string | null; // the live billing state, if claimed
  membership_source: string | null;
  renewal_date: string | null;
};

export default async function PrivateInvitationsPage() {
  await requireAdminPage("/admin/private-invitations");

  const db = createAdminClient();

  const { data: grantData } = await db
    .from("private_invitations")
    .select("id, email, entitlement_kind, note, granted_at, claimed_at, revoked_at, user_id")
    .order("granted_at", { ascending: false });

  const grants = (grantData ?? []) as unknown as Array<Omit<
    InvitationRow,
    "membership_status" | "membership_source" | "renewal_date"
  >>;

  // Enrich claimed invitations with their live complimentary-membership state
  // (billing), scoped to THIS pathway's own membership sources only.
  const userIds = grants.map((g) => g.user_id).filter((v): v is string => Boolean(v));
  const membershipByUser = new Map<string, { status: string; source: string | null; renewal_date: string | null }>();
  if (userIds.length > 0) {
    const { data: memData } = await db
      .from("memberships")
      .select("user_id, membership_status, source, renewal_date")
      .in("user_id", userIds)
      .in("source", INVITED_PROFESSIONAL_COMP_SOURCES as unknown as string[]);
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

  const rows: InvitationRow[] = grants.map((g) => {
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
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Private Invitations</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Invite someone straight past the public application — they build the same full Professional
        profile everyone does, and receive the <span className="font-medium">Verified Member</span>{" "}
        mark. This is <span className="font-medium">not</span> Founding Professional and{" "}
        <span className="font-medium">not</span> Founding 25 — no public founder distinction is ever
        conferred here. Their complimentary billing (permanent or 12&#8209;month) can be changed at
        any time.
      </p>

      <nav
        aria-label="Admin"
        className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-neutral-200 pt-4 text-sm"
      >
        <Link href="/admin/applications" className="text-neutral-700 underline">
          Applications
        </Link>
        <Link href="/admin/founding-professionals" className="text-neutral-700 underline">
          Founding Professionals
        </Link>
        <Link href="/" className="text-neutral-500 underline">
          ← Back to Relevé
        </Link>
      </nav>

      <PrivateInvitationsConsole grants={rows} />
    </main>
  );
}
