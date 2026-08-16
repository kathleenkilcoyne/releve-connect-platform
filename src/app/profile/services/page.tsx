// RELEVÉ · PROFESSIONAL SERVICES — the member's own workspace.
//
// Where a vetted professional lists OTHER services or businesses they run
// alongside their dance work. This is part of their professional identity, not
// advertising: nothing here is sponsored, ranked, or paid for, and Relevé takes
// no cut of anything they earn from it.
//
// The whole feature sits behind PROFESSIONAL_SERVICES_ENABLED: with the flag OFF
// this route redirects away, so nothing new is reachable in production.
//
// Gate (same product tier as the profile builder + Offerings): signed in with an
// ACTIVE Professional membership. Services hang off the professional's
// talent_profile, so a member who hasn't built their profile yet is guided there
// first.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasActiveProfileTier } from "@/lib/membership/access";
import { isProfessionalServicesEnabled, SERVICE_SELECT, type ServiceRow } from "@/lib/services";
import ServicesWorkspace from "./ServicesWorkspace";

export const dynamic = "force-dynamic";

export default async function ProfessionalServicesPage() {
  if (!isProfessionalServicesEnabled()) redirect("/profile");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/services");

  // Same gate as the profile builder (build spec §6 + §17).
  if (!(await hasActiveProfileTier(supabase, user.id))) {
    redirect("/subscribe?from=services");
  }

  // The professional's own profile (RLS: own row only).
  const { data: profile } = await supabase
    .from("talent_profiles")
    .select("profile_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const profileId = (profile as { profile_id: string } | null)?.profile_id ?? null;

  // Their services (RLS scopes to their own; the owner sees hidden ones too).
  let services: ServiceRow[] = [];
  if (profileId) {
    const { data } = await supabase
      .from("professional_services")
      .select(SERVICE_SELECT)
      .eq("profile_id", profileId)
      .order("sort_order", { ascending: true });
    services = (data as unknown as ServiceRow[] | null) ?? [];
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

      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Professional Services</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Do you offer another professional service or own a business you’d like the Relevé community
        to know about? Add it here and it will appear on your profile — another way you serve the
        dance community.
      </p>

      {profileId ? (
        <ServicesWorkspace initialServices={services} />
      ) : (
        <div className="mt-10 rounded-xl border border-neutral-200 bg-neutral-50 p-6">
          <p className="text-sm text-neutral-700">
            First, set up your Relevé profile — your services live on it.
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
