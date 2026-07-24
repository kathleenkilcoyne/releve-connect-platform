"use server";

// Saves your profile. Runs on the server. Writes go through the cookie-based
// (logged-in) Supabase client, so the database's own rules (RLS) guarantee you
// can only ever edit YOUR OWN profile. The service-role admin client is used for
// just two things that must see past those rules: uploading your photo to
// storage, and checking that your chosen handle isn't already taken by someone
// else (whose rows you otherwise can't see).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isReservedSlug } from "@/lib/reserved-slugs";

export type SaveState = {
  ok: boolean;
  message: string;
  slug?: string;
  published?: boolean;
};

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "profile"
  );
}

export async function saveProfile(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session expired — please sign in again." };

  // ---- Read the form -------------------------------------------------------
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) return { ok: false, message: "Please enter your name." };

  const bio = String(formData.get("bio") ?? "").trim();
  const primaryRole = String(formData.get("primary_role") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const stateProvince = String(formData.get("state_province") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "").trim() || null;
  const years = String(formData.get("years_experience") ?? "").trim() || null;
  const credentials = String(formData.get("credentials") ?? "").trim() || null;
  const ageRange = String(formData.get("age_range") ?? "").trim() || null;
  // The DB column is still `teaching_reel_url`; the form now calls it "Featured
  // Video" (revisions 2026-07-24 §2). Renaming the column would be churn for no
  // gain — the label is what members read.
  const teachingReelUrl = String(formData.get("teaching_reel_url") ?? "").trim() || null;
  const publish = formData.get("publish") === "on";

  // The "Currently" lines. Free text on purpose — a specific employer name is a
  // fact about one person, not a facet anyone would filter the Roster by.
  const teachingAt = String(formData.get("teaching_at") ?? "").trim() || null;
  const touringWith = String(formData.get("touring_with") ?? "").trim() || null;

  const styles = formData.getAll("styles").map(String).filter(Boolean);
  const levels = formData.getAll("levels").map(String).filter(Boolean);
  const focus = formData.getAll("focus").map(String).filter(Boolean);
  const certs = formData.getAll("certs").map(String).filter(Boolean);
  // Both availability groups ("general" + "currently") post under one name, so
  // they land here as a single list and save as one facet.
  const availability = formData.getAll("availability").map(String).filter(Boolean);

  const social: Record<string, string> = {};
  for (const k of ["website", "instagram", "vimeo", "youtube", "linkedin"] as const) {
    const v = String(formData.get(k) ?? "").trim();
    if (v) social[k] = v;
  }

  const admin = createAdminClient();

  // ---- Make sure there's a matching account row ----------------------------
  // account_type is set only when the row is FIRST created. Overwriting it here
  // would silently demote an existing admin (or employer) to `talent` every time
  // they saved their profile — which, now that the admin console is gated on
  // account_type = 'admin', would revoke their own access mid-session.
  const { data: existingUser } = await supabase
    .from("users")
    .select("account_type")
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase.from("users").upsert(
    {
      user_id: user.id,
      email: user.email,
      account_type: existingUser?.account_type ?? "talent",
      display_name: displayName,
      status: "active",
    },
    { onConflict: "user_id" },
  );

  // ---- Find any existing profile of mine -----------------------------------
  const { data: existing } = await supabase
    .from("talent_profiles")
    .select("profile_id, public_slug, headshot_url, gallery_urls, resume_url")
    .eq("user_id", user.id)
    .maybeSingle();

  // ---- Work out a unique handle (public_slug) ------------------------------
  // The handle is a ROOT-LEVEL URL (releveconnect.com/<handle>), so it must not
  // be a reserved app path. Reject an explicitly-typed reserved handle outright;
  // for an auto-generated one, the uniqueness loop below skips reserved candidates.
  const requestedHandle = String(formData.get("public_slug") ?? "").trim();
  if (requestedHandle && isReservedSlug(slugify(requestedHandle))) {
    return {
      ok: false,
      message: `“${slugify(requestedHandle)}” is a reserved word — please choose a different handle.`,
    };
  }
  let handle = requestedHandle ? slugify(requestedHandle) : existing?.public_slug ?? slugify(displayName);
  // Ensure global uniqueness (admin can see everyone's slugs; the RLS client can't)
  // AND that the handle never collides with a reserved app route.
  let candidate = handle;
  for (let n = 2; n < 50; n++) {
    const { data: taken } = await admin
      .from("talent_profiles")
      .select("profile_id")
      .eq("public_slug", candidate)
      .maybeSingle();
    const collides = (taken && taken.profile_id !== existing?.profile_id) || isReservedSlug(candidate);
    if (!collides) break;
    candidate = `${handle}-${n}`;
  }
  handle = candidate;

  // ---- Optional photo upload ----------------------------------------------
  // `undefined` = leave the current photo as-is; a string = new photo URL.
  let headshotUrl: string | undefined = undefined;
  const file = formData.get("headshot");
  if (file && typeof file === "object" && "size" in file && file.size > 0) {
    const f = file as File;
    const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${user.id}/headshot-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await f.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from("headshots")
      .upload(path, bytes, { contentType: f.type, upsert: true });
    if (upErr) return { ok: false, message: `Photo upload failed: ${upErr.message}` };
    headshotUrl = admin.storage.from("headshots").getPublicUrl(path).data.publicUrl;
  }

  // ---- Optional résumé / CV (PDF) upload ----------------------------------
  // `undefined` = leave as-is; `null` = the member cleared it; a string = new URL.
  let resumeUrl: string | null | undefined = undefined;
  const resumeFile = formData.get("resume");
  if (resumeFile && typeof resumeFile === "object" && "size" in resumeFile && resumeFile.size > 0) {
    const rf = resumeFile as File;
    const path = `${user.id}/resume-${Date.now()}.pdf`;
    const bytes = Buffer.from(await rf.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from("resumes")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return { ok: false, message: `Résumé upload failed: ${upErr.message}` };
    resumeUrl = admin.storage.from("resumes").getPublicUrl(path).data.publicUrl;
  } else if (formData.get("resume_remove") === "on") {
    resumeUrl = null;
  }

  // ---- Photo gallery (up to 8) --------------------------------------------
  // The form sends the ORDERED list the member wants: `gallery_existing` for the
  // URLs they kept, plus any newly-picked files in `gallery_new`. We upload the
  // new ones and keep the union, capped at 8. Always written (the form is the
  // full desired state), so removals take effect too.
  const keptGallery = formData.getAll("gallery_existing").map(String).filter(Boolean);
  const newGalleryFiles = formData
    .getAll("gallery_new")
    .filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0);
  const uploadedGallery: string[] = [];
  for (let i = 0; i < newGalleryFiles.length && keptGallery.length + uploadedGallery.length < 8; i++) {
    const gf = newGalleryFiles[i];
    const ext = (gf.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${user.id}/gallery-${Date.now()}-${i}.${ext}`;
    const bytes = Buffer.from(await gf.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from("gallery")
      .upload(path, bytes, { contentType: gf.type, upsert: true });
    if (upErr) return { ok: false, message: `Gallery upload failed: ${upErr.message}` };
    uploadedGallery.push(admin.storage.from("gallery").getPublicUrl(path).data.publicUrl);
  }
  const galleryUrls = [...keptGallery, ...uploadedGallery].slice(0, 8);

  // ---- Build the row and save ---------------------------------------------
  const row: Record<string, unknown> = {
    user_id: user.id,
    display_name: displayName,
    public_slug: handle,
    primary_role: primaryRole,
    city,
    state_province: stateProvince,
    country,
    bio: bio || null,
    years_experience: years,
    credentials,
    age_range: ageRange,
    teaching_reel_url: teachingReelUrl,
    teaching_at: teachingAt,
    touring_with: touringWith,
    gallery_urls: galleryUrls,
    social_links: social,
    profile_status: publish ? "published" : "draft",
    visibility: "public",
    updated_at: new Date().toISOString(),
  };
  if (headshotUrl !== undefined) row.headshot_url = headshotUrl;
  if (resumeUrl !== undefined) row.resume_url = resumeUrl;

  let profileId = existing?.profile_id as string | undefined;
  if (existing) {
    const { error } = await supabase.from("talent_profiles").update(row).eq("user_id", user.id);
    if (error) return { ok: false, message: `Couldn't save: ${error.message}` };
  } else {
    // FIRST CREATION — carry the approval decision onto the profile. Honorifics
    // and the marketplace tier were conferred by Kathleen on the APPLICATION;
    // copy them here so they can never be self-edited on the profile form.
    //
    // Verified Member is granted IMMEDIATELY once vetting is complete — no
    // waiting period (founder decision 2026-07-12, supersedes the old §13 ~60-day
    // rule). "Vetting complete" = the applicant passed the documentation-
    // authenticity check (their application is `approved`) AND has paid (this
    // profile builder is already gated behind an active Professional membership,
    // see page.tsx). Both hold here, so an approved applicant's profile is
    // Verified the moment it's created.
    const { data: appRow } = await admin
      .from("applications")
      .select("honorifics, approved_tier")
      .eq("user_id", user.id)
      .eq("state", "approved")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const approved = appRow as { honorifics: string[] | null; approved_tier: string | null } | null;

    row.honorifics = approved?.honorifics ?? [];
    if (approved?.approved_tier) row.choreographer_tier = approved.approved_tier;
    if (approved) {
      // Vetting complete (approved + paid) → grant the Verified Member mark now.
      row.verification_flag = true;
      row.certified_eligible_at = new Date().toISOString(); // when it was granted
    }

    const { data, error } = await supabase
      .from("talent_profiles")
      .insert(row)
      .select("profile_id")
      .single();
    if (error) return { ok: false, message: `Couldn't create your profile: ${error.message}` };
    profileId = (data as { profile_id: string }).profile_id;
  }

  // ---- Replace the tag selections (styles / levels / focus areas) ----------
  async function replaceJoin(
    joinTable: string,
    fkColumn: string,
    slugs: string[],
    taxTable: string,
  ) {
    await supabase.from(joinTable).delete().eq("profile_id", profileId);
    if (slugs.length === 0) return;
    const { data: rows } = await supabase.from(taxTable).select("id, slug").in("slug", slugs);
    const inserts = (rows ?? []).map((r: { id: string }) => ({
      profile_id: profileId,
      [fkColumn]: r.id,
    }));
    if (inserts.length) await supabase.from(joinTable).insert(inserts);
  }
  await replaceJoin("profile_styles", "style_id", styles, "styles");
  await replaceJoin("profile_levels", "level_id", levels, "levels");
  await replaceJoin("profile_focus_areas", "focus_area_id", focus, "focus_areas");
  await replaceJoin("profile_certifications", "certification_id", certs, "certifications");
  await replaceJoin(
    "profile_availability",
    "availability_tag_id",
    availability,
    "availability_tags",
  );

  // NOTE: the Swing tables (swing_availability / swing_styles / swing_levels)
  // are deliberately NOT written here any more. The builder no longer asks for
  // that data (revisions 2026-07-24 §7), and writing an empty row would quietly
  // erase what members already entered — so we leave those rows exactly as they
  // are until The Swing actually ships.

  revalidatePath(`/talent/${handle}`);
  revalidatePath("/profile/edit");

  return {
    ok: true,
    slug: handle,
    published: publish,
    message: publish
      ? "Saved — you're on the Relevé Roster. Your public page is live."
      : "Saved as a draft. Turn on “Ready to Join the Relevé Roster” when you're ready to go live.",
  };
}
