// Artist payouts page (Flow A). Minimal for now: an artist lands here with their
// profile id and connects their Express account so their works become buyable.
//
// The ?profile=<id> is explicit while there's no login yet; once Supabase Auth
// is wired this page will read the signed-in artist's own profile instead.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import ConnectButton from "./ConnectButton";

export const dynamic = "force-dynamic";

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string; status?: string; error?: string }>;
}) {
  const { profile: profileId, status, error } = await searchParams;

  if (!profileId) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Connect payouts</h1>
        <p className="mt-3 text-neutral-600">
          Open this page with your profile, e.g. <code>/connect/payouts?profile=YOUR_ID</code>.
        </p>
      </main>
    );
  }

  const db = createAdminClient();
  const { data: profile } = await db
    .from("talent_profiles")
    .select("display_name, payouts_enabled, stripe_account_id")
    .eq("profile_id", profileId)
    .maybeSingle();

  const ready = Boolean(profile?.payouts_enabled) || status === "ready";

  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé · Payouts
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
        {profile?.display_name ? `${profile.display_name}, connect payouts` : "Connect payouts"}
      </h1>
      <p className="mt-4 text-neutral-600">
        Relevé pays you 80% of every Signature Experience directly through Stripe. You
        enter your own bank and tax details on Stripe — Relevé never sees them, and Stripe
        issues your 1099-K.
      </p>

      {ready ? (
        <div className="mt-10 rounded-xl bg-green-50 px-6 py-5 text-green-800">
          ✓ Payouts are connected. Your published works can now be sold.
        </div>
      ) : (
        <div className="mt-10">
          <ConnectButton profileId={profileId} />
          {status === "pending" && (
            <p className="mt-4 text-sm text-amber-700">
              Stripe is still finishing your account — this can take a moment. Refresh shortly.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-6 text-sm text-red-600">Error: {error}</p>}

      <Link href="/" className="mt-12 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
