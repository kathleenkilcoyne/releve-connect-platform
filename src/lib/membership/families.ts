// Membership families + applicant-role mapping (pure).
//
// Professional is defined EXPLICITLY by talent roles (2026-08-12) — NOT as
// "anything that isn't a studio". A person's membership follows the role they're
// using: holding a talent role puts them on the individual Professional track,
// even if they ALSO own a studio (a separate Organization membership).

import type { MembershipFamily } from "./activation";

/** The individual-professional (Roster) roles. Extend here to add future explicit
 *  professional roles. */
export const PROFESSIONAL_ROLES = ["teacher", "choreographer", "working_dancer"] as const;

/** Holds at least one talent role → on the individual Professional track. */
export function isProfessionalApplicant(roles: string[] | null | undefined): boolean {
  const set = new Set(roles ?? []);
  return PROFESSIONAL_ROLES.some((r) => set.has(r));
}

/** A studio owner with NO talent role → organization-only (studio) applicant.
 *  This is the case the professional-activation change must leave untouched. */
export function isStudioOnlyApplicant(roles: string[] | null | undefined): boolean {
  const set = new Set(roles ?? []);
  return set.has("studio_owner") && !isProfessionalApplicant(roles);
}

/** The membership family an applicant's roles map to. Professional wins whenever a
 *  talent role is present ("membership follows the role being used"). Null when
 *  neither a talent role nor studio ownership is present. */
export function membershipFamilyForApplicant(
  roles: string[] | null | undefined,
): MembershipFamily | null {
  if (isProfessionalApplicant(roles)) return "professional";
  if (new Set(roles ?? []).has("studio_owner")) return "studio";
  return null;
}

/** "Approved — Not Activated": vetted in, but no active paid access yet — the
 *  state the $30 activation offer targets. Pure so the concept is provable and
 *  reusable (activation prompt, admin status view). */
export function isApprovedNotActivated(input: {
  isApproved: boolean;
  hasActiveAccess: boolean;
}): boolean {
  return input.isApproved && !input.hasActiveAccess;
}
