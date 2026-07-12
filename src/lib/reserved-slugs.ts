// Slugs a member may NOT claim as their public handle, because a root-level
// profile URL (releveconnect.com/<handle>) shares the namespace with the app's
// real routes. Next.js matches a static route (e.g. /apply) before the dynamic
// [handle] segment, so a profile whose handle collided with one of these would
// simply be unreachable — we reject the handle up front instead.
//
// Keep this in sync with the top-level folders in src/app plus a margin of
// reserved words for routes we're likely to add. Lowercase, no slashes.

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Current top-level app routes
  "admin",
  "api",
  "apply",
  "auth",
  "connect",
  "experiences",
  "login",
  "profile",
  "setup-check",
  "subscribe",
  "talent",
  // Next.js / framework internals
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  // Reserved for likely future surfaces
  "roster",
  "search",
  "swing",
  "marketplace",
  "beat",
  "the-beat",
  "studios",
  "studio",
  "account",
  "settings",
  "dashboard",
  "about",
  "help",
  "terms",
  "privacy",
  "contact",
  "signout",
  "signup",
  "signin",
  "logout",
]);

/** True if `slug` is reserved and must not be used as a public handle. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}
