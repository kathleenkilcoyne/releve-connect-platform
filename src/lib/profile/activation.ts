// Profile V2 — activation: when a professional profile comes into existence,
// and what it is seeded with.
//
// ── The ratified journey (founder decisions, 2026-08-17) ──
//   Apply → Relevé accepts → activate/pay → Relevé creates the DRAFT profile
//   → member reviews/completes → member publishes
//
// An application is NOT a profile. Nobody gets a `talent_profiles` row for
// submitting an application, and approval alone is not enough either. The
// profile is created at ACTIVATION: approved AND an active profile-bearing
// membership (paid, or an authorized comp/founding grant).
//
// This module is PURE — no database, no Supabase, no env, no React. It answers
// two questions and nothing else:
//
//   1. resolveActivationBasis() — is this person eligible, and on what grounds?
//   2. buildProfileSeed()       — what does their draft profile start out as?
//
// Keeping it dependency-free is what lets the two rules that must not silently
// break (CLAUDE.md guardrail #6) be unit-tested without a database: the gate that
// decides who gets a professional identity, and the mapping that decides which
// application answers become public.
//
// The caller (the activation service, next slice) does the I/O: it loads the
// application + membership rows, calls in here, and writes the result once.

import { hasActiveProfileTierFromRows } from "@/lib/membership/access";

/* ─────────────────────────────  Eligibility  ────────────────────────────── */

/** The membership shape the gate reads (same as @/lib/membership/access). */
export type MembershipRow = { tier: string; membership_status: string };

/** The minimum we need to know about an application to judge eligibility. */
export type ApplicationRef = {
  application_id: string;
  /** The lifecycle state: draft | submitted | in-review | approved | more-info | declined. */
  state: string;
};

/**
 * WHY this profile is allowed to exist. Recorded so provenance is explicit
 * rather than inferred — `prefilled_from_application_id` is written from it.
 *
 * - `approved_application`: the normal path. Vetted, accepted, then activated.
 * - `founding_grant`: an INVITED Founding Professional. They never applied, so
 *   there is no application to seed from and nothing to prefill. Their identity
 *   (distinction + Verified mark) is stamped from the server-side grant.
 * - `private_invite`: a privately invited professional (2026-08-24) — same
 *   "never applied" shape as `founding_grant`, but deliberately NOT the same
 *   basis: the caller must never set founder_distinction for this kind. See
 *   @/lib/invited-professional/invited-professional, a structurally separate
 *   module from Founding Professional's.
 */
export type ActivationBasis =
  | { kind: "approved_application"; applicationId: string }
  | { kind: "founding_grant" }
  | { kind: "private_invite" };

export type ActivationInput = {
  /** The person's most recent application, if they ever made one. */
  application: ApplicationRef | null;
  /** Do they hold an active, non-revoked Founding Professional grant? */
  hasFoundingGrant: boolean;
  /**
   * Do they hold an active, non-revoked private invitation? Optional so every
   * existing caller/test that predates this basis keeps compiling and behaving
   * identically — omitting it is the same as passing false.
   */
  hasPrivateInvite?: boolean;
  /** Every membership row for this user (the caller passes them all). */
  membershipRows: MembershipRow[];
};

/** The single state that means Relevé has accepted someone. */
export const APPROVED_STATE = "approved";

/**
 * The live Open-To badge meaning "auditioning via The Beat".
 *
 * Founder decision 2026-08-17 §4 + option (a): `auditioning_for` must not become
 * a permanent résumé fact. The application asks WHICH outside-industry
 * categories someone is auditioning for (Commercial, Cruise/Theme Park, Film/TV
 * …), but the live Open-To vocabulary is about participating IN Relevé
 * (teaching-new-classes, substituting, licensing, auditioning, speaking,
 * social-posting). Those are different axes, so the categories are NOT forced
 * into badge rows — that would dilute what an Open-To badge means.
 *
 * Instead: answering the question at all sets this ONE existing badge, which is
 * a true statement about a current interest and is member-editable afterwards.
 * The specific categories stay in the application, which is preserved forever,
 * and can become a deliberate "currently seeking" field in a later slice.
 */
