// What each membership pathway GIVES you, in the member's own language.
//
// ── Why this is not in tiers.ts ──
// `tiers.ts` is the pricing canon — slug, price, label, entitlement flags — and
// the payment sprint brief is explicit that no slug, price or label may change.
// Marketing copy changes on a different clock than pricing does, so it lives
// here and imports the slugs rather than editing them.
//
// ── Everything below is founder copy, verbatim (2026-08-18). Do not reword. ──
// It SUPERSEDES the tier descriptions in
// `docs/Releve_Pricing_RATIFIED_2026-06-25_…`, which described Live Pass as a
// professional "door-opener" and the others as feature lists. See DECISIONS.md.
// If a pathway's copy is not ratified, it does not get invented here.

/** The four primary membership pathways, in the ratified presentation order. */
export type PathwayKey = "professional" | "creator" | "studio" | "live_pass";

export type PathwayCopy = {
  /** The eyebrow name, rendered after the gold numeral: "01 · PROFESSIONAL". */
  name: string;
  /** The editorial one-liner. The one place italics are used on this page. */
  tagline: string;
  /** The paragraph beneath the tagline. Regular weight — never bolded whole. */
  description: string;
  /** What it includes. */
  includes: string[];
  /**
   * The default call to action. The VERB carries the difference between
   * pathways (Apply / Explore / Join); the button styling never does.
   */
  cta: string;
  /**
   * The key value phrases to set in semibold inside `includes` (founder
   * direction, 2026-08-18: "bold only these key value phrases"). Everything
   * else stays regular weight — hierarchy comes from scale, colour and space,
   * not from bolding half the page.
   *
   * Matched case-insensitively, longest first. Each entry MUST occur in this
   * pathway’s `includes`; `tier-copy.test.ts` fails the build if one is
   * orphaned by a copy edit.
   */
  emphasis: string[];
};

export const PATHWAY_COPY: Record<PathwayKey, PathwayCopy> = {
  professional: {
    name: "Professional",
    tagline: "For working dance professionals ready to be seen, connected and hired.",
    description:
      "Build your vetted Professional Roster profile and bring your experience, credentials, media, availability and professional services into one Relevé home.",
    includes: [
      "Vetted Professional Roster profile",
      // Restored verbatim (founder correction, 2026-08-18). "Be discovered" is
      // the value the tier sells — being findable by studios — and a summary of
      // the same bullet as "Teaching, performance, Swing and professional
      // opportunities" lost it. Exact language over approximation where the
      // language carries product meaning.
      "Be discovered for teaching, performance, Swing, and professional opportunities.",
      "Professional Services through your profile",
    ],
    cta: "Apply to the Professional Roster",
    emphasis: ["Vetted Professional Roster", "Be discovered", "Professional Services"],
  },

  creator: {
    name: "Creator",
    tagline: "For choreographers and creators ready to make their work work for them.",
    description:
      "Everything in Professional, plus the infrastructure to build a catalogue, license eligible work and create new revenue from what you have already made.",
    includes: [
      "Everything included in Professional",
      // Restored verbatim (founder correction, 2026-08-18). "your choreography"
      // is the point of the tier — the work is the creator's, and Relevé takes
      // a marketplace share of a product, never a cut of anyone's wage
      // (CLAUDE.md guardrail #1). Dropping "your" quietly loses that.
      "License and monetize your choreography and eligible creative work.",
      "Build a catalogue of past and present work",
      "Offer eligible creative services and creator products",
    ],
    cta: "Apply as a Creator",
    // "Relevé catalogue / past and present work" is emphasised as one span,
    // because the copy carries the idea contiguously ("a catalogue of past and
    // present work") — confirmed by Kathleen, 2026-08-18.
    emphasis: [
      "License and monetize your choreography",
      "catalogue of past and present work",
    ],
  },

  // One peer covering all three studio tiers — three separately priced cards
  // would outnumber and bury the other pathways. No price is shown: studio
  // onboarding is invite-led rather than self-serve (DECISIONS 2026-07-24), so
  // the tier is chosen with Relevé. Per-tier prices still appear on the purchase
  // buttons for an organization eligible to buy, so nobody picks a tier blind.
  studio: {
    name: "Studio / Arts Organization",
    tagline:
      "For studios, schools, companies and arts organizations building stronger dance communities.",
    description:
      "Connect with vetted professionals, organize your people and programming, and participate in the broader Relevé ecosystem.",
    includes: [
      "Find and connect with vetted dance professionals",
      "Manage faculty, dancers and organizational activity",
      "This Week scheduling and communication",
      "Relevé programming, resources and professional network",
    ],
    cta: "Explore Studio / Arts Organization",
    // Founder list: "vetted dance professionals", "This Week", "manage faculty
    // and dancers", "Relevé professional network". Mapped to the nearest
    // existing phrases:
    //   "manage faculty and dancers"  → copy reads "Manage faculty, dancers and…"
    //   "Relevé professional network" → copy reads "Relevé programming,
    //     resources and professional network", so the network half is emphasised
    emphasis: [
      "vetted dance professionals",
      "This Week",
      "Manage faculty, dancers",
      "professional network",
    ],
  },

  // Priced per FAMILY, not per person — the unit is the household.
  live_pass: {
    name: "Live Pass",
    tagline: "For dancers and families who want to be part of Relevé.",
    description:
      "A family membership connecting dancers to resources, opportunities, programming and the larger Relevé community.",
    includes: [
      "Build your dancer’s Relevé Passport",
      "Access the College Audition Cycle",
      "Join Relevé live programming, conversations and special events",
      "Follow Relevé news, resources and community",
      "Purchase and license eligible choreography and creative work",
    ],
    cta: "Join Live Pass",
    // Founder list: "Relevé Passport", "College Audition Cycle", "live Relevé
    // programming", "purchase and license eligible choreography".
    //   "live Relevé programming" → the copy reads "Relevé live programming"
    //     (same words, different order); emphasised as written.
    emphasis: [
      "Relevé Passport",
      "College Audition Cycle",
      "Relevé live programming",
      "Purchase and license eligible choreography",
    ],
  },
};

export function pathwayCopy(key: PathwayKey): PathwayCopy {
  return PATHWAY_COPY[key];
}
