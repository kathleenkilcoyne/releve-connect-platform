// Profile V2 — the visibility axis, trimmed to what the review/publish flow needs.
//
// Founder decision 2026-08-17 §7 (option D1) distinguishes two questions:
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
// HOTFIX SCOPE NOTE: the full D1 module (c8bb609) also adds
// `canViewByDirectLink` / `appearsInDiscovery` / `shouldIndex`, used by the
// public profile page and /roster/saved to gate who can SEE a profile. Those
// are a separate, larger privacy/publication UI change and are deliberately
// left out of this narrowly-scoped activation hotfix — only the pieces the
// review/publish screen itself needs (the type, the publish-time normalizer,
// and the member-facing copy) are here.
//
// Pure and dependency-free so the rules can be unit-tested without a database.

export const VISIBILITY_VALUES = ["public", "unlisted"] as const;
export type Visibility = (typeof VISIBILITY_VALUES)[number];

export function isVisibility(v: unknown): v is Visibility {
  return typeof v === "string" && (VISIBILITY_VALUES as readonly string[]).includes(v);
}

/**
 * Normalize a submitted visibility value, falling back to what the profile
 * already had. Used by the publish action so an unrecognised or missing value
 * can never silently widen someone's exposure.
 */
export function normalizeVisibility(submitted: unknown, current: unknown): Visibility {
  if (isVisibility(submitted)) return submitted;
  if (isVisibility(current)) return current;
  return "public";
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
