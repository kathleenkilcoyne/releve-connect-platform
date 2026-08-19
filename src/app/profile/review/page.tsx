// /profile/review — where a newly activated professional lands.
//
// Activation created their DRAFT and seeded it once from the accepted
// application. This is the screen that says so, shows what came across, names
// what is still missing, explains what "public" means, and lets them publish.
//
// Gate: signed in, an active profile-bearing membership, and a profile that
// exists. The membership check runs BEFORE the catch-up activation for the same
// reason /profile/edit does it in that order — someone who never activated must
// not be handed a profile here.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasActiveProfileTier } from "@/lib/membership/access";
import { activateProfessionalProfile } from "@/lib/profile/activate";
import {
  buildChecklist,
  carriedAssetsNeedingAttention,
  resolveAudience,
  type ReviewProfile,
} from "@/lib/profile/review";
import ReviewScreen from "./ReviewScreen";

export const dynamic = "force-dynamic";

export default async function ProfileReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/review");

  if (!(await hasActiveProfileTier(supabase, user.id))) {
    redirect("/subscribe?from=review");
  }

  // Catch-up, identical to the /profile/edit gate: idempotent, and returns
  // immediately once a profile exists.
  const admin = createAdminClient();
  await activateProfessionalProfile(admin, user.id);

  const { data: row } = await supabase
    .from("talent_profiles")
    .select(
      "profile_id, display_name, public_slug, headshot_url, bio, primary_role, city, " +
        "teaching_reel_url, resume_url, social_links, gallery_urls, profile_status, " +
        "visibility, prefilled_from_application_id",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // Same rule as the editor: an active membership without approval or a grant is
  // not a vetted professional and gets no profile.
  if (!row) redirect("/subscribe?from=review");

  const profile = row as unknown as ReviewProfile & {
    profile_id: string;
    public_slug: string | null;
    prefilled_from_application_id: string | null;
  };

  // Styles/levels live in join tables, so the checklist needs their counts.
  const [{ count: styleCount }, { count: levelCount }] = await Promise.all([
    supabase
      .from("profile_styles")
      .select("style_id", { count: "exact", head: true })
      .eq("profile_id", profile.profile_id),
    supabase
      .from("profile_levels")
      .select("level_id", { count: "exact", head: true })
      .eq("profile_id", profile.profile_id),
  ]);

  const checklist = buildChecklist(profile, {
    styles: styleCount ?? 0,
    levels: levelCount ?? 0,
  });

  // Assets the applicant gave us as EXTERNAL urls. We never fetched them
  // (founder decision §5); we show them back so nobody repeats work we hold.
  // Read from the application this profile was seeded from — no new column.
  let carried: ReturnType<typeof carriedAssetsNeedingAttention> = [];
  if (profile.prefilled_from_application_id) {
    const { data: appRow } = await admin
      .from("applications")
      .select("answers")
      .eq("application_id", profile.prefilled_from_application_id)
      .maybeSingle();
    const answers = (appRow as { answers?: Record<string, unknown> } | null)?.answers ?? {};
    const digital = (answers.digital_presence ?? {}) as Record<string, string | undefined>;
    carried = carriedAssetsNeedingAttention(
      {
        headshotUrl: digital.headshot_url?.trim() || null,
        resumeUrl: digital.resume_url?.trim() || null,
      },
      { headshot_url: profile.headshot_url, resume_url: profile.resume_url },
    );
  }

  const audience = resolveAudience({
    profileStatus: profile.profile_status,
    prefilledFromApplicationId: profile.prefilled_from_application_id,
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · Your profile
        </p>
        <Link href="/profile" className="text-sm text-neutral-500 underline">
          My home
        </Link>
      </div>

      <ReviewScreen
        audience={audience}
        checklist={checklist}
        carried={carried}
        displayName={profile.display_name ?? ""}
        slug={profile.public_slug}
        profileStatus={profile.profile_status ?? "draft"}
        visibility={profile.visibility ?? "public"}
      />

      <Link href="/" className="mt-12 inline-block text-sm text-neutral-400 underline">
        together we rise · relevé
      </Link>
    </main>
  );
}
