// What each membership tier actually GIVES you, in the member's own language.
//
// ── Why this is not in tiers.ts ──
// `tiers.ts` is the pricing canon — slug, price, label, entitlement flags — and
// the payment sprint brief is explicit that no slug, price or label may change.
// Marketing copy changes on a different clock than pricing does, so it lives
// here and imports the slugs rather than editing them.
//
// ── Every line below is ratified. Nothing here is invented. ──
// Sources:
//   · Live Pass — founder clarification, 2026-08-18 (Kathleen, by email). This
//     SUPERSEDES the Live Pass row in the 2026-06-25 pricing Single Source of
//     Truth ("The Climb, The Beat, view the Roster, member events"), which
//     described Live Pass as a professional door-opener. It is a FAMILY
//     membership: $99/year for a household. See DECISIONS.md 2026-08-18.
//   · Professional / Creator / the studio tiers — the 2026-06-25 pricing SSOT,
//     with the $199 tier under its ratified customer-facing name "Creator"
//     (DECISIONS.md 2026-08-16).
//
// If a tier's copy is not ratified, it does not get invented here. Add it to
// the ratified pricing doc first.

import type { TierSlug } from "./tiers";

export type TierCopy = {
  /** One line under the price: what this membership IS. */
  tagline: string;
  /** What it includes. Rendered as a list; keep each item short and concrete. */
  includes: string[];
};

export const TIER_COPY: Record<TierSlug, TierCopy> = {
  // ── Founder clarification 2026-08-18 ──
  // "Live Pass is a real paid Relevé membership tier — $99 for a family. It is
  //  not merely a studio-access state or an upgrade lane."
  live_pass: {
    tagline: "A family membership in Relevé — for a whole household, for a year.",
    includes: [
      "Family participation in Relevé",
      "Monthly Zooms",
      "News and resources",
      "Community viewing and engagement",
      "Access to purchase or license eligible choreography",
      "The Relevé Passport",
      "The College Audition Cycle",
    ],
  },

  // Pricing SSOT 2026-06-25: "+ your vetted Roster profile (Teacher or
  // Performer), credentials in your own words, set your own rate at/above the
  // $50/hr floor. The 'build a profile' gate opens here."
  professional: {
    tagline: "The vetted Roster membership for working professionals.",
    includes: [
      "Your vetted Roster profile — Teacher or Performer",
      "Your credentials, in your own words",
      "Set your own rate, at or above the $50/hr floor",
      "Professional Services on your profile",
    ],
  },

  // Pricing SSOT 2026-06-25: "+ multi-role (Teacher/Choreographer/Performer)
  // and the Marketplace + Audition Library (upload & license your work)."
  professional_full: {
    tagline: "Everything in Professional, plus your work as your own catalogue.",
    includes: [
      "Everything in Professional",
      "Multi-role — Teacher, Choreographer and Performer",
      "The Marketplace and the Audition Library",
      "Upload and license your own work",
    ],
  },

  // Pricing SSOT 2026-06-25, studio ladder.
  studio_connect: {
    tagline: "The directory tier — be findable, and reach the community.",
    includes: [
      "Roster listing and community access",
      "The Climb, monthly",
      "3 Swing uses included, then $20 per use",
    ],
  },
  studio_growth: {
    tagline: "For studios hiring regularly through Relevé.",
    includes: [
      "Everything in Studio Connect",
      "Full Roster access",
      "The Swing included",
      "Flex à la carte, $250 per run",
      "10 Beat postings a year",
      "Verified Employer badge",
      "12 Live Passes",
    ],
  },
  studio_accelerator: {
    tagline: "For studios who staff their season through Relevé.",
    includes: [
      "Everything in Studio Growth",
      "Unlimited Swing",
      "4 Flex runs a year included, then $200 per run",
      "Unlimited Beat postings and unlimited Roster",
      "Priority placement",
      "12 Live Passes, plus 2 Financial Live Passes",
      "Semi-annual “From the Wings” founder 1:1",
    ],
  },
};

export function tierCopy(slug: TierSlug): TierCopy {
  return TIER_COPY[slug];
}
