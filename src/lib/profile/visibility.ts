// Profile V2 — the two axes of publication, kept genuinely separate.
//
// Founder decision 2026-08-17 §7 (option D1). These are DIFFERENT questions and
// conflating them is what produced the bug this module fixes:
//
//   profile_status  draft | published   → has the member deliberately made their
//                                         profile live at all?
//   visibility      public | unlisted   → once live, how discoverable is it?
//
// Activation creates a DRAFT. Publishing is an explicit member action. Only then
// does visibility mean anything.
//
//   public    an intentionally public profile: on the Roster, indexable
//   unlisted  link-only: anyone with the direct URL can view it, but it is
//             excluded from the Roster and asks search engines not to index it
//
// `members_only` is deliberately NOT a value here — that is a larger
// Roster-access decision to be made on its own.
//
// Pure and dependency-free so the rules can be unit-tested without a database.
// Every read path that shows a profile should ask THIS module rather than
// re-deriving the comparison inline, which is how `/roster/saved` ended up
// showing drafts.

export const VISIBILITY_VALUES = ["public", "unlisted"] as const;
export type Visibility = (typeof VISIBILITY_VALUES)[number];

export const PUBLISH_STATUSES = ["draft", "published"] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export function isVisibility(v: unknown): v is Visibility {
  return typeof v === "string" && (VISIBILITY_VALUES as readonly string[]).includes(v);
}

/**
 * Normalize a submitted visibility value, falling back to what the profile
 * already had. Used by saveProfile so an unrecognised or missing value can never
 * silently widen someone's exposure — the previous behaviour, which hardcoded
 * `'public'` on every single save and would have overwritten a member's choice
 * the instant they edited anything.
 */
export function normalizeVisibility(submitted: unknown, current: unknown): Visibility {
  if (isVisibility(submitted)) return submitted;
  if (isVisibility(current)) return current;
  return "public";
}

export type ProfileVisibilityState = {
  profileStatus: string | null;
  visibility: string | null;
};

/**
 * Can someone who has the direct URL view this profile?
 *
 * TRUE for published + public AND published + unlisted — that is what makes
 * `unlisted` mean "link-only" rather than "invisible". Before Profile V2 an
 * unlisted profile 404'd for everyone, so the value was honoured on read but
 * useless in practice.
 *
 * A draft is viewable only by its owner, who sees a draft-preview banner.
 */
export function canViewByDirectLink(p: ProfileVisibilityState, isOwner = false): boolean {
  if (isOwner) return true;
  return p.profileStatus === "published" && isVisibility(p.visibility);
}

/**
 * Should this profile appear in discovery — the Roster, saved lists, anywhere
 * Relevé surfaces people who did not hand over their own link?
 *
 * Published + public only. This mirrors the `roster_profiles` view's WHERE
 * clause, which already filters on exactly these two columns, so the Roster
 * needed no change; the value of stating it here is that every OTHER discovery
 * surface can ask the same question instead of inventing its own filter.
 */
export function appearsInDiscovery(p: ProfileVisibilityState): boolean {
  return p.profileStatus === "published" && p.visibility === "public";
}

/**
 * Should search engines index this profile?
 *
 * Only an intentionally public one. An unlisted profile gets `noindex`, which is
 * the difference between "link-only" as a promise and "link-only" as a fact —
 * without it, one crawl of a shared link puts the page in Google anyway.
 *
 * Note the site still has no robots.txt; this is a per-page directive and does
 * not depend on one.
 */
export function shouldIndex(p: ProfileVisibilityState): boolean {
  return appearsInDiscovery(p);
}

/** Member-facing copy, so the meaning is stated in one place and not paraphrased. */
export const VISIBILITY_COPY: Record<Visibility, { label: string; help: string }> = {
  public: {
    label: "Public",
    help: "Anyone can find you on the Relevé Roster, and search engines may show your page. This is how studios discover you.",
  },
  unlisted: {
    label: "Unlisted — link only",
    help: "Only people you send your link to can see your page. You will not appear on the Roster, and we ask search engines not to index it.",
  },
};
