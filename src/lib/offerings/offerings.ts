// Professional Offerings — pure domain logic (Slice 1).
//
// The additive "professional business layer" for the Professional Profile: one
// reusable Offering concept a professional uses to package a Service, Session,
// Product, License, Event/Experience, or Other. This module is PURE and
// dependency-free (no DB, no React, no env) so the type list, validation, CTA
// derivation, and pricing display can be unit-tested in isolation and reused by
// both the editor server actions (Slice 2) and the public render (Slice 3).
//
// The `type`/`pricing_type`/etc. lists mirror the CHECK constraints in
// supabase/migrations/20260812220000_professional_offerings.sql — keep the two in
// sync. We use a TS union + CHECK-constrained text (NOT a Postgres enum) so new
// Offering kinds can be added by widening both sides.

// ---- Controlled vocabularies (mirror the SQL CHECK constraints) ------------

export const OFFERING_TYPES = [
  "service",
  "session",
  "product",
  "license",
  "event",
  "other",
] as const;
export type OfferingType = (typeof OFFERING_TYPES)[number];

export const PRICING_TYPES = [
  "fixed",
  "hourly",
  "daily",
  "project",
  "starting_at",
  "contact",
  "free",
  "external",
  "hidden",
] as const;
export type PricingType = (typeof PRICING_TYPES)[number];

export const LOCATION_MODES = ["in_person", "virtual", "travel", "flexible"] as const;
export type LocationMode = (typeof LOCATION_MODES)[number];

export const CTA_TYPES = [
  "inquire",
  "view_product",
  "view_licensing",
  "register",
  "learn_more",
  "none",
] as const;
export type CtaType = (typeof CTA_TYPES)[number];

export const OFFERING_STATUSES = ["active", "inactive"] as const;
export type OfferingStatus = (typeof OFFERING_STATUSES)[number];

// ---- Display labels --------------------------------------------------------

export const OFFERING_TYPE_LABEL: Record<OfferingType, string> = {
  service: "Service",
  session: "Coaching & Sessions",
  product: "Product",
  license: "Licensed Work",
  event: "Events & Experiences",
  other: "Other",
};

export const CTA_LABEL: Record<CtaType, string> = {
  inquire: "Inquire",
  view_product: "View Product",
  view_licensing: "View Licensing",
  register: "Register",
  learn_more: "Learn More",
  none: "",
};

// ---- Field limits (shared by the form + server-action validation) ----------

export const OFFERING_LIMITS = {
  titleMin: 2,
  titleMax: 120,
  // The builder shows ONE "Tell people what you offer" writing area — generous
  // but controlled (roughly a short paragraph), not a website-builder editor.
  shortMax: 600,
  longMax: 2000,
  priceDisplayMax: 60,
  locationNoteMax: 120,
  externalUrlMax: 2048,
} as const;

/** Friendly labels for the builder's pricing picker. */
export const PRICING_TYPE_LABEL: Record<PricingType, string> = {
  fixed: "Fixed price",
  hourly: "Hourly",
  daily: "Daily",
  project: "Per project",
  starting_at: "Starting at",
  contact: "Contact for pricing",
  free: "Free",
  external: "Priced externally",
  hidden: "No price displayed",
};

/** Friendly labels for the builder's "How is it delivered?" picker. */
export const LOCATION_MODE_LABEL: Record<LocationMode, string> = {
  in_person: "In person",
  virtual: "Virtual",
  travel: "Travel / mobile",
  flexible: "Flexible",
};

/** Pricing types that carry a dollar amount (the builder shows an amount field). */
export const AMOUNT_PRICING_TYPES: PricingType[] = [
  "fixed",
  "hourly",
  "daily",
  "project",
  "starting_at",
];

// ---- Type guards -----------------------------------------------------------

export function isOfferingType(v: unknown): v is OfferingType {
  return typeof v === "string" && (OFFERING_TYPES as readonly string[]).includes(v);
}
export function isPricingType(v: unknown): v is PricingType {
  return typeof v === "string" && (PRICING_TYPES as readonly string[]).includes(v);
}
export function isLocationMode(v: unknown): v is LocationMode {
  return typeof v === "string" && (LOCATION_MODES as readonly string[]).includes(v);
}
export function isCtaType(v: unknown): v is CtaType {
  return typeof v === "string" && (CTA_TYPES as readonly string[]).includes(v);
}
export function isOfferingStatus(v: unknown): v is OfferingStatus {
  return typeof v === "string" && (OFFERING_STATUSES as readonly string[]).includes(v);
}

// ---- URL safety ------------------------------------------------------------

/** Only absolute http/https URLs are allowed for external destinations. */
export function isValidHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  return u.protocol === "http:" || u.protocol === "https:";
}

// ---- Validation ------------------------------------------------------------

