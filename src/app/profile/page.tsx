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
import { isProfessionalOfferingsEnabled } from "@/lib/offerings";
import { isProfessionalServicesEnabled } from "@/lib/services";
import { isGeneralMarketplaceEnabled } from "@/lib/marketplace/flags";
import { hasMarketplaceSellerAccess } from "@/lib/membership/access";

export const dynamic = "force-dynamic";

export default async function ProfileHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const actor = await resolveProfessionalActor(createAdminClient(), user.id);
  if (!actor.isProfessional) redirect("/");

  // Is their profile still the draft activation created?
  const { data: statusRow } = await createAdminClient()
    .from("talent_profiles")
    .select("profile_status")
    .eq("user_id", user.id)
    .maybeSingle();
  const isDraft = (statusRow as { profile_status?: string } | null)?.profile_status !== "published";

  // Marketplace seller doorway — only computed when the flag is ON, so with the
  // flag OFF (production) this page issues no extra reads and is byte-for-byte
  // unchanged. Shown to seller-enabled members, plus admins for preview.
  const marketplaceEnabled = isGeneralMarketplaceEnabled();
  let canSellMarketplace = false;
  if (marketplaceEnabled) {
    const admin = createAdminClient();
    const [{ data: roleRow }, isSeller] = await Promise.all([
      admin.from("users").select("account_type").eq("user_id", user.id).maybeSingle(),
      hasMarketplaceSellerAccess(admin, user.id),
    ]);
    const isAdmin = (roleRow as { account_type?: string } | null)?.account_type === "admin";
    canSellMarketplace = isSeller || isAdmin;
  }

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

      {/* A draft profile is the newly-activated state: Relevé created it and
          seeded it, and the member has not published yet. Point them at the
          review screen rather than leaving them to find it. */}
      {isDraft && (
        <Link
          href="/profile/review"
          className="mt-8 block rounded-xl border border-[#e3d9c3] bg-[#f6f1e7] px-5 py-4 hover:border-[#c9b990]"
        >
          <span className="block font-medium text-neutral-900">
            Review and publish your profile →
          </span>
          <span className="mt-0.5 block text-sm text-[#6f6656]">
            Your profile is a private draft. Nobody can see it until you publish it.
          </span>
        </Link>
      )}

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
        {/* Professional Offerings doorway — behind PROFESSIONAL_OFFERINGS_ENABLED,
            so it's invisible in production until the feature is turned on. */}
        {isProfessionalOfferingsEnabled() && (
          <Link
            href="/profile/offerings"
            className="rounded-xl border border-neutral-200 px-5 py-4 hover:border-neutral-400"
          >
            <span className="block font-medium text-neutral-900">My Services</span>
            <span className="mt-0.5 block text-sm text-neutral-500">
              Showcase the skills, services, creative work, experiences, and products you offer.
            </span>
          </Link>
        )}
        {/* Professional Services doorway — behind PROFESSIONAL_SERVICES_ENABLED,
            so it's invisible in production until the feature is turned on. */}
        {isProfessionalServicesEnabled() && (
          <Link
            href="/profile/services"
            className="rounded-xl border border-neutral-200 px-5 py-4 hover:border-neutral-400"
          >
            <span className="block font-medium text-neutral-900">Professional Services</span>
            <span className="mt-0.5 block text-sm text-neutral-500">
              Another service or business you run — massage, Pilates, photography, accompanists /
              class musicians.
            </span>
          </Link>
        )}
        {/* Marketplace Seller Workspace doorway — behind GENERAL_MARKETPLACE_ENABLED
            AND seller/admin entitlement, so it's invisible in production. */}
        {marketplaceEnabled && canSellMarketplace && (
          <Link
            href="/profile/marketplace"
            className="rounded-xl border border-neutral-200 px-5 py-4 hover:border-neutral-400"
          >
            <span className="block font-medium text-neutral-900">Marketplace</span>
            <span className="mt-0.5 block text-sm text-neutral-500">
              Your seller workspace — license your original choreography.
            </span>
          </Link>
        )}
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
