// Your profile editor. Server-side, this page:
//   1. checks you're signed in (if not → send you to /login),
//   2. loads the pick-lists (styles/levels/focus/roles),
//   3. loads your existing profile (if any) so the form is pre-filled,
// then hands it all to the interactive form component.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasActiveProfileTier } from "@/lib/membership/access";
import ProfileEditor from "./ProfileEditor";

export const dynamic = "force-dynamic";

type Option = { slug: string; label: string };

// The shape we read back from talent_profiles. The Supabase client here is
// untyped, so we cast the loaded row to this once (below) instead of many times.
type ProfileFields = {
  profile_id: string;
  display_name: string | null;
  public_slug: string | null;
  primary_role: string | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  bio: string | null;
  years_experience: string | null;
  credentials: string | null;
  age_range: string | null;
  headshot_url: string | null;
  teaching_reel_url: string | null;
  gallery_urls: string[] | null;
  resume_url: string | null;
  social_links: Record<string, string> | null;
  profile_status: string | null;
};

export default async function ProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // GATE (build spec §6 + §17): the profile builder is the Professional tier's
  // product. Only members with an ACTIVE Professional / Professional·Full
  // membership may build or edit a profile. Everyone else is sent to /subscribe
  // (approved applicants activate there; the page itself explains the ladder).
  if (!(await hasActiveProfileTier(supabase, user.id))) {
    redirect("/subscribe?from=profile");
  }

  // Pick-lists (world-readable).
  const [stylesRes, levelsRes, focusRes, rolesRes, certsRes] = await Promise.all([
    supabase.from("styles").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("levels").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("focus_areas").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("role_types").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("certifications").select("slug, label").eq("is_active", true).order("sort_order"),
  ]);

  const styleOptions = (stylesRes.data ?? []) as Option[];
  const levelOptions = (levelsRes.data ?? []) as Option[];
  const focusOptions = (focusRes.data ?? []) as Option[];
  const roleOptions = (rolesRes.data ?? []) as Option[];
  const certOptions = (certsRes.data ?? []) as Option[];

  // My existing profile (own-row only via RLS).
  const { data: profile } = await supabase
    .from("talent_profiles")
    .select(
      "profile_id, display_name, public_slug, primary_role, city, state_province, country, " +
        "bio, years_experience, credentials, age_range, headshot_url, teaching_reel_url, " +
        "gallery_urls, resume_url, social_links, profile_status",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // The untyped client returns a loose type; cast once to a known shape.
  const p = profile as unknown as ProfileFields | null;

  // Which tags are currently selected.
  let selectedStyles: string[] = [];
  let selectedLevels: string[] = [];
  let selectedFocus: string[] = [];
  let selectedCerts: string[] = [];
  if (p) {
    const pid = p.profile_id;
    const [ps, pl, pf, pc] = await Promise.all([
      supabase.from("profile_styles").select("styles(slug)").eq("profile_id", pid),
      supabase.from("profile_levels").select("levels(slug)").eq("profile_id", pid),
      supabase.from("profile_focus_areas").select("focus_areas(slug)").eq("profile_id", pid),
      supabase.from("profile_certifications").select("certifications(slug)").eq("profile_id", pid),
    ]);
    const slugsOf = (rows: unknown, key: string): string[] =>
      ((rows as Array<Record<string, { slug: string } | { slug: string }[]>>) ?? [])
        .map((r) => {
          const v = r[key];
          return Array.isArray(v) ? v[0]?.slug : v?.slug;
        })
        .filter(Boolean) as string[];
    selectedStyles = slugsOf(ps.data, "styles");
    selectedLevels = slugsOf(pl.data, "levels");
    selectedFocus = slugsOf(pf.data, "focus_areas");
    selectedCerts = slugsOf(pc.data, "certifications");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · My profile
        </p>
        <div className="flex items-center gap-4">
          <Link href="/profile/requests" className="text-sm font-medium text-neutral-700 underline">
            Intro requests
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-neutral-500 underline" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
        {profile ? "Edit your profile" : "Create your profile"}
      </h1>
      <p className="mt-3 text-neutral-600">
        This is your public page — what studios and fellow artists see. Fill in what you like now;
        you can always come back and add more. Nothing is public until you flip{" "}
        <span className="font-medium">Publish</span> on.
      </p>

      <ProfileEditor
        initial={
          p
            ? {
                display_name: p.display_name ?? "",
                public_slug: p.public_slug ?? "",
                primary_role: p.primary_role ?? "",
                city: p.city ?? "",
                state_province: p.state_province ?? "",
                country: p.country ?? "",
                bio: p.bio ?? "",
                years_experience: p.years_experience ?? "",
                credentials: p.credentials ?? "",
                age_range: p.age_range ?? "",
                headshot_url: p.headshot_url ?? "",
                teaching_reel_url: p.teaching_reel_url ?? "",
                gallery_urls: p.gallery_urls ?? [],
                resume_url: p.resume_url ?? "",
                social_links: p.social_links ?? {},
                profile_status: p.profile_status ?? "draft",
              }
            : null
        }
        styleOptions={styleOptions}
        levelOptions={levelOptions}
        focusOptions={focusOptions}
        roleOptions={roleOptions}
        certOptions={certOptions}
        selectedStyles={selectedStyles}
        selectedLevels={selectedLevels}
        selectedFocus={selectedFocus}
        selectedCerts={selectedCerts}
      />

      <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
