// Single source of truth for which Professional roles are currently valid to
// hold — whatever `role_types` the live taxonomy marks active. Used to
// validate multi-role selections on both the application and the profile
// editor, so a retired role (working_dancer, coach) or a fabricated value can
// never be saved, and every currently-active role (whatever admins have added
// to the taxonomy, with no code change) can.
//
// Mirrors src/app/apply/roles.ts (a separate, already-in-review fix for the
// same class of bug on the application form) — kept as its own copy for now
// so the two changes stay independently reviewable; worth consolidating into
// one import once both are merged.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getActiveProfessionalRoleSlugs(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data } = await supabase.from("role_types").select("slug").eq("is_active", true);
  return (data ?? []).map((r: { slug: string }) => r.slug);
}

/**
 * Keep only submitted roles that are currently active. Silently drops
 * anything retired (e.g. `working_dancer`/`coach`, intentionally superseded —
 * see role_taxonomy_cleanup) or fabricated/tampered-with.
 */
export function filterToActiveRoles(submitted: string[], activeSlugs: string[]): string[] {
  const active = new Set(activeSlugs);
  return submitted.filter((r) => active.has(r));
}