/** Raw, pre-validation input (e.g. from a form/action payload). */
export type OfferingInput = {
  type?: string | null;
  title?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  pricingType?: string | null;
  priceDisplay?: string | null;
  locationMode?: string | null;
  locationNote?: string | null;
  externalUrl?: string | null;
  ctaType?: string | null;
  status?: string | null;
};

/** Validated, normalized, ready-to-persist values. */
export type NormalizedOffering = {
  type: OfferingType;
  title: string;
  shortDescription: string | null;
  longDescription: string | null;
  pricingType: PricingType | null;
  priceDisplay: string | null;
  locationMode: LocationMode | null;
  locationNote: string | null;
  externalUrl: string | null;
  ctaType: CtaType | null;
  status: OfferingStatus;
};

export type OfferingError = { field: string; message: string };

export type OfferingValidation =
  | { ok: true; value: NormalizedOffering }
  | { ok: false; errors: OfferingError[] };

/** Trim a maybe-nullish string to a non-empty value, or null. */
function clean(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Validate + normalize a raw Offering input. Pure: no DB, no side effects.
 * Enforces the same shape the DB CHECK constraints do, plus length bounds and
 * http(s)-only external URLs, so bad data is rejected before it reaches Postgres.
 */
export function validateOffering(input: OfferingInput): OfferingValidation {
  const errors: OfferingError[] = [];

  // type (required, controlled)
  const typeRaw = clean(input.type);
  if (!typeRaw) {
    errors.push({ field: "type", message: "Choose an offering type." });
  } else if (!isOfferingType(typeRaw)) {
    errors.push({ field: "type", message: "Unknown offering type." });
  }

  // title (required, bounded)
  const title = clean(input.title);
  if (!title) {
    errors.push({ field: "title", message: "Give your offering a title." });
  } else if (title.length < OFFERING_LIMITS.titleMin) {
    errors.push({ field: "title", message: "That title is too short." });
  } else if (title.length > OFFERING_LIMITS.titleMax) {
    errors.push({
      field: "title",
      message: `Keep the title under ${OFFERING_LIMITS.titleMax} characters.`,
    });
  }

  // descriptions (optional, bounded)
  const shortDescription = clean(input.shortDescription);
  if (shortDescription && shortDescription.length > OFFERING_LIMITS.shortMax) {
    errors.push({
      field: "shortDescription",
      message: `Keep the short description under ${OFFERING_LIMITS.shortMax} characters.`,
    });
  }
  const longDescription = clean(input.longDescription);
  if (longDescription && longDescription.length > OFFERING_LIMITS.longMax) {
    errors.push({
      field: "longDescription",
      message: `Keep the description under ${OFFERING_LIMITS.longMax} characters.`,
    });
  }

  // pricing (optional, controlled + bounded)
  const pricingRaw = clean(input.pricingType);
  let pricingType: PricingType | null = null;
  if (pricingRaw) {
    if (isPricingType(pricingRaw)) pricingType = pricingRaw;
    else errors.push({ field: "pricingType", message: "Unknown pricing type." });
  }
  const priceDisplay = clean(input.priceDisplay);
  if (priceDisplay && priceDisplay.length > OFFERING_LIMITS.priceDisplayMax) {
    errors.push({
      field: "priceDisplay",
      message: `Keep the price under ${OFFERING_LIMITS.priceDisplayMax} characters.`,
    });
  }

  // location (optional, controlled + bounded)
  const locationRaw = clean(input.locationMode);
  let locationMode: LocationMode | null = null;
  if (locationRaw) {
    if (isLocationMode(locationRaw)) locationMode = locationRaw;
    else errors.push({ field: "locationMode", message: "Unknown location option." });
  }
  const locationNote = clean(input.locationNote);
  if (locationNote && locationNote.length > OFFERING_LIMITS.locationNoteMax) {
    errors.push({
      field: "locationNote",
      message: `Keep the location note under ${OFFERING_LIMITS.locationNoteMax} characters.`,
    });
  }

  // external URL (optional, http/https only, bounded)
  const externalUrl = clean(input.externalUrl);
  if (externalUrl) {
    if (externalUrl.length > OFFERING_LIMITS.externalUrlMax) {
      errors.push({ field: "externalUrl", message: "That link is too long." });
    } else if (!isValidHttpUrl(externalUrl)) {
      errors.push({ field: "externalUrl", message: "Enter a valid http(s) link." });
    }
  }

  // cta override (optional, controlled)
  const ctaRaw = clean(input.ctaType);
  let ctaType: CtaType | null = null;
  if (ctaRaw) {
    if (isCtaType(ctaRaw)) ctaType = ctaRaw;
    else errors.push({ field: "ctaType", message: "Unknown call-to-action." });
  }

  // status (optional; defaults to active)
  const statusRaw = clean(input.status);
  let status: OfferingStatus = "active";
  if (statusRaw) {
    if (isOfferingStatus(statusRaw)) status = statusRaw;
    else errors.push({ field: "status", message: "Unknown status." });
  }

  if (errors.length > 0) return { ok: false, errors };

  // All required fields validated above.
  return {
    ok: true,
    value: {
      type: typeRaw as OfferingType,
      title: title as string,
      shortDescription,
      longDescription,
      pricingType,
      priceDisplay,
      locationMode,
      locationNote,
      externalUrl,
      ctaType,
      status,
    },
  };
}

// ---- CTA derivation --------------------------------------------------------

/** The default CTA for each offering type when no explicit override is set. */
export const DEFAULT_CTA_BY_TYPE: Record<OfferingType, CtaType> = {
  service: "inquire",
  session: "inquire",
  product: "view_product",
  license: "view_licensing",
  event: "register",
  // "Other" defaults to the intro rail — a catch-all offering still gives people
  // a way to reach out. (A `learn_more` external link stays available as an
  // explicit override.)
  other: "inquire",
};

/** The minimal shape needed to resolve an Offering's call-to-action. */
export type CtaInput = {
  type: OfferingType;
  ctaType?: CtaType | null;
  externalUrl?: string | null;
  signatureWorkId?: string | null;
};

/**
 * A fully-resolved call-to-action, ready to render:
 *   - intro:     open the existing Request-an-Intro rail (no href)
 *   - external:  link out to a professional-supplied URL (new tab)
 *   - licensing: link to the existing licensing sales page for a signature work
 *   - none:      render no action button
 */
export type ResolvedCta =
  | { action: "intro"; label: string }
  | { action: "external"; label: string; href: string }
  | { action: "licensing"; label: string; href: string }
  | { action: "none"; label: string };

/** The public licensing sales page for a signature work (existing route). */
export function licensingHref(signatureWorkId: string): string {
  return `/experiences/${signatureWorkId}`;
}

/**
 * Resolve the CTA for an Offering. Rules:
 *   1. An explicit `ctaType` override wins; otherwise the default for `type`.
 *   2. Map the effective CTA to an action, filling in the destination:
 *        - external CTAs (view_product / register / learn_more) need an
 *          `externalUrl`; without one they fall back to the intro rail
 *          (learn_more with no link resolves to `none`).
 *        - view_licensing needs a `signatureWorkId`; without one it falls back
 *          to the intro rail.
 * Pure and total — always returns a ResolvedCta.
 */
export function deriveCta(input: CtaInput): ResolvedCta {
  const effective: CtaType =
    input.ctaType && isCtaType(input.ctaType)
      ? input.ctaType
      : DEFAULT_CTA_BY_TYPE[input.type];

  const url = clean(input.externalUrl);
  const workId = clean(input.signatureWorkId);

  switch (effective) {
    case "inquire":
      return { action: "intro", label: CTA_LABEL.inquire };

    case "view_product":
      return url
        ? { action: "external", label: CTA_LABEL.view_product, href: url }
        : { action: "intro", label: CTA_LABEL.inquire };

    case "register":
      return url
        ? { action: "external", label: CTA_LABEL.register, href: url }
        : { action: "intro", label: CTA_LABEL.inquire };

    case "learn_more":
      return url
        ? { action: "external", label: CTA_LABEL.learn_more, href: url }
        : { action: "none", label: CTA_LABEL.none };

    case "view_licensing":
      return workId
        ? { action: "licensing", label: CTA_LABEL.view_licensing, href: licensingHref(workId) }
        : { action: "intro", label: CTA_LABEL.inquire };

    case "none":
      return { action: "none", label: CTA_LABEL.none };
  }
}

// ---- Inquire prefill -------------------------------------------------------

/**
 * The prefilled note for an Offering's "Inquire" action. Slice 4 reuses the
 * existing Request-an-Intro / connections flow rather than inventing a new
 * contact path — so the Offering context has to travel in the message text
 * (no connections schema/index change). This puts the Offering TITLE clearly in
 * the note so the professional knows exactly which Offering is being asked
 * about. The viewer edits this before sending; it is well above INTRO_MIN_LEN.
 * Pure.
 */
export function introPrefillMessage(firstName: string, offeringTitle: string): string {
  const name = firstName.trim() || "there";
  const title = offeringTitle.trim();
  return `Hi ${name}, I'd like to inquire about your offering: "${title}". `;
}

// ---- Pricing display -------------------------------------------------------

/** The minimal shape needed to decide what price string to show. */
export type PricingInput = {
  priceDisplay?: string | null;
  pricingType?: PricingType | null;
};

/**
 * The human price string to show on a card, or null to show nothing.
 *   - An explicit `priceDisplay` always wins ("$85/hour", "Starting at $250", …).
 *   - Otherwise a couple of pricing types have canonical copy (free / contact).
 *   - `hidden`, `external`, and unpriced structured types show nothing in V1
 *     (structured numeric pricing via price_cents is a future pass).
 * Pure.
 */
export function pricingDisplay(input: PricingInput): string | null {
  const explicit = clean(input.priceDisplay);
  if (explicit) return explicit;

  switch (input.pricingType) {
    case "free":
      return "Free";
    case "contact":
      return "Contact for pricing";
    default:
      return null;
  }
}

/** Format a dollar amount as "$85" or "$1,250.50" (whole numbers drop cents). */
export function formatMoney(dollars: number): string {
  const rounded = Math.round(dollars * 100) / 100;
  const s = Number.isInteger(rounded)
    ? rounded.toLocaleString("en-US")
    : rounded.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${s}`;
}

/**
 * Compose the `price_display` string for an amount-carrying pricing type:
 *   fixed → "$175" · project → "$175 / project" · hourly → "$85 / hour" ·
 *   daily → "$600 / day" · starting_at → "Starting at $250".
 * Returns null for non-amount types (free/contact/hidden/external), whose copy
 * is derived at render time by pricingDisplay().
 */
export function formatPriceDisplay(pricingType: PricingType, dollars: number): string | null {
  const money = formatMoney(dollars);
  switch (pricingType) {
    case "fixed":
      return money;
    case "project":
      return `${money} / project`;
    case "hourly":
      return `${money} / hour`;
    case "daily":
      return `${money} / day`;
    case "starting_at":
      return `Starting at ${money}`;
    default:
      return null;
  }
}

export type ResolvedPricing =
  | { ok: true; pricingType: PricingType | null; priceDisplay: string | null }
  | { ok: false; error: string };

/**
 * Turn the builder's pricing picker (a type + an optional amount string) into a
 * validated `{ pricingType, priceDisplay }` pair. Pure.
 *   - no pricing type chosen → both null (nothing shown; never forces a price).
 *   - an amount type (fixed/hourly/daily/project/starting_at) requires a positive
 *     amount and composes the display string.
 *   - free/contact/hidden carry no amount; their copy is derived at render.
 * The professional is NEVER forced into an hourly rate — that is one option of many.
 */
export function resolvePricing(input: {
  pricingType?: string | null;
  amount?: string | null;
}): ResolvedPricing {
  const typeRaw = clean(input.pricingType);
  if (!typeRaw) return { ok: true, pricingType: null, priceDisplay: null };
  if (!isPricingType(typeRaw)) return { ok: false, error: "Choose how you price this." };

  if ((AMOUNT_PRICING_TYPES as string[]).includes(typeRaw)) {
    const raw = clean(input.amount);
    const n = raw ? Number.parseFloat(raw.replace(/[^0-9.]/g, "")) : NaN;
    if (!raw || Number.isNaN(n) || n <= 0) {
      return { ok: false, error: "Enter a price amount." };
    }
    return {
      ok: true,
      pricingType: typeRaw,
      priceDisplay: formatPriceDisplay(typeRaw, n),
    };
  }

  // free / contact / hidden / external — no amount; copy derived at render.
  return { ok: true, pricingType: typeRaw, priceDisplay: null };
}

// Discoverability fix (2026-08-21) — the two decisions that drive "Add" vs
// "Manage" copy and the post-save onboarding nudge. Extracted as pure functions
// (rather than left as inline ternaries in the Server Component/Server Action)
// so the empty-offerings branch is genuinely unit-tested, not just reasoned
// about — the same discipline `deriveCta` above already gets.

/** Dashboard tile subcopy on /profile: "Add" while empty, "Manage" once started. */
export function offeringsTileSubcopy(hasOfferings: boolean): string {
  return hasOfferings ? "Manage what you offer" : "Add what you offer";
}

/**
 * Whether the post-save onboarding CTA ("Next: Add What You Offer →") should
 * render. Mirrors the exact guard used in ProfileEditor.tsx: a successful save
 * that returned a slug, and the member has zero offerings so far. Once
 * `hasOfferings` flips true, this returns false and the nudge disappears.
 */
export function shouldShowOnboardingOfferingsCta(state: {
  ok: boolean;
  slug?: string;
  hasOfferings?: boolean;
}): boolean {
  return Boolean(state.ok && state.slug && state.hasOfferings === false);
}

/** The persisted Offering row shape (what the builder + cards render from). */
export type OfferingRow = {
  id: string;
  type: OfferingType;
  title: string;
  short_description: string | null;
  long_description: string | null;
  image_url: string | null;
  pricing_type: PricingType | null;
  price_display: string | null;
  location_mode: LocationMode | null;
  location_note: string | null;
  external_url: string | null;
  cta_type: CtaType | null;
  signature_work_id: string | null;
  status: OfferingStatus;
  sort_order: number;
};
