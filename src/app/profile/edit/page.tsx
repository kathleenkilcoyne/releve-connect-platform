// Your profile editor. Server-side, this page:
//   1. checks you're signed in (if not → send you to /login),
//   2. loads the pick-lists (styles/levels/focus/roles),
//   3. loads your existing profile (if any) so the form is pre-filled,
// then hands it all to the interactive form component.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasActiveProfileTier } from "@/lib/membership/access";
import { activateProfessionalProfile } from "@/lib/profile/activate";
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
  visibility: string | null;
  teaching_at: string | null;
  touring_with: string | null;
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

  // PROFILE V2 — catch-up activation.
  //
  // Profiles are created by the activation service, not by saving this form. Two
  // groups of people can hold an active membership and still have no profile row:
  // anyone activated BEFORE Profile V2 shipped, and anyone whose webhook or
  // approve-time activation failed. Running it here means they simply arrive and
  // find their profile waiting, instead of hitting an editor that cannot save.
  //
  // Idempotent and cheap: it returns immediately when a profile already exists,
  // which is the case on every visit after the first.
  await activateProfessionalProfile(createAdminClient(), user.id);

  // Pick-lists (world-readable). availability_tags is no longer queried here
  // (redesign 2026-08-19 §5) — the legacy General Availability / "I'm
  // currently accepting" pick-lists are retired from this form. The table and
  // its rows are untouched; nothing here reads or writes them any more.
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
        "gallery_urls, resume_url, social_links, profile_status, visibility, teaching_at, touring_with",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // The untyped client returns a loose type; cast once to a known shape.
  const p = profile as unknown as ProfileFields | null;

  // Still no profile after the catch-up above means this person holds an active
  // membership but was never approved and holds no founding grant — so under the
  // Profile V2 rule they are not a vetted professional and must not have a
  // professional profile. Paying for a membership does not confer one. Send them
  // to /subscribe, which explains where they stand, rather than to an editor that
  // could not save anyway. This is also what stops an eligible Founding
  // Professional or approved professional from ever landing here mid-activation:
  // the catch-up above already created their draft by this point, so `p` is set.
  if (!p) redirect("/subscribe?from=profile");

  // Which tags are currently selected.
  //
  // Swing's is_available flag IS loaded now (redesign 2026-08-19 §8) — the
  // simplified toggle only reads/shows that one field; home_location / travel
  // radius / notes stay untouched in the database and are not surfaced here.
  let selectedStyles: string[] = [];
  let selectedLevels: string[] = [];
  let selectedFocus: string[] = [];
  let selectedCerts: string[] = [];
  // Multi-select professional roles (redesign 2026-08-19 §3), read from the
  // profile_roles join table — backfilled from the old single primary_role
  // column by the 2026-08-19 migration, so an existing single role still shows
  // up here as one checked box, not an empty selection.
  let selectedRoles: string[] = [];
  let swingAvailable = false;
  if (p) {
    const pid = p.profile_id;
    const [ps, pl, pf, pc, pr, sw] = await Promise.all([
      supabase.from("profile_styles").select("styles(slug)").eq("profile_id", pid),
      supabase.from("profile_levels").select("levels(slug)").eq("profile_id", pid),
      supabase.from("profile_focus_areas").select("focus_areas(slug)").eq("profile_id", pid),
      supabase.from("profile_certifications").select("certifications(slug)").eq("profile_id", pid),
      supabase.from("profile_roles").select("role_types(slug)").eq("profile_id", pid),
      supabase.from("swing_availability").select("is_available").eq("profile_id", pid).maybeSingle(),
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
    selectedRoles = slugsOf(pr.data, "role_types");
    swingAvailable = Boolean((sw.data as { is_available?: boolean } | null)?.is_available);
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
        {/* `p` truthy is guaranteed by the `if (!p) redirect(...)` guard above —
            this can never be "no profile", so it must ask what actually varies:
            has this draft ever been reviewed/published? A brand-new activation
            normally lands on /profile/review first (destination.ts); this only
            fires for someone who reached the editor directly (a bookmark, or a
            link from /profile/review) while still unpublished. */}
        {p?.profile_status === "draft" ? "Welcome to the Relevé Roster" : "Edit your profile"}
      </h1>
      <p className="mt-3 text-neutral-600">
        This is your public page — what studios and fellow artists see. Fill in what you like now;
        you can always come back and add more. Nothing is public until you turn on{" "}
        <span className="font-medium">Ready to Join the Relevé Roster</span>.
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
                visibility: p.visibility ?? "public",
                teaching_at: p.teaching_at ?? "",
                touring_with: p.touring_with ?? "",
                swing_available: swingAvailable,
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
        selectedRoles={selectedRoles}
      />

      <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
