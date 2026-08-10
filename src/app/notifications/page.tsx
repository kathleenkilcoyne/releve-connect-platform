// /notifications — the professional activity/notifications center. Slice 0 ships a
// GATED placeholder so the always-reachable "Notifications" link resolves; Slice 3
// builds the unified center (views · saves · inquiries · opportunities) with
// per-channel preferences.
//
// Gate: signed in AND an actor (professional or studio). Non-actors go to root.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProfessionalActor } from "@/lib/professional/actor";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notifications");

  const actor = await resolveProfessionalActor(createAdminClient(), user.id);
  if (!actor.isActor) redirect("/");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé · Notifications
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Your activity</h1>
      <p className="mt-3 text-neutral-600">
        Profile views, saves from studios, and inquiries will show up here. The notifications center
        arrives in a later update.
      </p>
      <div className="mt-8 rounded-xl border border-dashed border-neutral-300 px-6 py-12 text-center text-neutral-500">
        Nothing new yet — we&apos;ll let you know when something happens.
      </div>
      <Link href="/profile" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to your professional home
      </Link>
    </main>
  );
}
