"use server";

// Server actions for the professional home. Slice 1 ships one: the live Swing
// availability toggle. The write is owner-scoped at the database layer — the
// `swing_availability` RLS policies require `owns_talent_profile(profile_id)` —
// so a member can only ever change their own status.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProfessionalActor } from "@/lib/professional/actor";

export interface SwingResult {
  ok: boolean;
  /** The availability value now in effect (unchanged from request on failure). */
  available: boolean;
}

/** Flip the signed-in professional's Swing availability (available for sub calls). */
export async function setSwingAvailability(on: boolean): Promise<SwingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, available: !on };

  // Resolve the caller's own talent profile (service-role read, like the page).
  const actor = await resolveProfessionalActor(createAdminClient(), user.id);
  if (!actor.isProfessional || !actor.talentProfileId) {
    return { ok: false, available: !on };
  }

  // Write through the RLS-scoped client so `owns_talent_profile` is enforced.
  // profile_id is the PK, so this upsert flips the one row for this professional.
  const { error } = await supabase
    .from("swing_availability")
    .upsert({ profile_id: actor.talentProfileId, is_available: on }, { onConflict: "profile_id" });

  if (error) return { ok: false, available: !on };

  revalidatePath("/profile");
  return { ok: true, available: on };
}
