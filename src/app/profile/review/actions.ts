"use server";

// Publish / unpublish — the member's own deliberate act.
//
// Founder decision §1 and §7: activation creates a DRAFT, and publishing is a
// separate, explicit choice the member makes. This action is the only place
// `profile_status` flips to 'published' from the review screen, and it takes the
// visibility choice at the same moment — so the member decides "live" and "how
// discoverable" together, having just been told what each means.
//
// ⚠️ RELEVÉ-CONTROLLED TRUST SIGNALS ARE ABSENT FROM THIS PAYLOAD, ON PURPOSE —
// the same rule as saveProfile. `verification_flag`, `certified_eligible_at`,
// `honorifics`, `choreographer_tier` and `founder_distinction` are conferred by
// Relevé (at activation, or by an admin at /admin/profiles) and are never
// writable from a member action. A test asserts this file's shape.
//
// Writes through the cookie/RLS client, so the database itself guarantees a
// member can only ever publish their OWN profile.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeVisibility } from "@/lib/profile/visibility";
import {
  buildChecklist,
  canPublish,
  publishBlockedMessage,
  type ReviewProfile,
} from "@/lib/profile/review";

export type PublishState = {
  ok: boolean;
  message: string;
  status?: "draft" | "published";
  slug?: string;
};

export async function publishProfile(
  _prev: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session expired — please sign in again." };

  // Own row only (RLS). Selects the review fields too, because the publish gate
  // is enforced HERE — a disabled button is a courtesy, not a control.
  const { data: existing } = await supabase
    .from("talent_profiles")
    .select(
      "profile_id, public_slug, visibility, profile_status, display_name, headshot_url, " +
        "bio, primary_role, city, teaching_reel_url, resume_url, social_links, gallery_urls",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return {
      ok: false,
      message: "We couldn't find your profile. Please refresh the page.",
    };
  }
  const profile = existing as unknown as ReviewProfile & {
    profile_id: string;
    public_slug: string | null;
  };

  const intent = String(formData.get("intent") ?? "publish");
  const publishing = intent !== "unpublish";
  const alreadyLive = profile.profile_status === "published";

  // ── The publish gate (founder decision 2026-08-17) ──
  // Hard-gated on the FOUR essentials only; the other five checklist items are
  // recommendations and never block.
  //
  // Applied only to the transition INTO published. Once a profile is live, this
  // action is how the member changes visibility — including switching to
  // unlisted, which is privacy-protective — and blocking that would trap them.
  // Unpublishing is never blocked: a member may always retreat to a draft.
  if (publishing && !alreadyLive) {
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

    if (!canPublish(checklist)) {
      return { ok: false, status: "draft", message: publishBlockedMessage(checklist) };
    }
  }

  const visibility = normalizeVisibility(formData.get("visibility"), profile.visibility);

  const { error } = await supabase
    .from("talent_profiles")
    .update({
      profile_status: publishing ? "published" : "draft",
      visibility,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, message: `Couldn't save: ${error.message}` };

  revalidatePath("/profile/review");
  revalidatePath("/profile");
  if (profile.public_slug) revalidatePath(`/${profile.public_slug}`);

  if (!publishing) {
    return {
      ok: true,
      status: "draft",
      slug: profile.public_slug ?? undefined,
      message:
        "Your profile is back to a private draft. Only you can see it, and you can publish again whenever you like.",
    };
  }

  return {
    ok: true,
    status: "published",
    slug: profile.public_slug ?? undefined,
    message:
      visibility === "unlisted"
        ? "Your profile is live as unlisted — only people with your link can see it."
        : "Your profile is live and you're on the Relevé Roster.",
  };
}
