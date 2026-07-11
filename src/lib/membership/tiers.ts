// The membership tiers, in one place — matching the ratified pricing Single
// Source of Truth (docs/Releve_Pricing_RATIFIED_2026-06-25_…). Prices are ANNUAL
// and in cents. Names are the ratified names (Live Pass / Professional /
// Professional·Full · Studio Connect / Growth / Accelerator).
//
// IMPORTANT (build spec §17): annual billing only, no monthly, no "$10" anywhere.
// `account_type` is identity; what someone BOUGHT is captured by a membership row
// keyed on the tier `slug` below — never in account_type.

/** The $30 application fee (build spec §4). Vetted Professional tier only. */
export const APPLICATION_FEE_CENTS = 3_000;

export type TierSlug =
  | "live_pass"
  | "professional"
  | "professional_full"
  | "studio_connect"
  | "studio_growth"
  | "studio_accelerator";

export type MembershipTier = {
  slug: TierSlug;
  label: string;
  priceCents: number;
  side: "individual" | "studio";
  /** True only for the vetted profile tiers — these go through /apply + the $30 fee. */
  applicationRequired: boolean;
  /** True if this tier grants a built, vetted Roster profile (Professional and up). */
  hasProfile: boolean;
  /** Env var holding this tier's recurring (yearly) Stripe Price id (test → live swap). */
  priceEnvVar: string;
};

export const TIERS: Record<TierSlug, MembershipTier> = {
  live_pass: {
    slug: "live_pass",
    label: "Live Pass",
    priceCents: 9_900, // $99
    side: "individual",
    applicationRequired: false, // door-opener: no vetting, no built profile
    hasProfile: false,
    priceEnvVar: "STRIPE_PRICE_LIVE_PASS",
  },
  professional: {
    slug: "professional",
    label: "Professional",
    priceCents: 14_900, // $149 — the "build a profile" gate opens here
    side: "individual",
    applicationRequired: true,
    hasProfile: true,
    priceEnvVar: "STRIPE_PRICE_PROFESSIONAL",
  },
  professional_full: {
    slug: "professional_full",
    label: "Professional · Full",
    priceCents: 19_900, // $199 — multi-role + Marketplace/Audition Library
    side: "individual",
    applicationRequired: true,
    hasProfile: true,
    priceEnvVar: "STRIPE_PRICE_PROFESSIONAL_FULL",
  },
  studio_connect: {
    slug: "studio_connect",
    label: "Studio Connect",
    priceCents: 24_900, // $249
    side: "studio",
    applicationRequired: false, // studios are the employer/buyer side — no vetting fee
    hasProfile: false,
    priceEnvVar: "STRIPE_PRICE_STUDIO_CONNECT",
  },
  studio_growth: {
    slug: "studio_growth",
    label: "Studio Growth",
    priceCents: 49_900, // $499 (recurring subscription — distinct from the $499 Senior Spotlight one-time buy)
    side: "studio",
    applicationRequired: false,
    hasProfile: false,
    priceEnvVar: "STRIPE_PRICE_STUDIO_GROWTH",
  },
  studio_accelerator: {
    slug: "studio_accelerator",
    label: "Studio Accelerator",
    priceCents: 149_900, // $1,499
    side: "studio",
    applicationRequired: false,
    hasProfile: false,
    priceEnvVar: "STRIPE_PRICE_STUDIO_ACCELERATOR",
  },
};

/** The tiers an applicant can be approved into (the vetted, profile-bearing ones). */
export const VETTED_TIERS: TierSlug[] = ["professional", "professional_full"];

export function getTier(slug: string): MembershipTier | null {
  return (TIERS as Record<string, MembershipTier>)[slug] ?? null;
}

/** The recurring yearly Stripe Price id for a tier (from env; null until created). */
export function stripePriceId(slug: TierSlug): string | null {
  return process.env[TIERS[slug].priceEnvVar] || null;
}

/** Format cents as a plain dollar string, e.g. 14900 -> "$149". */
export function dollars(cents: number): string {
  return cents % 100 === 0
    ? `$${cents / 100}`
    : `$${(cents / 100).toFixed(2)}`;
}