export const AUDITIONING_BADGE_SLUG = "auditioning";

/**
 * Decide whether a professional profile may be created, and on what grounds.
 * Returns null when it may NOT be — the caller creates nothing.
 *
 * The rule, in order:
 *   1. An ACTIVE PROFILE-BEARING membership is required, always. This is the
 *      "paid OR authorized comp" half, and it is deliberately delegated to
 *      hasActiveProfileTierFromRows rather than reimplemented — comps and
 *      founding grants are real `memberships` rows (source = 'founding_comp' /
 *      'founder_permanent' / 'comp_12mo'), so one predicate already covers
 *      paid and complimentary alike. Live Pass is excluded because its tier
 *      carries hasProfile = false: buying the $99 door-opener has never granted
 *      a Roster profile and must not start now.
 *   2. THEN the vetting half: an approved application, or an invited founding
 *      grant. An active membership with neither is not enough — that is a
 *      studio-tier holder or a comp granted in error, and neither is a vetted
 *      professional.
 *
 * Note the asymmetry is intentional: membership is necessary but never
 * sufficient. Money alone does not make someone a Relevé Professional.
 */
export function resolveActivationBasis(input: ActivationInput): ActivationBasis | null {
  if (!hasActiveProfileTierFromRows(input.membershipRows)) return null;

  if (input.application && input.application.state === APPROVED_STATE) {
    return { kind: "approved_application", applicationId: input.application.application_id };
  }
  if (input.hasFoundingGrant) return { kind: "founding_grant" };
  if (input.hasPrivateInvite) return { kind: "private_invite" };

  return null;
}

/* ───────────────────────  The application payload shape  ────────────────── */
// Mirrors the `answers` jsonb written by src/app/apply/actions.ts. Every field
// is optional because a draft, an older submission, or a role-branched section
// the applicant never saw will legitimately be absent.

export type ApplicationAnswers = {
  identity?: {
    first_name?: string;
    last_name?: string;
    city?: string;
    state_province?: string;
    country?: string;
    age_range?: string;
    // email / mobile deliberately NOT read here — see ADMIN_ONLY_FIELDS.
  };
  roles?: string[];
  primary_role?: string;
  story?: { bio?: string; years_experience?: string };
  industry?: {
    studios_companies?: string;
    notable_credits?: string;
    unions?: string[];
    certifications?: string;
    degrees?: string[];
  };
  teaching?: {
    philosophy?: string;
    levels?: string[];
    styles?: string[];
    adaptive_experience?: string;
    currently_teaching?: string;
  } | null;
  choreographer?: {
    focus_areas?: string[];
    years?: string;
    work_links?: string[];
  } | null;
  working_dancer?: {
    training?: string;
    performance?: string;
    auditioning_for?: string[];
  } | null;
  digital_presence?: {
    website?: string;
    instagram?: string;
    vimeo?: string;
    youtube?: string;
    linkedin?: string;
    headshot_url?: string;
    resume_url?: string;
    teaching_reel?: string;
    choreography_reel?: string;
    performance_reel?: string;
  };
  open_to?: string[];
};

/**
 * Application content that must NEVER reach a profile, listed explicitly so the
 * boundary is reviewable rather than implied by omission.
 *
 * `alignment` is prose written TO Relevé about why Relevé matters to them —
 * publishing it would repurpose a private answer as marketing copy.
 * `work_authorization` is employment-eligibility data. `mobile` and `email` are
 * contact details, and contact stays private by default (Open Decision 2).
 * `studio_owner` belongs to the employer side, not a talent profile.
 * `consents` is a legal record. The vetting metadata is process, not identity.
 */
