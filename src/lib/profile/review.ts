// Profile V2 — the first-run review.
//
// Activation creates a DRAFT and seeds it once from the accepted application.
// This module works out what to SHOW the member at that moment:
//
//   "Your approved application has started your Relevé profile. Review your
//    information, add or update your presentation and media, choose your privacy
//    settings, and publish when you're ready."
//
// Two audiences land here and they are not the same:
//   · An APPROVED APPLICANT arrives with most of it filled in. Their job is to
//     check it, add media, and publish.
//   · An invited FOUNDING PROFESSIONAL arrives with a name and nothing else,
//     because they were invited rather than vetted through the queue and never
//     filled in an application. Telling them to "review what we carried across"
//     would be nonsense — there is nothing to review.
//
// Pure and dependency-free so the checklist and the readiness rules can be
// unit-tested without a database or React.

import type { Visibility } from "./visibility";

/* ─────────────────────────────  The checklist  ──────────────────────────── */

export type ChecklistItem = {
  key: string;
  label: string;
  /** Why it matters, in the member's terms — never "field required". */
  why: string;
  done: boolean;
  /** Essentials make a Roster card meaningful; the rest strengthen the profile. */
  essential: boolean;
};

/** The profile fields the review screen reasons about. */
export type ReviewProfile = {
  display_name: string | null;
  headshot_url: string | null;
  bio: string | null;
  primary_role: string | null;
  city: string | null;
  teaching_reel_url: string | null;
  resume_url: string | null;
  social_links: Record<string, string> | null;
  gallery_urls: string[] | null;
  profile_status: string | null;
  visibility: string | null;
};

const filled = (v: unknown): boolean =>
  typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : Boolean(v);

/**
 * Build the review checklist. Counts of styles/levels are passed in because they
 * live in join tables, not on the profile row.
 */
export function buildChecklist(
  p: ReviewProfile,
  counts: { styles: number; levels: number },
): ChecklistItem[] {
  return [
    {
      key: "headshot",
      label: "A headshot",
      why: "It is the first thing a studio sees on the Roster. A profile without one reads as unfinished.",
      done: filled(p.headshot_url),
      essential: true,
    },
    {
      key: "bio",
      label: "Your story",
      why: "Carried across from your application if you wrote one. This is where a studio decides you are the right person.",
      done: filled(p.bio),
      essential: true,
    },
    {
      key: "role",
      label: "What you do",
      why: "Your primary role decides which Roster category you appear under.",
      done: filled(p.primary_role),
      essential: true,
    },
    {
      key: "location",
      label: "Where you are",
      why: "Studios search by location more than by anything else.",
      done: filled(p.city),
      essential: true,
    },
    {
      key: "styles",
      label: "Styles and levels you teach",
      why: "These are the filters studios use. Without them you will not appear in a filtered search.",
      done: counts.styles > 0 || counts.levels > 0,
      essential: false,
    },
    {
      key: "video",
      label: "A featured video",
      why: "The one thing that shows how you actually move and teach. It sits at the top of your page.",
      done: filled(p.teaching_reel_url),
      essential: false,
    },
    {
      key: "resume",
      label: "Your résumé",
      why: "Your full credits, for the studios that want the detail.",
      done: filled(p.resume_url),
      essential: false,
    },
    {
      key: "links",
      label: "Where else to find you",
      why: "Website and social links let people see your work beyond Relevé.",
      done: Object.keys(p.social_links ?? {}).length > 0,
      essential: false,
    },
    {
      key: "gallery",
      label: "Photos",
      why: "A few performance or teaching photos make the page feel like you.",
      done: (p.gallery_urls ?? []).length > 0,
      essential: false,
    },
  ];
}

export function essentialsRemaining(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((i) => i.essential && !i.done);
}

