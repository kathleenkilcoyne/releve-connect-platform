// /profile — the authed professional HOME. Slice 0 ships a minimal, correctly
// GATED placeholder so the always-reachable "My Profile" link resolves today;
// Slice 1 ("My Professional Home") builds the full greeting + View/Edit/Share +
// Messages/Notifications counts + Profile Activity here.
//
// Gate: signed in AND a professional (talent_profiles). A non-professional (a
// family guardian, a studio-only owner) is sent to the site root rather than a
// members-only dead end — the pilot surfaces are untouched.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProfessionalActor } from "@/lib/professional/actor";

export const dynamic = "force-dynamic";

export default async function ProfileHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const actor = await resolveProfessionalActor(createAdminClient(), user.id);
  if (!actor.isProfessional) redirect("/");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé · Your professional home
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Welcome back</h1>
      <p className="mt-3 text-neutral-600">
        This is your professional home. The full view — your verified status, public profile, and
        activity — arrives in the next update. For now, everything you need is one tap away:
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {actor.publicSlug && (
          <Link
            href={`/${actor.publicSlug}`}
            className="rounded-xl border border-neutral-200 px-5 py-4 hover:border-neutral-400"
          >
            <span className="block font-medium text-neutral-900">View my public profile</span>
            <span className="mt-0.5 block text-sm text-neutral-500">How the world sees you</span>
          </Link>
        )}
        <Link
          href="/profile/edit"
          className="rounded-xl border border-neutral-200 px-5 py-4 hover:border-neutral-400"
        >
          <span className="block font-medium text-neutral-900">Edit profile</span>
          <span className="mt-0.5 block text-sm text-neutral-500">Keep your details current</span>
        </Link>
        <Link
          href="/messages"
          className="rounded-xl border border-neutral-200 px-5 py-4 hover:border-neutral-400"
        >
          <span className="block font-medium text-neutral-900">Messages</span>
          <span className="mt-0.5 block text-sm text-neutral-500">Your on-platform conversations</span>
        </Link>
        <Link
          href="/notifications"
          className="rounded-xl border border-neutral-200 px-5 py-4 hover:border-neutral-400"
        >
          <span className="block font-medium text-neutral-900">Notifications</span>
          <span className="mt-0.5 block text-sm text-neutral-500">Views, saves, and inquiries</span>
        </Link>
      </div>

      <Link href="/" className="mt-12 inline-block text-sm text-neutral-400 underline">
        together we rise · relevé
      </Link>
    </main>
  );
}
