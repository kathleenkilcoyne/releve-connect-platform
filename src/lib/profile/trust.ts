// Relevé-controlled trust signals — the vocabulary and the rules.
//
// ── The brand rule (founder, 2026-08-17) ──
//   Trust signals are CONFERRED BY RELEVÉ. They are not purchased and not
//   self-entered. A member may describe their career; they may not award
//   themselves Verified, a founding distinction, an honorific, or a
//   marketplace tier.
//
// Slice 2 removed these fields from the member's form entirely. This module is
// the other half: the admin-only path that lets Relevé confer, correct, or
// withdraw them AFTER a profile exists — because an honorific is a standing
// endorsement, not something frozen forever from the original application.
//
// Pure and dependency-free: vocabularies, validation, and the change diff that
// becomes the audit trail. No database, no React.
//
// ── What this module deliberately does NOT do ──
//   · No pricing, split, or fee logic reads `choreographer_tier`. Curation and
//     economics are separate concerns and Choreo License decides the
//     relationship between them (founder decision C).
//   · `is_founding_25` on the application is a FEE-WAIVER flag and is never read
//     here. Financial treatment and Relevé distinction are different things
//     (founder decision B): founding_25 must be conferred explicitly.

/* ───────────────────────────  Founder distinctions  ─────────────────────── */

/**
 * The live `founder_distinction` enum, in database order.
 *
 * `first_50` is intentionally unused — no such programme exists yet. It stays in
 * the vocabulary because the enum carries it and removing an enum label is not
 * something Postgres allows; it is simply never offered.
 */
export const FOUNDER_DISTINCTIONS = [
  "none",
  "founding_25",
  "first_50",
  "founding_professional",
] as const;
export type FounderDistinction = (typeof FOUNDER_DISTINCTIONS)[number];

/** The distinctions an admin may actually confer today. */
export const CONFERRABLE_DISTINCTIONS: FounderDistinction[] = [
  "none",
  "founding_25",
  "founding_professional",
];

export const DISTINCTION_LABEL: Record<FounderDistinction, string> = {
  none: "None",
  founding_25: "Founding 25",
  first_50: "First 50 (retired — not conferrable)",
  founding_professional: "Founding Professional",
};

export const DISTINCTION_HELP: Record<FounderDistinction, string> = {
  none: "No founding distinction.",
  founding_25:
    "One of the 25 choreographers Relevé chose at the beginning. Permanent provenance — confer only on deliberate acceptance into the cohort, never from the application's fee-waiver flag.",
  first_50: "Retired. Present in the database only; no programme uses it.",
  founding_professional:
    "A founding member of the Relevé Professional Roster. Normally conferred automatically when an invited grant is claimed.",
};

export function isFounderDistinction(v: unknown): v is FounderDistinction {
  return typeof v === "string" && (FOUNDER_DISTINCTIONS as readonly string[]).includes(v);
}

/* ─────────────────────────  Choreographer tiers  ────────────────────────── */

/**
 * The live `choreographer_tier` enum, in database order. ALL FOUR are preserved
 * (founder decision C): `featured` is not deleted and not remapped.
 *
 * Note the pricing SSOT names only three tiers — `featured` sits between
 * established and signature and appears in no ratified document. That is a known
 * discrepancy, recorded rather than silently resolved.
 */
export const CHOREOGRAPHER_TIERS = [
  "emerging",
  "established",
  "featured",
  "signature",
] as const;
export type ChoreographerTier = (typeof CHOREOGRAPHER_TIERS)[number];

export const TIER_LABEL: Record<ChoreographerTier, string> = {
  emerging: "Emerging",
  established: "Established",
  featured: "Featured",
  signature: "Signature",
};

export function isChoreographerTier(v: unknown): v is ChoreographerTier {
  return typeof v === "string" && (CHOREOGRAPHER_TIERS as readonly string[]).includes(v);
}

/* ───────────────────────────────  Honorifics  ───────────────────────────── */

/**
 * Editorial honorifics an admin may confer. Free-form `text[]` in the database,
 * so any historical value still renders; this list governs what can be ASSIGNED.
 *
 * ⚠️ Two legacy values are deliberately absent: "Verified Artist" and "Founding
 * Artist". Both collided with system-controlled marks — the ✓ Verified Member
 * mark and the ✦ Founding Professional badge render on the same profile, and a
 * visitor could not tell which was Relevé's attestation and which was editorial.
 * Keeping them assignable would blur exactly the line the brand rule draws.
 * Existing values are preserved and still display; they simply cannot be added
 * to anyone new.
 */
export const CONFERRABLE_HONORIFICS = [
  "Master Teacher",
  "Stage Doors Educator",
  "Adaptive Arts Faculty",
] as const;

/** Values that exist in historical data but must not be offered again. */
export const RETIRED_HONORIFICS = ["Verified Artist", "Founding Artist"] as const;

export function isRetiredHonorific(v: string): boolean {
  return (RETIRED_HONORIFICS as readonly string[]).includes(v);
}

/**
 * Clean a submitted honorifics list: trim, drop blanks, de-duplicate, and refuse
 * anything retired. Order is preserved so the profile renders them as chosen.
 */
export function normalizeHonorifics(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const v = raw.trim();
    if (!v || seen.has(v) || isRetiredHonorific(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/* ──────────────────────────────  The change  ────────────────────────────── */

/** The three signals this admin path may write. */
export type TrustSignals = {
  honorifics: string[];
  founder_distinction: FounderDistinction;
  choreographer_tier: ChoreographerTier;
};

export type TrustField = keyof TrustSignals;

/** One recorded change — the row shape of the audit trail. */
export type TrustChange = {
  field: TrustField;
  previous: string;
  next: string;
};

/** Render a value as stable text so an audit row reads the same in ten years. */
function asText(v: string[] | string): string {
  return Array.isArray(v) ? v.join(", ") : v;
}

/**
 * What actually changed. Returns [] when nothing did, so the caller can skip
 * both the write and the audit row rather than logging a no-op as if it were an
 * act — an audit trail full of "changed nothing" entries is worse than none.
 */
export function diffTrustSignals(
  current: TrustSignals,
  next: TrustSignals,
): TrustChange[] {
  const changes: TrustChange[] = [];
  const fields: TrustField[] = ["honorifics", "founder_distinction", "choreographer_tier"];
  for (const field of fields) {
    const a = asText(current[field]);
    const b = asText(next[field]);
    if (a !== b) changes.push({ field, previous: a, next: b });
  }
  return changes;
}

/**
 * Validate an admin's submitted values, falling back to the CURRENT value for
 * anything missing or unrecognised.
 *
 * Falling back rather than defaulting is the safe direction: a malformed request
 * leaves a member's standing exactly as it was, instead of quietly resetting a
 * conferred distinction to 'none'.
 */
export function resolveTrustUpdate(
  current: TrustSignals,
  submitted: {
    honorifics?: unknown;
    founder_distinction?: unknown;
    choreographer_tier?: unknown;
  },
): TrustSignals {
  return {
    honorifics: Array.isArray(submitted.honorifics)
      ? normalizeHonorifics(submitted.honorifics)
      : current.honorifics,
    founder_distinction: isFounderDistinction(submitted.founder_distinction)
      ? submitted.founder_distinction
      : current.founder_distinction,
    choreographer_tier: isChoreographerTier(submitted.choreographer_tier)
      ? submitted.choreographer_tier
      : current.choreographer_tier,
  };
}
