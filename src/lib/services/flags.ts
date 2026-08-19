// Server-side feature flag for the Professional Services rollout.
//
// Kept OUT of the pure logic (this module reads process.env). The flag defaults
// OFF so merging the code changes NOTHING in production until it is deliberately
// turned on — and turning it off is instant rollback, no redeploy. With the flag
// OFF: the "Professional Services" doorway is not rendered anywhere, the public
// profile does not query or show the section, and the server actions refuse.
// Existing Professional Profiles render exactly as they do today.
//
// Mirrors the Professional Offerings flag pattern
// (process.env.<NAME>_ENABLED === "true").

/**
 * Professional Services. When ON, a professional can list other services or
 * businesses they run (massage therapy, Pilates, photography, class musicians…)
 * from /profile/services, and any they choose to display render in a
 * "Professional Services" section on their public profile.
 */
export function isProfessionalServicesEnabled(): boolean {
  return process.env.PROFESSIONAL_SERVICES_ENABLED === "true";
}
