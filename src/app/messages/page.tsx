// /messages — the professional inbox. Slice 0 ships a GATED placeholder so the
// always-reachable "Messages" link resolves; Slice 2 builds the threaded,
// on-platform conversations here (with the adult-to-adult wall, unread state,
// block/report, and email notifications).
//
// Gate: signed in AND an actor (professional or studio) — the same identities the
// wall allows into the messaging graph. Non-actors are sent to the root.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProfessionalActor } from "@/lib/professional/actor";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/messages");

  const actor = await resolveProfessionalActor(createAdminClient(), user.id);
  if (!actor.isActor) redirect("/");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé · Messages
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Your messages</h1>
      <p className="mt-3 text-neutral-600">
        Professional conversations happen here, safely on Relevé — no personal contact exposed.
        Threaded messaging arrives in the next update.
      </p>
      <div className="mt-8 rounded-xl border border-dashed border-neutral-300 px-6 py-12 text-center text-neutral-500">
        You have no conversations yet.
      </div>
      <Link href="/profile" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to your professional home
      </Link>
    </main>
  );
}
