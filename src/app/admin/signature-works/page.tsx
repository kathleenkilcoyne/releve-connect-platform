// Admin/test console for Signature Experiences. Lets the founder create a (test)
// artist, create a $499 signature_work, and publish/unpublish it — so the whole
// Stripe flow can be exercised without hand-writing SQL.
//
// Reads run server-side via the admin client. All WRITES go through the gated
// /api/admin/* routes (ADMIN_TOKEN required) — see AdminConsole.

import { createAdminClient } from "@/lib/supabase/admin";
import AdminConsole from "./AdminConsole";

export const dynamic = "force-dynamic";

export type ArtistRow = {
  profile_id: string;
  display_name: string | null;
  payouts_enabled: boolean;
  stripe_account_id: string | null;
};

export type WorkRow = {
  id: string;
  title: string;
  status: string;
  price_cents: number;
  profile_id: string;
  artist_name: string | null;
};

export default async function AdminSignatureWorksPage() {
  const db = createAdminClient();

  const { data: artistData } = await db
    .from("talent_profiles")
    .select("profile_id, display_name, payouts_enabled, stripe_account_id")
    .order("created_at", { ascending: true });

  const { data: workData } = await db
    .from("signature_works")
    .select("id, title, status, price_cents, profile_id, talent_profiles!inner(display_name)")
    .order("created_at", { ascending: false });

  const artists = (artistData ?? []) as unknown as ArtistRow[];

  const works: WorkRow[] = ((workData ?? []) as unknown as Array<{
    id: string;
    title: string;
    status: string;
    price_cents: number;
    profile_id: string;
    talent_profiles: { display_name: string | null } | { display_name: string | null }[];
  }>).map((w) => {
    const artist = Array.isArray(w.talent_profiles) ? w.talent_profiles[0] : w.talent_profiles;
    return {
      id: w.id,
      title: w.title,
      status: w.status,
      price_cents: w.price_cents,
      profile_id: w.profile_id,
      artist_name: artist?.display_name ?? null,
    };
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé · Admin
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Signature Experiences</h1>
      <p className="mt-3 text-neutral-600">
        Create a work, publish it, then open its page to run a test purchase. Writes need your
        <code className="mx-1 rounded bg-neutral-100 px-1">ADMIN_TOKEN</code> (from
        <code className="mx-1 rounded bg-neutral-100 px-1">.env.local</code>).
      </p>

      <AdminConsole artists={artists} works={works} />
    </main>
  );
}
