// Server-side feature flags for the membership-model rollout.
//
// Kept OUT of the pure logic (this module reads process.env). Every flag defaults
// OFF so merging the code changes NOTHING in production until the flag is
// deliberately turned on — and turning it off is instant rollback, no redeploy.

/**
 * New Professional activation model. When ON, approving a PROFESSIONAL applicant
 * no longer auto-grants a free membership: they become "Approved — Not Activated"
 * and are offered $30 activation. Studios and the flag-OFF path are unaffected.
 *
 * Keep OFF in production until the activation flow (Slices 3–4) is built + tested,
 * so an approved professional is never stranded without a way to activate.
 */
export function isProfessionalActivationEnabled(): boolean {
  return process.env.PROFESSIONAL_ACTIVATION_ENABLED === "true";
}
