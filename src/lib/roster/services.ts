// The Roster's view of MY SERVICES — what a professional offers.
//
// ── The principle this implements (ratified 2026-08-18) ──
//   "One fact. One source of truth. Many useful places it can appear."
//
// The fact is "this professional offers Choreography". Its ONE source of truth
// is a row in `professional_offerings` (customer-facing: My Services). The
// Roster is one of the many useful places it appears — so the Roster READS that
// row. It does not keep its own vocabulary of what people offer, and nothing
// asks a member to declare the same thing twice.
//
// ── What this replaces ──
// Until 2026-08-18 the Roster filtered "what someone offers" from
// `availability_tags` where kind = 'currently' — Accepting Choreography,
// Accepting Master Classes, Available for Adjudication, Available for Guest
// Teaching. That was the same fact stored a second time, in a shape that could
// disagree with My Services and had no title, price, description or CTA.
// Migration 20260818143121 converted those tags into real services and marked
// the tags inactive. This module is the other half of that move: the Roster now
// filters on the services themselves.
//
// The legacy tags are deliberately NOT deleted yet (founder, 2026-08-18), and
// `LEGACY_AVAILABILITY_TO_SERVICE` below is what keeps every old search URL
// working while they linger — and, more importantly, keeps it working AFTER
// they are gone.

/**
 * Turn a service title into a stable Roster filter slug.
 *
 * ⚠ MUST match the SQL expression that builds `roster_profiles.service_slugs`
 * exactly (migration 20260818152849):
 *
 *     lower(btrim(regexp_replace(btrim(title), '[^a-zA-Z0-9]+', '-', 'g'), '-'))
 *
 * If one side changes, the filter silently stops matching — the whole facet
 * would return nothing and no error would be raised. `services.test.ts` pins
 * the shared cases; the migration carries the same warning.
 */
export function serviceSlug(title: string): string {
  return title
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * The four retired `kind = 'currently'` availability tags, mapped to the
 * service slug that now carries the same meaning.
 *
 * Why this exists: a studio may have bookmarked or shared
 * `/roster?avail=accepting-choreography`. Those links must keep returning
 * choreographers. While the tags are merely inactive the old path still matches
 * members who happened to hold the tag — but it would find NOBODY who joined
 * afterwards, because new members have services and no tags at all. Expanding
 * the legacy slug to its service equivalent fixes both, and keeps working once
 * the tags are finally deleted.
 *
 * This is an ALIAS for retired URLs, not a second source of truth: nothing is
 * stored against it and no member ever sees it. It can be removed once the
 * legacy links have aged out.
 */
export const LEGACY_AVAILABILITY_TO_SERVICE: Readonly<Record<string, string>> = {
  "accepting-choreography": "choreography",
  "accepting-master-classes": "master-classes",
  "available-for-adjudication": "adjudication",
  "available-for-guest-teaching": "guest-teaching",
};

/** The legacy tag slugs, for tests and for the retirement checklist. */
export const LEGACY_AVAILABILITY_SLUGS: readonly string[] = Object.keys(
  LEGACY_AVAILABILITY_TO_SERVICE,
);

/**
 * Retired SERVICE slugs, mapped to the canonical service that absorbed them.
 *
 * `private-audition-coaching` → `private-coaching` (founder, 2026-08-18):
 * "Merge Private Audition Coaching into Private Coaching as the single
 * canonical My Service. Audition Prep should remain a specialization/use case
 * of Private Coaching, not a separate top-level service."
 *
 * The top-level set is deliberately five — Choreography · Master Classes ·
 * Private Coaching · Adjudication · Guest Teaching. Specializations (Audition
 * Prep, College Audition Coaching, Technique, Solo Coaching, Career Coaching)
 * live INSIDE Private Coaching; promoting each to its own service would turn My
 * Services into twenty near-identical buttons and make this facet useless.
 * There is no specialties schema yet, and this slice deliberately does not add
 * one — the decision is recorded in DECISIONS.md until there is something to
 * build.
 *
 * This is an alias for retired URLs, not a second source of truth: nothing is
 * stored against it, and no member ever sees it.
 */
export const LEGACY_SERVICE_ALIASES: Readonly<Record<string, string>> = {
  "private-audition-coaching": "private-coaching",
};

/** Resolve one slug through the alias table. Unknown slugs pass through. */
export function canonicalServiceSlug(slug: string): string {
  return LEGACY_SERVICE_ALIASES[slug] ?? slug;
}

/**
 * Resolve a whole filter list to canonical service slugs, de-duped.
 *
 * Applied to BOTH the pure predicate and the live SQL query, so a bookmarked
 * `/roster?svc=private-audition-coaching` keeps finding the right people after
 * the merge — including members who only ever had "Private Coaching".
 */
export function canonicalServiceSlugs(slugs: readonly string[]): string[] {
  return [...new Set(slugs.map(canonicalServiceSlug))];
}

/**
 * Given the raw `avail` filter values, the service slugs a matching profile
 * could ALSO satisfy them through. Empty when none of the values is a retired
 * tag, which is the common case — a plain `general` availability filter
 * (weekends, willing to travel) expands to nothing and behaves exactly as before.
 */
export function legacyAvailabilityAsServices(availSlugs: readonly string[]): string[] {
  const out = new Set<string>();
  for (const slug of availSlugs) {
    const service = LEGACY_AVAILABILITY_TO_SERVICE[slug];
    // Resolved through the alias table too, so a tag whose service is later
    // merged into another keeps pointing at whatever now carries the meaning.
    if (service) out.add(canonicalServiceSlug(service));
  }
  return [...out];
}

/** One option in the Roster's "Services" filter — derived, never curated. */
export type ServiceOption = { slug: string; label: string };

/**
 * Build the filter pick-list from the services members have actually created.
 *
 * Derived on purpose: there is no vocabulary table to drift from My Services,
 * and a member who invents "Competition Cleaning" becomes findable by it
 * without an admin adding a term first. Titles that slugify identically
 * collapse to one option, and the first title seen supplies the label.
 */
export function toServiceOptions(titles: readonly string[]): ServiceOption[] {
  const bySlug = new Map<string, string>();
  for (const raw of titles) {
    const label = raw.trim();
    if (!label) continue;
    const slug = serviceSlug(label);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, label);
  }
  return [...bySlug.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
