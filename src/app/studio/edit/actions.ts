"use server";

// Saves a STUDIO (employer) profile. Runs on the server through the cookie-based
// (logged-in) Supabase client, so RLS guarantees a studio can only edit its own
// employer_profiles row and joins.
//
// LIGHT ONBOARDING (founder decision 2026-07-13): a studio is the buyer side, not
// vetted talent — there is NO $30 fee and NO admin approval. On first save we
// create the `users` row as account_type='employer' and the employer_profiles
// row; after that this just updates them. (Contrast: talent goes through /apply →
// review → subscribe. Studios do not.)

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildEmployerProfileRow, addressChanged, type StudioRow } from "@/lib/studio/profile";
import { emailSiteUrl } from "@/lib/email/send";
import { sendStudioSubmittedAlert } from "@/lib/notifications";
import { orgCopy } from "@/lib/studio/org-copy";

export type SaveState = {
  ok: boolean;
  message: string;
};

export async function saveStudioProfile(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session expired — please sign in again." };

  // ---- Find MY existing employer profile (fetched early so its org_type can
  // drive Studio/Team wording in the validation messages below too) ----------
  // Invite-only: a studio/team profile is only ever created by an admin
  // invitation (which also binds the owner). There is no create-from-nothing
  // path here — if the signed-in user owns no profile, they haven't been
  // invited, so refuse rather than mint a public-side profile outside the gate.
  const { data: existing } = await supabase
    .from("employer_profiles")
    .select(
      "employer_id, status, org_type, address_line1, address_line2, city, state_province, postal_code, country",
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const prevAddress = existing as unknown as
    | (Partial<StudioRow> & { employer_id: string; status: string | null; org_type: string | null })
    | null;
  const copy = orgCopy(prevAddress?.org_type);

  if (!prevAddress?.employer_id) {
    return {
      ok: false,
      message: `We couldn't find your ${copy.noun}. Setup is by invitation — open your invitation link to begin.`,
    };
  }

  // ---- Normalize + validate the form (pure, tested) ------------------------
  const parsed = buildEmployerProfileRow({
    name: String(formData.get("name") ?? ""),
    artisticDirector: String(formData.get("artistic_director") ?? ""),
    uniqueNote: String(formData.get("unique_note") ?? ""),
    mission: String(formData.get("mission") ?? ""),
    website: String(formData.get("website") ?? ""),
    instagram: String(formData.get("instagram") ?? ""),
    tiktok: String(formData.get("tiktok") ?? ""),
    facebook: String(formData.get("facebook") ?? ""),
    promoVideoUrl: String(formData.get("promo_video_url") ?? ""),
    addressLine1: String(formData.get("address_line1") ?? ""),
    addressLine2: String(formData.get("address_line2") ?? ""),
    city: String(formData.get("city") ?? ""),
    stateProvince: String(formData.get("state_province") ?? ""),
    postalCode: String(formData.get("postal_code") ?? ""),
    country: String(formData.get("country") ?? ""),
    yearFounded: String(formData.get("year_founded") ?? ""),
    studentCountBand: String(formData.get("student_count_band") ?? ""),
    staffCount: String(formData.get("staff_count") ?? ""),
    roomCount: String(formData.get("room_count") ?? ""),
    accessibleByTrain: String(formData.get("accessible_by_train") ?? ""),
    accessibleByBus: String(formData.get("accessible_by_bus") ?? ""),
    carRequired: String(formData.get("car_required") ?? ""),
    cultureNote: String(formData.get("culture_note") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    brandAccent: String(formData.get("brand_accent") ?? ""),
    brandAccent2: String(formData.get("brand_accent_2") ?? ""),
    teamMotto: String(formData.get("team_motto") ?? ""),
  }, new Date(), copy.isTeam);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const row = parsed.row;

  const website = row.website;
  const links: Record<string, string> = {};
  if (website) links.website = website;

  const styles = formData.getAll("styles").map(String).filter(Boolean);
  const concentrations = formData.getAll("concentrations").map(String).filter(Boolean);
  const certs = formData.getAll("certs").map(String).filter(Boolean);

  // ---- Make sure there's a matching account row ----------------------------
  // Studios are `employer`, but only on FIRST creation — an existing role is
  // preserved so saving a studio page can never demote an admin.
  const { data: existingUser } = await supabase
    .from("users")
    .select("account_type")
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase.from("users").upsert(
    {
      user_id: user.id,
      email: user.email,
      account_type: existingUser?.account_type ?? "employer",
      display_name: row.name,
      status: "active",
    },
    { onConflict: "user_id" },
  );

  // ---- Assemble the row to write -------------------------------------------
  // Loose record shape so a conditional map-pin reset doesn't fight the client's
  // strict excess-property check.
  const writeRow: Record<string, unknown> = {
    owner_user_id: user.id,
    name: row.name,
    artistic_director: row.artistic_director,
    unique_note: row.unique_note,
    mission: row.mission,
    website: row.website,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    city: row.city,
    state_province: row.state_province,
    postal_code: row.postal_code,
    country: row.country,
    year_founded: row.year_founded,
    student_count_band: row.student_count_band,
    staff_count: row.staff_count,
    room_count: row.room_count,
    accessible_by_train: row.accessible_by_train,
    accessible_by_bus: row.accessible_by_bus,
    car_required: row.car_required,
    culture_note: row.culture_note,
    bio: row.bio,
    instagram: row.instagram,
    tiktok: row.tiktok,
    facebook: row.facebook,
    promo_video_url: row.promo_video_url,
    brand_accent: row.brand_accent,
    brand_accent_2: row.brand_accent_2,
    team_motto: row.team_motto,
    links,
    updated_at: new Date().toISOString(),
  };

  // First real save moves an untouched invited studio into `in_progress` (draft).
  // Later edits never regress a submitted/approved/live studio back to draft.
  if (prevAddress.status === "invited" || prevAddress.status == null) {
    writeRow.status = "in_progress";
  }

  // If the address changed (or this is the first save), invalidate any stored map
  // pin so the later geocode backfill re-pins the studio.
  if (addressChanged(prevAddress, row)) {
    writeRow.lat = null;
    writeRow.lng = null;
    writeRow.geocoded_at = null;
  }

  // ---- Update my own row (RLS: owner_user_id = auth.uid()) ------------------
  const employerId = prevAddress.employer_id;
  const { error } = await supabase
    .from("employer_profiles")
    .update(writeRow)
    .eq("employer_id", employerId);
  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  // ---- Replace the vocab joins (styles / concentration / certs) ------------
  await replaceJoin(supabase, "employer_styles", "styles", "style_id", employerId, styles);
  await replaceJoin(
    supabase,
    "employer_concentrations",
    "studio_concentrations",
    "concentration_id",
    employerId,
    concentrations,
  );
  await replaceJoin(
    supabase,
    "employer_certifications",
    "certifications",
    "certification_id",
    employerId,
    certs,
  );

  revalidatePath("/studio/setup");
  return { ok: true, message: `Saved. Your ${copy.noun} profile is up to date.` };
}

/**
 * Submit the studio profile for Kathleen's review: `in_progress` → `submitted`.
 *
 * A studio does its own work up to `submitted`; `approved` and `live` are
 * Kathleen's alone (nothing auto-publishes). This flips the status, mirrors it on
 * the invite row (via the service role — the studio can't write that table), and
 * alerts Kathleen. Location is still the one hard requirement, so a profile can't
 * be submitted before it's been saved at least once with a city + state.
 */
export async function submitStudioForReview(_prev: SaveState, _formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session expired — please sign in again." };

  const { data: mine } = await supabase
    .from("employer_profiles")
    .select("employer_id, name, status, org_type, city, state_province")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  const prof = mine as
    | {
        employer_id: string;
        name: string | null;
        status: string | null;
        org_type: string | null;
        city: string | null;
        state_province: string | null;
      }
    | null;
  const copy = orgCopy(prof?.org_type);

  if (!prof?.employer_id) {
    return { ok: false, message: `We couldn't find your ${copy.noun} to submit.` };
  }
  if (!prof.city || !prof.state_province || !(prof.name ?? "").trim()) {
    return {
      ok: false,
      message: `Please save your ${copy.nameLabel.toLowerCase()} and location before submitting for review.`,
    };
  }
  if (prof.status === "approved" || prof.status === "live") {
    return { ok: true, message: `Your ${copy.noun} has already been reviewed.` };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("employer_profiles")
    .update({ status: "submitted", submitted_at: now, updated_at: now })
    .eq("employer_id", prof.employer_id);
  if (error) return { ok: false, message: `Could not submit: ${error.message}` };

  // Mirror the status onto the invite + alert Kathleen — both need the service
  // role (the invite table is default-deny; the alert must not fail the submit).
  const admin = createAdminClient();
  await admin
    .from("founding_studio_invites")
    .update({ status: "submitted" })
    .eq("employer_id", prof.employer_id);
  await sendStudioSubmittedAlert({
    studioName: prof.name ?? "(unnamed studio)",
    contactEmail: user.email ?? null,
    reviewUrl: `${emailSiteUrl()}/admin/studios`,
  });

  revalidatePath("/studio/setup");
  return {
    ok: true,
    message: "Submitted for review. Kathleen will take a look and be in touch — nothing is public yet.",
  };
}

/**
 * Replace all of an employer's rows in a vocab join table with the given slugs.
 * Resolves slugs→ids from the vocab table, deletes the studio's existing rows,
 * and inserts the new set. Own-row RLS keeps this scoped to the caller's studio.
 */
async function replaceJoin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  joinTable: string,
  vocabTable: string,
  fkColumn: string,
  employerId: string,
  slugs: string[],
): Promise<void> {
  await supabase.from(joinTable).delete().eq("employer_id", employerId);
  if (slugs.length === 0) return;
  const { data: vocab } = await supabase.from(vocabTable).select("id, slug").in("slug", slugs);
  const ids = ((vocab as { id: string; slug: string }[] | null) ?? []).map((v) => v.id);
  if (ids.length === 0) return;
  const rows = ids.map((id) => ({ employer_id: employerId, [fkColumn]: id }));
  await supabase.from(joinTable).insert(rows);
}
