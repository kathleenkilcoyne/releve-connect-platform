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
import { buildEmployerProfileRow, addressChanged, type StudioRow } from "@/lib/studio/profile";

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

  // ---- Normalize + validate the form (pure, tested) ------------------------
  const parsed = buildEmployerProfileRow({
    name: String(formData.get("name") ?? ""),
    website: String(formData.get("website") ?? ""),
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
    nearestTransit: String(formData.get("nearest_transit") ?? ""),
    carRequired: String(formData.get("car_required") ?? ""),
    parking: String(formData.get("parking") ?? ""),
    directionsNote: String(formData.get("directions_note") ?? ""),
    cultureNote: String(formData.get("culture_note") ?? ""),
    bio: String(formData.get("bio") ?? ""),
  });
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const row = parsed.row;

  const website = row.website;
  const links: Record<string, string> = {};
  if (website) links.website = website;

  const styles = formData.getAll("styles").map(String).filter(Boolean);
  const concentrations = formData.getAll("concentrations").map(String).filter(Boolean);
  const certs = formData.getAll("certs").map(String).filter(Boolean);

  // ---- Make sure there's a matching account row (first save only) ----------
  // Studios are `employer`. Upsert on conflict so a brand-new studio account is
  // created as employer; an existing account_type is not downgraded elsewhere.
  await supabase.from("users").upsert(
    {
      user_id: user.id,
      email: user.email,
      account_type: "employer",
      display_name: row.name,
      status: "active",
    },
    { onConflict: "user_id" },
  );

  // ---- Find any existing employer profile of mine --------------------------
  const { data: existing } = await supabase
    .from("employer_profiles")
    .select(
      "employer_id, address_line1, address_line2, city, state_province, postal_code, country",
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const prevAddress = existing as unknown as (Partial<StudioRow> & { employer_id: string }) | null;

  // ---- Assemble the row to write -------------------------------------------
  // Loose record shape so a conditional map-pin reset doesn't fight the client's
  // strict excess-property check.
  const writeRow: Record<string, unknown> = {
    owner_user_id: user.id,
    name: row.name,
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
    nearest_transit: row.nearest_transit,
    car_required: row.car_required,
    parking: row.parking,
    directions_note: row.directions_note,
    culture_note: row.culture_note,
    bio: row.bio,
    links,
    updated_at: new Date().toISOString(),
  };

  // If the address changed (or this is the first save), invalidate any stored map
  // pin so the later geocode backfill re-pins the studio.
  if (addressChanged(prevAddress, row)) {
    writeRow.lat = null;
    writeRow.lng = null;
    writeRow.geocoded_at = null;
  }

  // ---- Insert or update ----------------------------------------------------
  let employerId: string;
  if (prevAddress?.employer_id) {
    employerId = prevAddress.employer_id;
    const { error } = await supabase
      .from("employer_profiles")
      .update(writeRow)
      .eq("employer_id", employerId);
    if (error) return { ok: false, message: `Could not save: ${error.message}` };
  } else {
    const { data: inserted, error } = await supabase
      .from("employer_profiles")
      .insert(writeRow)
      .select("employer_id")
      .single();
    if (error || !inserted) {
      return {
        ok: false,
        message: `Could not create your studio: ${error?.message ?? "unknown error"}`,
      };
    }
    employerId = (inserted as { employer_id: string }).employer_id;
  }

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

  revalidatePath("/studio/edit");
  return { ok: true, message: "Saved. Your studio profile is up to date." };
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