export function completionCount(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/**
 * May this member publish?
 *
 * A HARD GATE on the four essentials — headshot, story, what you do, where you
 * are — and on nothing else (founder decision 2026-08-17).
 *
 * The principle: approval establishes that someone belongs on Relevé; these four
 * establish that their public profile is complete enough to represent both them
 * AND the Roster. A card with no photo, no story, no role and no location is not
 * a professional profile, and every one of them published weakens the Roster for
 * everyone already on it.
 *
 * The other five items stay RECOMMENDATIONS and must never block publication.
 * A member without a showreel is still a professional.
 */
export function canPublish(items: ChecklistItem[]): boolean {
  return essentialsRemaining(items).length === 0;
}

/**
 * Why a publish attempt was refused, in the member's own terms — for the server
 * action, which must state the reason rather than fail silently.
 */
export function publishBlockedMessage(items: ChecklistItem[]): string {
  const missing = essentialsRemaining(items).map((i) => i.label.toLowerCase());
  if (missing.length === 0) return "";
  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  return `Your profile still needs ${list}. It stays a private draft until then — these are what make your page worth a studio's attention.`;
}

/* ──────────────────────────  Assets we already hold  ────────────────────── */

/**
 * A headshot or résumé URL the applicant gave us that is NOT in Relevé storage.
 *
 * Founder decision §5: never fetch arbitrary third-party URLs into our own
 * storage. But equally, do not make someone repeat work we already possess. So
 * the application's URL is SHOWN back to them — "you gave us this; upload it or
 * confirm it" — instead of being silently dropped.
 */
export type CarriedAsset = {
  kind: "headshot" | "resume";
  url: string;
  /** True once the member has a Relevé-hosted version, making this redundant. */
  satisfied: boolean;
};

/** Anything hosted by us — our own storage or a signed Supabase URL. */
export function isReleveHosted(url: string | null | undefined): boolean {
  if (!url) return false;
  return /supabase\.co\/storage\//i.test(url);
}

/**
 * Which application assets still need the member's attention. Returns [] when
 * they gave us nothing, or when they have already uploaded their own.
 */
export function carriedAssetsNeedingAttention(
  fromApplication: { headshotUrl: string | null; resumeUrl: string | null },
  profile: { headshot_url: string | null; resume_url: string | null },
): CarriedAsset[] {
  const out: CarriedAsset[] = [];
  if (fromApplication.headshotUrl && !isReleveHosted(profile.headshot_url)) {
    out.push({ kind: "headshot", url: fromApplication.headshotUrl, satisfied: false });
  }
  if (fromApplication.resumeUrl && !isReleveHosted(profile.resume_url)) {
    out.push({ kind: "resume", url: fromApplication.resumeUrl, satisfied: false });
  }
  return out;
}

/* ────────────────────────────  Which welcome  ───────────────────────────── */

export type ReviewAudience = "seeded_from_application" | "invited_founder" | "returning";

/**
 * Which framing to show. A founder who never applied must not be told to review
 * information that was carried across, because none was.
 */
export function resolveAudience(input: {
  profileStatus: string | null;
  prefilledFromApplicationId: string | null;
}): ReviewAudience {
  if (input.profileStatus === "published") return "returning";
  return input.prefilledFromApplicationId ? "seeded_from_application" : "invited_founder";
}

export const WELCOME_COPY: Record<ReviewAudience, { heading: string; body: string }> = {
  seeded_from_application: {
    heading: "Your approved application has started your Relevé profile",
    body: "We carried across everything from your application that belongs on a professional profile, so you are not starting from a blank page. Review it, add your photo and video, choose who can find you, and publish when you're ready.",
  },
  invited_founder: {
    heading: "Welcome — your Relevé profile is ready to build",
    body: "You were invited to Relevé, so there is no application to carry across. Your distinction and Verified mark are already in place. Add your photo, your story, and your work, then publish when you're ready.",
  },
  returning: {
    heading: "Your profile is live",
    body: "Keep it current. Changes save straight away, and you can switch to unlisted or back to a draft at any time.",
  },
};

/** The publish confirmation, stated before the member acts (founder decision §7). */
export const PUBLISH_MEANING: Record<Visibility, string> = {
  public:
    "Your page goes live and you appear on the Relevé Roster, where studios and members can find you. Search engines may also show your page.",
  unlisted:
    "Your page goes live, but only people you send the link to can see it. You will not appear on the Roster, and we ask search engines not to index it.",
};
