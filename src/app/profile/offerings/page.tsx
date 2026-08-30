// RELEVÉ · MY WORK — the professional's Offerings workspace (Slice 2).
//
// This is the builder/management surface only; the PUBLIC render on /[handle] is
// Slice 3. The whole feature sits behind PROFESSIONAL_OFFERINGS_ENABLED: with the
// flag OFF (production) this route redirects away, so nothing new is reachable.
//
// Gate (same product tier as the profile builder): signed in + an ACTIVE
// Professional membership. Offerings hang off the professional's talent_profile,
// so a member who hasn't built their profile yet is guided to do that first.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasActiveProfileTier } from "@/lib/membership/access";
import { isProfessionalOfferingsEnabled, type OfferingRow } from "@/lib/offerings";
import OfferingsWorkspace from "./OfferingsWorkspace";

export const dynamic = "force-dynamic";

const OFFERING_SELECT =
  "id, type, title, short_description, long_description, image_url, pricing_type, " +
  "price_display, location_mode, location_note, external_url, cta_type, " +
  "signature_work_id, status, sort_order";

export default async function OfferingsWorkspacePage() {
  // Feature flag — OFF in production hides the whole surface.
  if (!isProfessionalOfferingsEnabled()) redirect("/profile");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/offerings");

  // Same gate as the profile builder (build spec §6 + §17).
  if (!(await hasActiveProfileTier(supabase, user.id))) {
    redirect("/subscribe?from=offerings");
  }

  // The professional's own profile (RLS: own row only).
  const { data: profile } = await supabase
    .from("talent_profiles")
    .select("profile_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileId = (profile as { profile_id: string } | null)?.profile_id ?? null;

  // Their offerings (RLS scopes to their own; owner sees drafts + hidden too).
  let offerings: OfferingRow[] = [];
  if (profileId) {
    const { data } = await supabase
      .from("professional_offerings")
      .select(OFFERING_SELECT)
      .eq("profile_id", profileId)
      .order("sort_order", { ascending: true });
    offerings = (data as unknown as OfferingRow[] | null) ?? [];
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · My work
        </p>
        <Link href="/profile" className="text-sm text-neutral-500 underline">
          ← My home
        </Link>
      </div>

      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">My Offerings</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Your Relevé profile is more than a résumé. It’s a place to show what you do, what you
        create, and what you’re ready to offer.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-neutral-500">
        Your roles (Teacher, Choreographer, Adjudicator…) say who you are. This is a separate,
        additional step — where you say what you&apos;re available to be hired for: guest
        teaching, private coaching, adjudication, licensed work, a master class, a product. Each
        one becomes its own card on your public profile.
      </p>

      {profileId ? (
        <OfferingsWorkspace initialOfferings={offerings} />
      ) : (
        <div className="mt-10 rounded-xl border border-neutral-200 bg-neutral-50 p-6">
          <p className="text-sm text-neutral-700">
            First, set up your Relevé profile — your offerings live on it.
          </p>
          <Link
            href="/profile/edit"
            className="mt-4 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
          >
            Build my profile
          </Link>
        </div>
      )}
    </main>
  );
}
