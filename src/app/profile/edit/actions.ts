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
  const publish = formData.get("publish") === "on";

  const styles = formData.getAll("styles").map(String).filter(Boolean);
  const levels = formData.getAll("levels").map(String).filter(Boolean);
  const focus = formData.getAll("focus").map(String).filter(Boolean);

  const social: Record<string, string> = {};
  for (const k of ["website", "instagram", "vimeo", "youtube", "linkedin"] as const) {
    const v = String(formData.get(k) ?? "").trim();
    if (v) social[k] = v;
  }

  const admin = createAdminClient();

  // ---- Make sure there's a matching account row (first save only) ----------
  await supabase.from("users").upsert(
    {
      user_id: user.id,
      email: user.email,
      account_type: "talent",
      display_name: displayName,
      status: "active",
    },
    { onConflict: "user_id" },
  );

  // ---- Find any existing profile of mine -----------------------------------
  const { data: existing } = await supabase
    .from("talent_profiles")
    .select("profile_id, public_slug, headshot_url")
    .eq("user_id", user.id)
    .maybeSingle();

  // ---- Work out a unique handle (public_slug) ------------------------------
  let handle = String(formData.get("public_slug") ?? "").trim();
  handle = handle ? slugify(handle) : existing?.public_slug ?? slugify(displayName);
  // Ensure global uniqueness (admin can see everyone's slugs; the RLS client can't).
  let candidate = handle;
  for (let n = 2; n < 50; n++) {
    const { data: taken } = await admin
      .from("talent_profiles")
      .select("profile_id")
      .eq("public_slug", candidate)
      .maybeSingle();
    if (!taken || taken.profile_id === existing?.profile_id) break;
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
    social_links: social,
    profile_status: publish ? "published" : "draft",
    visibility: "public",
    updated_at: new Date().toISOString(),
  };
  if (headshotUrl !== undefined) row.headshot_url = headshotUrl;

  let profileId = existing?.profile_id as string | undefined;
  if (existing) {
    const { error } = await supabase.from("talent_profiles").update(row).eq("user_id", user.id);
    if (error) return { ok: false, message: `Couldn't save: ${error.message}` };
  } else {
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

  revalidatePath(`/talent/${handle}`);
  revalidatePath("/profile/edit");

  return {
    ok: true,
    slug: handle,
    published: publish,
    message: publish
      ? "Saved and published! Your public page is live."
      : "Saved as a draft. Flip “Publish” on when you're ready to go live.",
  };
}
