// Single source of truth for which Professional roles a submitted application
// may claim: whatever `role_types` the live taxonomy currently marks active —
// the exact same table and filter `src/app/apply/page.tsx` already uses to
// render the role checkboxes. Replaces the old hardcoded VALID_ROLES array in
// actions.ts, which drifted out of sync with the taxonomy admins actually
// manage (new roles kept getting added to role_types without a matching code
// change, silently losing applicants who picked only one of them).
//
// Lives outside actions.ts because a "use server" file may only export async
// server actions — this pure filter needs to be unit-testable on its own.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getActiveProfessionalRoleSlugs(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data } = await supabase.from("role_types").select("slug").eq("is_active", true);
  return (data ?? []).map((r: { slug: string }) => r.slug);
}

/**
 * Keep only submitted roles that are currently active. Silently drops
 * anything retired (e.g. the old `working_dancer`/`coach`, intentionally
 * superseded — see role_taxonomy_cleanup) or fabricated/tampered-with.
 */
export function filterToActiveRoles(submitted: string[], activeSlugs: string[]): string[] {
  const active = new Set(activeSlugs);
  return submitted.filter((r) => active.has(r));
}
