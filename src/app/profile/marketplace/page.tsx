// SELLER WORKSPACE — shell only (Phase 3 scaffolding).
//
// The future home where a seller-enabled professional will submit works, manage a
// catalog, see listing status + sales/license history, and manage payouts. Phase 3
// ships the STRUCTURE only: static sections marked "coming." There are NO server
// actions, NO listing creation, NO checkout, NO payouts wiring — nothing that
// mutates or charges. The economics engine and real workflow are Phase 4.
//
// GATES (defense in depth):
//   1. GENERAL_MARKETPLACE_ENABLED off  → redirect to /profile (invisible in prod).
//   2. not signed in                    → /login.
//   3. not a seller-enabled member AND not an admin → redirect to /profile.
// Admins are admitted for preview (mirrors the /subscribe admin-door), since the
// founder holds a `professional` membership, not `professional_full`.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGeneralMarketplaceEnabled } from "@/lib/marketplace/flags";
import { hasMarketplaceSellerAccess } from "@/lib/membership/access";

export const dynamic = "force-dynamic";

const SECTIONS: { title: string; blurb: string }[] = [
  {
    title: "Catalog",
    blurb: "Your original choreography, organized as a body of work.",
  },
  {
    title: "Listings",
    blurb: "Submit work for review, then track its status: draft → submitted → approved → listed.",
  },
  {
    title: "Sales & Licenses",
    blurb: "Your License-of-Record history — who licensed what, when, and on which terms.",
  },
  {
    title: "Payouts",
    blurb: "You set your price. Payout details and Marketplace terms will appear here when selling opens.",
  },
];

export default async function SellerWorkspacePage() {
  // Gate 1 — feature flag. Off in production → nothing here is reachable.
  if (!isGeneralMarketplaceEnabled()) redirect("/profile");

  // Gate 2 — must be signed in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/marketplace");

  // Gate 3 — seller-enabled member OR admin (admin = preview access).
  const db = createAdminClient();
  const [{ data: roleRow }, isSeller] = await Promise.all([
    db.from("users").select("account_type").eq("user_id", user.id).maybeSingle(),
    hasMarketplaceSellerAccess(db, user.id),
  ]);
  const isAdmin = (roleRow as { account_type?: string } | null)?.account_type === "admin";
  if (!isSeller && !isAdmin) redirect("/profile");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · Marketplace
        </p>
        <Link href="/profile" className="text-sm text-neutral-500 underline">
          ← My home
        </Link>
      </div>

      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Seller Workspace</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        This is where your Marketplace presence will live — your catalog, your listings, your
        licensing history, and your payouts. We&apos;re building it now.
      </p>

      <div className="mt-6 rounded-xl border border-[#e3d9c3] bg-[#f6f1e7] px-5 py-3 text-sm text-[#6f6656]">
        Preview — the Marketplace isn&apos;t open for business yet. Nothing here buys, sells, lists, or
        pays out; it&apos;s a look at the structure to come.
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <div
            key={s.title}
            className="rounded-xl border border-neutral-200 px-5 py-4"
            aria-disabled="true"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-900">{s.title}</span>
              <span className="text-xs uppercase tracking-[0.15em] text-neutral-400">Coming</span>
            </div>
            <span className="mt-1 block text-sm text-neutral-500">{s.blurb}</span>
          </div>
        ))}
      </div>

      <Link href="/" className="mt-12 inline-block text-sm text-neutral-400 underline">
        together we rise · relevé
      </Link>
    </main>
  );
}