export const ADMIN_ONLY_FIELDS = [
  "alignment",
  "work_authorization",
  "consents",
  "identity.email",
  "identity.mobile",
  "studio_owner",
  "teaching.available_to_sub",
  "choreographer.available_to_license",
  "draft_fields",
  "admin_notes",
  "reviewed_by",
  "reviewed_at",
] as const;

/* ─────────────────────────────  The seed  ───────────────────────────────── */

/** A credential badge rendered from evidence (profile_credentials). */
export type SeedCredential = { kind: "degree" | "certification" | "union"; value: string };

/**
 * One entry in `talent_profiles.video_reels`. The column's designed shape,
 * unused until now — reels are distinguishable BY PURPOSE (founder decision
 * §4), not one generic video field.
 */
export type SeedReel = {
  label: string;
  url: string;
  kind: "teaching" | "choreography" | "performance" | "work";
  order: number;
};

/** Everything a freshly-activated draft profile starts out as. */
export type ProfileSeed = {
  /** Columns written directly onto the talent_profiles row. */
  profile: {
    display_name: string;
    primary_role: string | null;
    city: string | null;
    state_province: string | null;
    country: string | null;
    age_range: string | null;
    bio: string | null;
    years_experience: string | null;
    credentials: string | null;
    teaching_at: string | null;
    teaching_philosophy: string | null;
    adaptive_experience: string | null;
    choreographer_years: string | null;
    teaching_reel_url: string | null;
    social_links: Record<string, string>;
    video_reels: SeedReel[];
  };
  /** Controlled-vocabulary slugs → the existing join tables. Exact matches. */
  roles: string[];
  styles: string[];
  levels: string[];
  focusAreas: string[];
  openTo: string[];
  /** → profile_credentials, the table built for degrees/unions and never used. */
  credentials: SeedCredential[];
  /**
   * Assets the application captured as EXTERNAL URLs that we will not fetch
   * (founder decision §5: never pull arbitrary third-party URLs into our
   * storage). Carried as context so the review step can show the member what
   * they gave us and ask them to upload or confirm it — rather than pretending
   * we never had it.
   */
  carriedAssets: { headshotUrl: string | null; resumeUrl: string | null };
};

const clean = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

/**
 * Build the one-time seed for a newly-activated professional's DRAFT profile.
 *
 * Pure and total: any missing section yields empty values rather than throwing,
 * because a real application may legitimately lack any role-branched section.
 *
 * This runs ONCE, at activation. It is not a sync — after this the profile is
 * the member's own record and the application is frozen history. Nothing here
 * ever writes back to the application.
 */
