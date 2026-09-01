"use server";

// Professional Offerings — owner-scoped CRUD (Slice 2).
//
// Writes go through the caller's cookie/RLS Supabase client, so the database's
// own policies guarantee a professional can only ever touch THEIR OWN offerings
// (professional_offerings_*_own, gated on owns_talent_profile). The service-role
// admin client is used only to upload the offering image to the dedicated
// `offering-media` bucket (path prefix = the user's id, matching that bucket's
// owner-scoped storage policies).
//
// This slice SAVES DATA ONLY. It does not send intros, touch licensing, or wire
// any CTA behavior — Slice 4 does that. cta_type is left null so the render layer
// derives the CTA from `type` (deriveCta), keeping one source of truth.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateOffering,
  resolvePricing,
  isProfessionalOfferingsEnabled,
  type OfferingStatus,
} from "@/lib/offerings";

export type OfferingActionState = {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
  offeringId?: string;
};

const OFF: OfferingActionState = {
  ok: false,
  message: "Offerings aren’t available right now.",
};

// Resolve the signed-in professional's own profile id (RLS: own row only).
async function ownProfileId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("talent_profiles")
    .select("profile_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { profile_id: string } | null)?.profile_id ?? null;
}

/**
 * Create or update one Offering. `offering_id` present ⇒ update, else insert.
 * Two submit intents: "publish" → active, "draft" → inactive.
 */
export async function saveOffering(
  _prev: OfferingActionState,
  formData: FormData,
): Promise<OfferingActionState> {
  if (!isProfessionalOfferingsEnabled()) return OFF;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session expired — please sign in again." };

  const profileId = await ownProfileId(supabase, user.id);
  if (!profileId) {
    return {
      ok: false,
      message: "Create your Relevé profile first — then you can add offerings.",
    };
  }

  const offeringId = String(formData.get("offering_id") ?? "").trim() || null;
  const intent = String(formData.get("intent") ?? "draft");
  const status: OfferingStatus = intent === "publish" ? "active" : "inactive";

  // ---- Pricing: compose the display string from picker + amount -------------
  const pricing = resolvePricing({
    pricingType: String(formData.get("pricing_type") ?? ""),
    amount: String(formData.get("price_amount") ?? ""),
  });
  if (!pricing.ok) {
    return { ok: false, message: pricing.error, errors: { pricing: pricing.error } };
  }

  // ---- Validate + normalize the rest ---------------------------------------
  const result = validateOffering({
    type: String(formData.get("type") ?? ""),
    title: String(formData.get("title") ?? ""),
    shortDescription: String(formData.get("short_description") ?? ""),
    pricingType: pricing.pricingType,
    priceDisplay: pricing.priceDisplay,
    locationMode: String(formData.get("location_mode") ?? ""),
    externalUrl: String(formData.get("external_url") ?? ""),
    status,
  });
  if (!result.ok) {
    const errors: Record<string, string> = {};
    for (const e of result.errors) errors[e.field] = e.message;
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors,
    };
  }
  const v = result.value;

  // ---- Ownership check on edit (defense-in-depth on top of RLS) ------------
  if (offeringId) {
    const { data: owned } = await supabase
      .from("professional_offerings")
      .select("id, image_url")
      .eq("id", offeringId)
      .maybeSingle();
    if (!owned) {
      // RLS hides rows the caller doesn't own, so "not found" == "not yours".
      return { ok: false, message: "That offering couldn’t be found." };
    }
  }

  // ---- Optional image → dedicated offering-media bucket ---------------------
  // undefined = leave as-is; null = cleared; string = new public URL.
  let imageUrl: string | null | undefined = undefined;
  const file = formData.get("image");
  if (file && typeof file === "object" && "size" in file && (file as File).size > 0) {
    const f = file as File;
    const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    // Path MUST start with the user's id — the offering-media storage policies
    // scope writes to `<uid>/…`.
    const path = `${user.id}/offering-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await f.arrayBuffer());
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from("offering-media")
      .upload(path, bytes, { contentType: f.type, upsert: true });
    if (upErr) return { ok: false, message: `Image upload failed: ${upErr.message}` };
    imageUrl = admin.storage.from("offering-media").getPublicUrl(path).data.publicUrl;
  } else if (formData.get("image_remove") === "on") {
    imageUrl = null;
  }

  // ---- Build the row (cta_type stays null → derived at render) --------------
  const row: Record<string, unknown> = {
    type: v.type,
    title: v.title,
    short_description: v.shortDescription,
    pricing_type: v.pricingType,
    price_display: v.priceDisplay,
    // price_cents is canonical (2026-09-01, Services transaction rail Phase 1)
    // — what a booking actually charges. price_display stays purely cosmetic.
    price_cents: pricing.priceCents,
    location_mode: v.locationMode,
    external_url: v.externalUrl,
    status: v.status,
    updated_at: new Date().toISOString(),
  };
  if (imageUrl !== undefined) row.image_url = imageUrl;

  if (offeringId) {
    const { error } = await supabase
      .from("professional_offerings")
      .update(row)
      .eq("id", offeringId);
    if (error) return { ok: false, message: `Couldn’t save: ${error.message}` };
    revalidatePath("/profile/offerings");
    return {
      ok: true,
      offeringId,
      message: status === "active" ? "Saved and published." : "Saved as a draft.",
    };
  }

  // Insert — append to the end of the professional's list.
  const { data: last } = await supabase
    .from("professional_offerings")
    .select("sort_order")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  row.profile_id = profileId;
  row.sort_order = nextOrder;
  if (imageUrl === undefined) row.image_url = null;

  const { data: created, error } = await supabase
    .from("professional_offerings")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, message: `Couldn’t create your offering: ${error.message}` };

  revalidatePath("/profile/offerings");
  return {
    ok: true,
    offeringId: (created as { id: string }).id,
    message: status === "active" ? "Offering published." : "Saved as a draft.",
  };
}

/** Flip an offering between active (Live) and inactive (Hidden). RLS-scoped. */
export async function setOfferingStatus(
  offeringId: string,
  status: OfferingStatus,
): Promise<{ ok: boolean; message?: string }> {
  if (!isProfessionalOfferingsEnabled()) return { ok: false, message: "Unavailable." };
  if (status !== "active" && status !== "inactive") return { ok: false, message: "Bad status." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const { error } = await supabase
    .from("professional_offerings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", offeringId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/profile/offerings");
  return { ok: true };
}

/** Delete one of the caller's own offerings. RLS-scoped; safe (nothing depends
 *  on an offering row — the licensing seam is ON DELETE SET NULL). */
export async function deleteOffering(
  offeringId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!isProfessionalOfferingsEnabled()) return { ok: false, message: "Unavailable." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const { error } = await supabase
    .from("professional_offerings")
    .delete()
    .eq("id", offeringId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/profile/offerings");
  return { ok: true };
}
