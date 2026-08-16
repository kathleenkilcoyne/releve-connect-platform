"use server";

// Professional Services — owner-scoped CRUD.
//
// Writes go through the caller's cookie/RLS Supabase client, so the database's
// own policies guarantee a professional can only ever touch THEIR OWN services
// (professional_services_*_own, gated on owns_talent_profile). The service-role
// admin client is used only to upload the business card / logo to the dedicated
// `service-media` bucket (path prefix = the user's id, matching that bucket's
// owner-scoped storage policies).
//
// Every value is validated and normalized by the pure layer before it reaches
// Postgres — http(s)-only links, markup stripped from prose, and the
// contact-privacy rule (a show_* flag can only be true when there is something
// to show). See src/lib/services/services.ts.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateService,
  isProfessionalServicesEnabled,
  type ServiceStatus,
} from "@/lib/services";

export type ServiceActionState = {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
  serviceId?: string;
};

const OFF: ServiceActionState = {
  ok: false,
  message: "Professional Services aren’t available right now.",
};

/** Resolve the signed-in professional's own profile id (RLS: own row only). */
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
 * Create or update one Professional Service. `service_id` present ⇒ update,
 * else insert. The form's "Display this service on my public profile" checkbox
 * decides status: on = active (shown), off = hidden (kept, not shown).
 */
export async function saveService(
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  if (!isProfessionalServicesEnabled()) return OFF;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session expired — please sign in again." };

  const profileId = await ownProfileId(supabase, user.id);
  if (!profileId) {
    return {
      ok: false,
      message: "Create your Relevé profile first — then you can add your services.",
    };
  }

  const serviceId = String(formData.get("service_id") ?? "").trim() || null;
  const status: ServiceStatus = formData.get("display_publicly") === "on" ? "active" : "hidden";

  const result = validateService({
    category: String(formData.get("category") ?? ""),
    categoryOtherLabel: String(formData.get("category_other_label") ?? ""),
    businessName: String(formData.get("business_name") ?? ""),
    shortDescription: String(formData.get("short_description") ?? ""),
    location: String(formData.get("location") ?? ""),
    serviceType: String(formData.get("service_type") ?? ""),
    websiteUrl: String(formData.get("website_url") ?? ""),
    socialUrl: String(formData.get("social_url") ?? ""),
    businessEmail: String(formData.get("business_email") ?? ""),
    businessPhone: String(formData.get("business_phone") ?? ""),
    showEmail: formData.get("show_email") === "on",
    showPhone: formData.get("show_phone") === "on",
    ctaLabel: String(formData.get("cta_label") ?? ""),
    status,
    // Accompanist / class musician — ignored by the validator for other categories.
    instrument: String(formData.get("instrument") ?? ""),
    instrumentOther: String(formData.get("instrument_other") ?? ""),
    accompanistFor: formData.getAll("accompanist_for").map(String).filter(Boolean),
    rateDisplay: String(formData.get("rate_display") ?? ""),
    rateContact: formData.get("rate_contact") === "on",
    mediaUrl: String(formData.get("media_url") ?? ""),
  });
  if (!result.ok) {
    const errors: Record<string, string> = {};
    for (const e of result.errors) errors[e.field] = e.message;
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }
  const v = result.value;

  // ---- Ownership check on edit (defense-in-depth on top of RLS) ------------
  if (serviceId) {
    const { data: owned } = await supabase
      .from("professional_services")
      .select("id")
      .eq("id", serviceId)
      .maybeSingle();
    if (!owned) {
      // RLS hides rows the caller doesn't own, so "not found" == "not yours".
      return { ok: false, message: "That service couldn’t be found." };
    }
  }

  // ---- Optional business card / logo → dedicated service-media bucket ------
  // undefined = leave as-is; null = cleared; string = new public URL.
  let imageUrl: string | null | undefined = undefined;
  const file = formData.get("image");
  if (file && typeof file === "object" && "size" in file && (file as File).size > 0) {
    const f = file as File;
    const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    // Path MUST start with the user's id — the service-media storage policies
    // scope writes to `<uid>/…`.
    const path = `${user.id}/service-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await f.arrayBuffer());
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from("service-media")
      .upload(path, bytes, { contentType: f.type, upsert: true });
    if (upErr) return { ok: false, message: `Image upload failed: ${upErr.message}` };
    imageUrl = admin.storage.from("service-media").getPublicUrl(path).data.publicUrl;
  } else if (formData.get("image_remove") === "on") {
    imageUrl = null;
  }

  const row: Record<string, unknown> = {
    category: v.category,
    category_other_label: v.categoryOtherLabel,
    business_name: v.businessName,
    short_description: v.shortDescription,
    location: v.location,
    service_type: v.serviceType,
    website_url: v.websiteUrl,
    social_url: v.socialUrl,
    business_email: v.businessEmail,
    business_phone: v.businessPhone,
    show_email: v.showEmail,
    show_phone: v.showPhone,
    cta_label: v.ctaLabel,
    instrument: v.instrument,
    instrument_other: v.instrumentOther,
    accompanist_for: v.accompanistFor,
    rate_display: v.rateDisplay,
    rate_contact: v.rateContact,
    media_url: v.mediaUrl,
    status: v.status,
    updated_at: new Date().toISOString(),
  };
  if (imageUrl !== undefined) row.image_url = imageUrl;

  if (serviceId) {
    const { error } = await supabase
      .from("professional_services")
      .update(row)
      .eq("id", serviceId);
    if (error) return { ok: false, message: `Couldn’t save: ${error.message}` };
    revalidateServiceSurfaces();
    return {
      ok: true,
      serviceId,
      message:
        v.status === "active" ? "Saved — it’s on your profile." : "Saved. It’s not shown publicly.",
    };
  }

  // Insert — append to the end of this professional's list.
  const { data: last } = await supabase
    .from("professional_services")
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
    .from("professional_services")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, message: `Couldn’t add your service: ${error.message}` };

  revalidateServiceSurfaces();
  return {
    ok: true,
    serviceId: (created as { id: string }).id,
    message:
      v.status === "active" ? "Added — it’s on your profile." : "Saved. It’s not shown publicly.",
  };
}

/** Show / hide one service on the public profile. RLS-scoped. */
export async function setServiceStatus(
  serviceId: string,
  status: ServiceStatus,
): Promise<{ ok: boolean; message?: string }> {
  if (!isProfessionalServicesEnabled()) return { ok: false, message: "Unavailable." };
  if (status !== "active" && status !== "hidden") return { ok: false, message: "Bad status." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const { error } = await supabase
    .from("professional_services")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", serviceId);
  if (error) return { ok: false, message: error.message };

  revalidateServiceSurfaces();
  return { ok: true };
}

/** Delete one of the caller's own services. RLS-scoped; nothing depends on the row. */
export async function deleteService(
  serviceId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!isProfessionalServicesEnabled()) return { ok: false, message: "Unavailable." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const { error } = await supabase.from("professional_services").delete().eq("id", serviceId);
  if (error) return { ok: false, message: error.message };

  revalidateServiceSurfaces();
  return { ok: true };
}

/** The two surfaces a service change is visible on: the workspace and /profile. */
function revalidateServiceSurfaces() {
  revalidatePath("/profile/services");
  revalidatePath("/profile");
}