export function buildProfileSeed(
  answers: ApplicationAnswers | null,
  fallback: { displayName: string },
): ProfileSeed {
  const a = answers ?? {};
  const identity = a.identity ?? {};
  const story = a.story ?? {};
  const industry = a.industry ?? {};
  const teaching = a.teaching ?? null;
  const choreo = a.choreographer ?? null;
  // Only `auditioning_for` is read from this section, and only as a signal (see
  // AUDITIONING_BADGE_SLUG below). Its `training` and `performance` answers are
  // career history, deferred to the structured career-history slice (founder
  // decision §6 — no blob-per-row shortcuts). Both remain preserved in the
  // application, which is never discarded.
  const dancer = a.working_dancer ?? null;
  const digital = a.digital_presence ?? {};

  const name =
    [clean(identity.first_name), clean(identity.last_name)].filter(Boolean).join(" ") ||
    fallback.displayName;

  // Social links: only the keys the profile actually renders, only when present.
  // The builder additionally offers facebook/tiktok, which the application has
  // never asked for — they simply start empty.
  const social: Record<string, string> = {};
  for (const k of ["website", "instagram", "vimeo", "youtube", "linkedin"] as const) {
    const v = clean(digital[k]);
    if (v) social[k] = v;
  }

  // Reels, distinguishable by purpose. The teaching reel is ALSO promoted to
  // `teaching_reel_url` because that is the hero video above the fold; keeping it
  // in video_reels too would render it twice, so it is deliberately excluded here.
  const reels: SeedReel[] = [];
  let order = 0;
  const choreoReel = clean(digital.choreography_reel);
  if (choreoReel) reels.push({ label: "Choreography reel", url: choreoReel, kind: "choreography", order: order++ });
  const perfReel = clean(digital.performance_reel);
  if (perfReel) reels.push({ label: "Performance reel", url: perfReel, kind: "performance", order: order++ });
  // The choreographer's "Your work" links (up to 3) — professional work, not a
  // showreel, so they carry their own kind rather than being mislabelled.
  list(choreo?.work_links).forEach((url, i) => {
    const u = clean(url);
    if (u) reels.push({ label: `Work ${i + 1}`, url: u, kind: "work", order: order++ });
  });

  // Credential badges from evidence. ONLY the discrete, list-valued answers —
  // unions[] and degrees[] are arrays of real values. The free-text
  // `certifications` blob is NOT split into rows here (founder decision §6: no
  // blob-per-row shortcuts); it stays whole in `credentials` until the structured
  // career-history slice is built deliberately.
  const credentials: SeedCredential[] = [
    ...list(industry.unions)
      .filter((u) => u.toLowerCase() !== "none")
      .map((value): SeedCredential => ({ kind: "union", value })),
    ...list(industry.degrees).map((value): SeedCredential => ({ kind: "degree", value })),
  ];

  return {
    profile: {
      display_name: name,
      primary_role: clean(a.primary_role),
      city: clean(identity.city),
      state_province: clean(identity.state_province),
      country: clean(identity.country),
      age_range: clean(identity.age_range),
      bio: clean(story.bio),
      years_experience: clean(story.years_experience),
      credentials: clean(industry.certifications),
      teaching_at: clean(teaching?.currently_teaching),
      teaching_philosophy: clean(teaching?.philosophy),
      adaptive_experience: clean(teaching?.adaptive_experience),
      choreographer_years: clean(choreo?.years),
      teaching_reel_url: clean(digital.teaching_reel),
      social_links: social,
      video_reels: reels,
    },
    roles: list(a.roles),
    styles: list(teaching?.styles),
    levels: list(teaching?.levels),
    focusAreas: list(choreo?.focus_areas),
    // Self-selected Open-To badges, plus the auditioning signal derived from the
    // working-dancer section. Deduped: an applicant who ticked "auditioning"
    // themselves AND named audition categories gets one badge, not two.
    openTo: Array.from(
      new Set([
        ...list(a.open_to),
        ...(list(dancer?.auditioning_for).length > 0 ? [AUDITIONING_BADGE_SLUG] : []),
      ]),
    ),
    credentials,
    carriedAssets: {
      headshotUrl: clean(digital.headshot_url),
      resumeUrl: clean(digital.resume_url),
    },
  };
}

/**
 * The seed a Founding Professional starts from. They were INVITED, never
 * applied, so there is nothing to carry across — only their name. Their
 * distinction and Verified mark come from the server-side grant, never from here
 * and never from a form.
 */
export function buildFoundingSeed(displayName: string): ProfileSeed {
  return buildProfileSeed(null, { displayName });
}

/* ──────────────────────  Draft + privacy at creation  ───────────────────── */

/**
 * What a profile looks like the moment Relevé creates it.
 *
 * DRAFT, always (founder decision §1: "create it as draft, never automatically
 * published"). Creation and publication are separate acts — activation gives
 * someone a professional identity to review; only the member makes it live.
 *
 * `visibility` is the SECOND axis and is not decided here. It governs
 * discoverability once published, defaults to 'public', and — unlike today's
 * saveProfile, which rewrites visibility on every single save — is never
 * overwritten again by anything but the member's own choice.
 */
export const ACTIVATION_PROFILE_STATUS = "draft" as const;
export const ACTIVATION_DEFAULT_VISIBILITY = "public" as const;
