// Server-side feature flag for the Professional Offerings rollout.
//
// Kept OUT of the pure logic (this module reads process.env). The flag defaults
// OFF so merging the code changes NOTHING in production until it is deliberately
// turned on — and turning it off is instant rollback, no redeploy. With the flag
// OFF: the editor "My Offerings" section is not rendered, the public "What I
// Offer" section is not queried or shown, and the (later) offering server actions
// refuse. Existing Professional Profiles render exactly as they do today.
//
// Mirrors the membership-model flag pattern (process.env.<NAME>_ENABLED === "true").

/**
 * Professional Offerings feature. When ON, activated professionals can build a
 * "My Offerings" catalog in the Profile Editor and their active offerings render
 * under "What I Offer" on the public profile. Keep OFF in production until the
 * editor + public render + CTA slices are built, tested, and approved.
 */
export function isProfessionalOfferingsEnabled(): boolean {
  return process.env.PROFESSIONAL_OFFERINGS_ENABLED === "true";
}
