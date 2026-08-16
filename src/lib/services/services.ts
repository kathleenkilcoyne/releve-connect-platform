// Professional Services — pure domain logic.
//
// A vetted Relevé professional can showcase OTHER professional services or
// businesses they run alongside their dance work (massage therapy, physical
// therapy, Pilates, photography, costume design, music editing, class musicians…).
//
// This is part of the person's professional identity — NOT advertising. Nothing
// here is sponsored, ranked, boosted, or sold; the words "advertisement" and
// "sponsored" appear nowhere in this feature by design. Relevé takes no cut of
// anything a member earns from these businesses (CLAUDE.md §7.1).
//
// This module is PURE and dependency-free (no DB, no React, no env) so the
// vocabularies, validation, contact-privacy rules, and button derivation can be
// unit-tested in isolation and reused by the editor server actions, the public
// render, and the admin view.
//
// The vocabularies mirror the CHECK constraints in
// supabase/migrations/20260815161427_professional_services.sql — keep the two in
// sync. CHECK-constrained text (NOT a Postgres enum) so categories can be
// widened on both sides as the community tells us what they actually do.

// ---- Controlled vocabularies (mirror the SQL CHECK constraints) ------------

/**
 * Service categories. This list is the spine of the FUTURE Roster filter
 * (founder direction §4) — it is deliberately a controlled vocabulary, never
 * free text, so "Massage Therapy" is one filterable thing and not fourteen
 * spellings. Adding a category = widen this list AND the SQL check.
 */
export const SERVICE_CATEGORIES = [
  "massage_therapy",
  "physical_therapy",
  "pilates",
  "personal_training",
  "photography",
  "videography",
  "costume_design",
  "music_editing",
  "makeup_hair",
  "vocal_coaching",
  "nutrition_wellness",
  "marketing_social",
  "accompanist",
  "other",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATEGORY_LABEL: Record<ServiceCategory, string> = {
  massage_therapy: "Massage Therapy",
  physical_therapy: "Physical Therapy",
  pilates: "Pilates",
  personal_training: "Personal Training",
  photography: "Photography / Headshots",
  videography: "Videography",
  costume_design: "Costume Design",
  music_editing: "Music Editing",
  makeup_hair: "Makeup / Hair",
  vocal_coaching: "Vocal Coaching",
  nutrition_wellness: "Nutrition / Wellness",
  marketing_social: "Social Media / Marketing",
  accompanist: "Accompanist / Class Musician",
  other: "Other professional service",
};

/**
 * The one category with its own structured fields today. Musicians are a planned
 * future expansion of Relevé beyond dance professionals; keeping this a named
 * constant (rather than a bare string sprinkled through the UI) is what makes
 * "promote Accompanist to its own professional category" a contained change.
 */
export const ACCOMPANIST: ServiceCategory = "accompanist";

/** How the service is delivered. `touring` is offered in the accompanist branch. */
export const SERVICE_TYPES = ["in_person", "virtual", "mobile", "touring", "multiple"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  in_person: "In person",
  virtual: "Virtual",
  mobile: "Mobile",
  touring: "Touring / Travel",
  multiple: "Multiple",
};

/** The service types shown to everyone (founder spec §1). */
export const GENERAL_SERVICE_TYPES: ServiceType[] = ["in_person", "virtual", "mobile", "multiple"];
/** Accompanists additionally travel with productions. */
export const ACCOMPANIST_SERVICE_TYPES: ServiceType[] = [
  "in_person",
  "virtual",
  "touring",
  "multiple",
];

/** Button label the member can force; null = derive it from what they filled in. */
export const SERVICE_CTA_LABELS = ["visit_website", "book", "learn_more", "contact"] as const;
export type ServiceCtaLabel = (typeof SERVICE_CTA_LABELS)[number];

export const SERVICE_CTA_TEXT: Record<ServiceCtaLabel, string> = {
  visit_website: "Visit Website",
  // RETIRED as an external label (2026-08-15). "Book" now means booking ON
  // Relevé and is never a link off the platform; the value stays in the union
  // and the SQL CHECK so any historical row still reads, but it is mapped to
  // "Visit Website" whenever it would label an outbound link.
  book: "Book",
  learn_more: "Learn More",
  contact: "Contact",
};

/** The one booking call-to-action. Booking happens on Relevé or not at all. */
export const BOOK_ON_RELEVE = "Book on Relevé";

/** The copy shown beside the button until the booking rail ships. */
export const BOOKING_COMING_SOON = "Booking on Relevé is coming soon";

/**
 * The label for an OUTBOUND link. A stored "book" override is deliberately
 * ignored here: an external link must never be dressed up as a booking action.
 */
function externalLabel(override: ServiceCtaLabel | null, fallback: ServiceCtaLabel): string {
  const safe = override && override !== "book" ? override : fallback;
  return SERVICE_CTA_TEXT[safe];
}

export const SERVICE_STATUSES = ["active", "hidden"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const MODERATION_STATUSES = ["ok", "flagged", "removed"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

// ---- Accompanist / class musician vocabularies -----------------------------

export const INSTRUMENTS = ["piano", "percussion", "other"] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

export const INSTRUMENT_LABEL: Record<Instrument, string> = {
  piano: "Piano",
  percussion: "Percussion",
  other: "Other",
};

/** What a class musician plays for. Array-valued; indexed for a future Swing match. */
export const ACCOMPANIST_FOR = [
  "ballet",
  "modern",
  "contemporary",
  "musical_theatre",
  "improvisation",
  "auditions",
  "rehearsals",
  "master_classes",
  "other",
] as const;
export type AccompanistFor = (typeof ACCOMPANIST_FOR)[number];

export const ACCOMPANIST_FOR_LABEL: Record<AccompanistFor, string> = {
  ballet: "Ballet",
  modern: "Modern",
  contemporary: "Contemporary",
  musical_theatre: "Musical Theatre",
  improvisation: "Improvisation",
  auditions: "Auditions",
  rehearsals: "Rehearsals",
  master_classes: "Master Classes",
  other: "Other",
};

// ---- Field limits (shared by the form + server-action validation) ----------

export const SERVICE_LIMITS = {
  businessNameMin: 2,
  businessNameMax: 120,
  descriptionMax: 600,
  locationMax: 120,
  categoryOtherMax: 60,
  emailMax: 254,
  phoneMax: 40,
  rateDisplayMax: 60,
  instrumentOtherMax: 60,
  urlMax: 2048,
} as const;

// ---- Type guards -----------------------------------------------------------

export function isServiceCategory(v: unknown): v is ServiceCategory {
  return typeof v === "string" && (SERVICE_CATEGORIES as readonly string[]).includes(v);
}
export function isServiceType(v: unknown): v is ServiceType {
  return typeof v === "string" && (SERVICE_TYPES as readonly string[]).includes(v);
}
export function isServiceCtaLabel(v: unknown): v is ServiceCtaLabel {
  return typeof v === "string" && (SERVICE_CTA_LABELS as readonly string[]).includes(v);
}
export function isServiceStatus(v: unknown): v is ServiceStatus {
  return typeof v === "string" && (SERVICE_STATUSES as readonly string[]).includes(v);
}
export function isInstrument(v: unknown): v is Instrument {
  return typeof v === "string" && (INSTRUMENTS as readonly string[]).includes(v);
}
export function isAccompanistFor(v: unknown): v is AccompanistFor {
  return typeof v === "string" && (ACCOMPANIST_FOR as readonly string[]).includes(v);
}

// ---- Safety ----------------------------------------------------------------

/**
 * Only absolute http/https URLs are allowed for any external destination.
 * This is the guard that keeps `javascript:`, `data:`, and other executable
 * schemes out of an href a visitor could click (founder spec §5).
 */
export function isValidHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  return u.protocol === "http:" || u.protocol === "https:";
}

/**
 * Accept a URL a human typed. People write "mcareebodywork.com", not
 * "https://mcareebodywork.com" — rejecting that is a papercut, so we upgrade a
 * bare domain to https:// and then validate normally. Anything with an explicit
 * non-http(s) scheme is REJECTED, never coerced: "javascript:alert(1)" must not
 * become "https://javascript:alert(1)".
 */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) {
    // Has an explicit scheme — it must be http(s).
    return isValidHttpUrl(t) ? t : null;
  }
  const withScheme = `https://${t.replace(/^\/+/, "")}`;
  return isValidHttpUrl(withScheme) ? withScheme : null;
}

/** A plain, permissive email shape check (the real proof is that mail arrives). */
export function isValidEmail(raw: string): boolean {
  const t = raw.trim();
  return t.length <= SERVICE_LIMITS.emailMax && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/**
 * Strip anything that isn't plausible in a phone number. Not a format
 * validator — international numbers vary too much to police — just a way to
 * ensure the stored value is digits and separators, never markup.
 */
export function sanitizePhone(raw: string): string | null {
  const t = raw.replace(/[^\d+()\-.\sxX]/g, "").trim();
  return t.length > 0 ? t.slice(0, SERVICE_LIMITS.phoneMax) : null;
}

/**
 * Collapse anything that could be interpreted as markup or an embed out of
 * member-entered prose. Text is rendered by React (which escapes by default),
 * so this is belt-and-braces: it means the STORED value is clean too, and stays
 * clean if it is ever rendered somewhere less careful (an email, a CSV export).
 */
export function sanitizeText(raw: string): string {
  const stripped = raw.replace(/<[^>]*>/g, ""); // no <script>, <iframe>, <img onerror=...>
  // Drop control characters, keeping newline and tab (a description may wrap).
  let out = "";
  for (const ch of stripped) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = (code < 0x20 && ch !== "\n" && ch !== "\t") || code === 0x7f;
    if (!isControl) out += ch;
  }
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---- Validation ------------------------------------------------------------

/** Raw, pre-validation input (e.g. from a form/action payload). */
export type ServiceInput = {
  category?: string | null;
  categoryOtherLabel?: string | null;
  businessName?: string | null;
  shortDescription?: string | null;
  location?: string | null;
  serviceType?: string | null;
  websiteUrl?: string | null;
  socialUrl?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  showEmail?: boolean;
  showPhone?: boolean;
  ctaLabel?: string | null;
  status?: string | null;
  // Accompanist branch
  instrument?: string | null;
  instrumentOther?: string | null;
  accompanistFor?: string[] | null;
  rateDisplay?: string | null;
  rateContact?: boolean;
  mediaUrl?: string | null;
};

/** Validated, normalized, ready-to-persist values. */
export type NormalizedService = {
  category: ServiceCategory;
  categoryOtherLabel: string | null;
  businessName: string;
  shortDescription: string | null;
  location: string | null;
  serviceType: ServiceType | null;
  websiteUrl: string | null;
  socialUrl: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  showEmail: boolean;
  showPhone: boolean;
  ctaLabel: ServiceCtaLabel | null;
  status: ServiceStatus;
  instrument: Instrument | null;
  instrumentOther: string | null;
  accompanistFor: AccompanistFor[];
  rateDisplay: string | null;
  rateContact: boolean;
  mediaUrl: string | null;
};

export type ServiceError = { field: string; message: string };

export type ServiceValidation =
  | { ok: true; value: NormalizedService }
  | { ok: false; errors: ServiceError[] };

/** Trim a maybe-nullish string to a non-empty value, or null. */
function clean(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Validate + normalize one raw Service input. Pure: no DB, no side effects.
 *
 * Enforces the same shape the DB CHECK constraints do, plus length bounds,
 * http(s)-only links, markup-stripped prose, and the contact-privacy rule: a
 * `show_*` flag can only be true when the matching contact value exists.
 */
export function validateService(input: ServiceInput): ServiceValidation {
  const errors: ServiceError[] = [];

  // category (required, controlled)
  const categoryRaw = clean(input.category);
  if (!categoryRaw) {
    errors.push({ field: "category", message: "Choose a category." });
  } else if (!isServiceCategory(categoryRaw)) {
    errors.push({ field: "category", message: "Unknown category." });
  }
  const isAccompanist = categoryRaw === ACCOMPANIST;

  // "Other" gets an optional member-written label so the card doesn't just read "Other".
  let categoryOtherLabel = clean(input.categoryOtherLabel);
  if (categoryOtherLabel) {
    categoryOtherLabel = sanitizeText(categoryOtherLabel);
    if (categoryOtherLabel.length > SERVICE_LIMITS.categoryOtherMax) {
      errors.push({
        field: "categoryOtherLabel",
        message: `Keep that under ${SERVICE_LIMITS.categoryOtherMax} characters.`,
      });
    }
  }
  if (categoryRaw !== "other") categoryOtherLabel = null;

  // business name (required, bounded)
  let businessName = clean(input.businessName);
  if (businessName) businessName = sanitizeText(businessName);
  if (!businessName) {
    errors.push({ field: "businessName", message: "Add the service or business name." });
  } else if (businessName.length < SERVICE_LIMITS.businessNameMin) {
    errors.push({ field: "businessName", message: "That name is too short." });
  } else if (businessName.length > SERVICE_LIMITS.businessNameMax) {
    errors.push({
      field: "businessName",
      message: `Keep the name under ${SERVICE_LIMITS.businessNameMax} characters.`,
    });
  }

  // description (optional, bounded, markup-stripped)
  let shortDescription = clean(input.shortDescription);
  if (shortDescription) {
    shortDescription = sanitizeText(shortDescription) || null;
    if (shortDescription && shortDescription.length > SERVICE_LIMITS.descriptionMax) {
      errors.push({
        field: "shortDescription",
        message: `Keep the description under ${SERVICE_LIMITS.descriptionMax} characters.`,
      });
    }
  }

  // location (optional, bounded)
  let location = clean(input.location);
  if (location) {
    location = sanitizeText(location) || null;
    if (location && location.length > SERVICE_LIMITS.locationMax) {
      errors.push({ field: "location", message: "That location is too long." });
    }
  }

  // service type (optional, controlled)
  const serviceTypeRaw = clean(input.serviceType);
  let serviceType: ServiceType | null = null;
  if (serviceTypeRaw) {
    if (isServiceType(serviceTypeRaw)) serviceType = serviceTypeRaw;
    else errors.push({ field: "serviceType", message: "Unknown service type." });
  }

  // links (optional, http(s) only, bounded)
  function url(field: string, raw: string | null | undefined): string | null {
    const t = clean(raw);
    if (!t) return null;
    if (t.length > SERVICE_LIMITS.urlMax) {
      errors.push({ field, message: "That link is too long." });
      return null;
    }
    const normalized = normalizeUrl(t);
    if (!normalized) {
      errors.push({ field, message: "Enter a valid web address (https://…)." });
      return null;
    }
    return normalized;
  }
  const websiteUrl = url("websiteUrl", input.websiteUrl);
  const socialUrl = url("socialUrl", input.socialUrl);
  const mediaUrl = url("mediaUrl", input.mediaUrl);

  // contact (optional) — stored regardless, published only on explicit opt-in
  let businessEmail = clean(input.businessEmail);
  if (businessEmail) {
    if (!isValidEmail(businessEmail)) {
      errors.push({ field: "businessEmail", message: "Enter a valid email address." });
      businessEmail = null;
    }
  }
  const businessPhone = clean(input.businessPhone)
    ? sanitizePhone(String(input.businessPhone))
    : null;

  // A display toggle with nothing to display is meaningless — and, worse, would
  // read as "my email is public" on a profile showing no email. Force it false.
  const showEmail = Boolean(input.showEmail) && Boolean(businessEmail);
  const showPhone = Boolean(input.showPhone) && Boolean(businessPhone);

  // button label override (optional, controlled)
  const ctaRaw = clean(input.ctaLabel);
  let ctaLabel: ServiceCtaLabel | null = null;
  if (ctaRaw) {
    if (isServiceCtaLabel(ctaRaw)) ctaLabel = ctaRaw;
    else errors.push({ field: "ctaLabel", message: "Unknown button label." });
  }

  // status (optional; defaults to active — "Display this service on my profile")
  const statusRaw = clean(input.status);
  let status: ServiceStatus = "active";
  if (statusRaw) {
    if (isServiceStatus(statusRaw)) status = statusRaw;
    else errors.push({ field: "status", message: "Unknown status." });
  }

  // ---- Accompanist branch (ignored entirely for other categories) ----------
  let instrument: Instrument | null = null;
  let instrumentOther: string | null = null;
  let accompanistFor: AccompanistFor[] = [];
  let rateDisplay: string | null = null;
  let rateContact = false;

  if (isAccompanist) {
    const instRaw = clean(input.instrument);
    if (instRaw) {
      if (isInstrument(instRaw)) instrument = instRaw;
      else errors.push({ field: "instrument", message: "Unknown instrument." });
    }
    instrumentOther = clean(input.instrumentOther);
    if (instrumentOther) {
      instrumentOther = sanitizeText(instrumentOther).slice(0, SERVICE_LIMITS.instrumentOtherMax);
    }
    if (instrument !== "other") instrumentOther = null;

    // Unknown values are DROPPED rather than fatal — a stale checkbox from an
    // older form version shouldn't block a member from saving their work.
    accompanistFor = [
      ...new Set((input.accompanistFor ?? []).filter(isAccompanistFor)),
    ];

    rateContact = Boolean(input.rateContact);
    rateDisplay = clean(input.rateDisplay);
    if (rateDisplay) {
      rateDisplay = sanitizeText(rateDisplay);
      if (rateDisplay.length > SERVICE_LIMITS.rateDisplayMax) {
        errors.push({ field: "rateDisplay", message: "Keep the rate short." });
      }
    }
    // "Contact for rate" wins — showing both a number and "contact for rate"
    // tells a studio two different things.
    if (rateContact) rateDisplay = null;
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      category: categoryRaw as ServiceCategory,
      categoryOtherLabel,
      businessName: businessName as string,
      shortDescription,
      location,
      serviceType,
      websiteUrl,
      socialUrl,
      businessEmail,
      businessPhone,
      showEmail,
      showPhone,
      ctaLabel,
      status,
      instrument,
      instrumentOther,
      accompanistFor,
      rateDisplay,
      rateContact,
      mediaUrl,
    },
  };
}

// ---- Display helpers -------------------------------------------------------

/** The category line shown under the business name ("Other" uses the member's own words). */
export function categoryLabel(
  category: ServiceCategory,
  otherLabel?: string | null,
): string {
  if (category === "other") {
    const t = clean(otherLabel ?? null);
    if (t) return t;
  }
  return SERVICE_CATEGORY_LABEL[category];
}

/** "New York / Mobile" — location and delivery mode as one quiet line. */
export function locationLine(
  location: string | null | undefined,
  serviceType: ServiceType | null | undefined,
): string | null {
  const parts = [clean(location ?? null), serviceType ? SERVICE_TYPE_LABEL[serviceType] : null]
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : null;
}

/** The rate line for a class musician: an amount, "Contact for rate", or nothing. */
export function rateLine(input: {
  rateDisplay?: string | null;
  rateContact?: boolean;
}): string | null {
  if (input.rateContact) return "Contact for rate";
  return clean(input.rateDisplay ?? null);
}

// ---- Button (CTA) derivation ----------------------------------------------

/** The minimal shape needed to resolve a Service's button. */
export type ServiceCtaInput = {
  ctaLabel?: ServiceCtaLabel | null;
  websiteUrl?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  showEmail?: boolean;
  showPhone?: boolean;
  /** The professional turned Relevé booking on for THIS service. */
  bookingEnabled?: boolean;
  /** The booking rail is live platform-wide. False until it ships → coming-soon. */
  bookingLive?: boolean;
};

/**
 * A fully-resolved button, ready to render:
 *   - releve_booking: book THIS service on Relevé (the intended primary action).
 *                     `enabled` is false until native booking ships, so the card
 *                     shows "Book on Relevé" as a coming-soon state rather than
 *                     a button that lies.
 *   - link:           the member's own site — identity/credibility, NOT a booking
 *                     pathway, and never a way to take the transaction off Relevé.
 *   - contact:        a mailto:/tel: the member explicitly chose to publish
 *   - none:           render no button (nothing to point at)
 */
export type ResolvedServiceCta =
  | { action: "releve_booking"; label: string; enabled: boolean }
  | { action: "link"; label: string; href: string }
  | { action: "contact"; label: string; href: string }
  | { action: "none" };

/**
 * Resolve the button for a Service.
 *
 * ── 2026-08-15: bookings happen ON Relevé ──
 * The external Booking Link is GONE as a booking pathway (founder decision). A
 * Professional Service is not an outbound directory listing: the intended flow is
 * Profile → Service → Relevé availability → book on Relevé → Relevé checkout →
 * professional payout + configurable platform fee. Sending a ready-to-buy visitor
 * to someone's Calendly was the one thing that made that impossible, because the
 * booking, the money, and the record all left the platform at the first click.
 *
 * Rules now:
 *   1. Booking enabled for this service → "Book on Relevé" (disabled until the
 *      booking rail ships — see `bookingEnabled` / `bookingLive`).
 *   2. Otherwise a Website → "Visit Website" (identity, not a booking path).
 *   3. Otherwise published contact info → "Contact" (mailto, else tel).
 *   4. Otherwise no button.
 * An explicit `ctaLabel` override only changes the WORDS of the fallback link,
 * never the destination, and can never override the Relevé booking action.
 * Contact details that were NOT opted into are never linked.
 * Pure and total — always returns a ResolvedServiceCta.
 */
export function deriveServiceCta(input: ServiceCtaInput): ResolvedServiceCta {
  const website = clean(input.websiteUrl ?? null);
  const email = input.showEmail ? clean(input.businessEmail ?? null) : null;
  const phone = input.showPhone ? clean(input.businessPhone ?? null) : null;
  const override = input.ctaLabel ?? null;

  // The professional turned booking on for this service. Until the booking rail
  // is live platform-wide (`bookingLive`), this renders as a coming-soon state.
  if (input.bookingEnabled) {
    return {
      action: "releve_booking",
      label: BOOK_ON_RELEVE,
      enabled: Boolean(input.bookingLive),
    };
  }
  if (website) {
    return {
      action: "link",
      label: externalLabel(override, "visit_website"),
      href: website,
    };
  }
  if (email) {
    return { action: "contact", label: externalLabel(override, "contact"), href: `mailto:${email}` };
  }
  if (phone) {
    return {
      action: "contact",
      label: externalLabel(override, "contact"),
      href: `tel:${phone.replace(/[^\d+]/g, "")}`,
    };
  }
  return { action: "none" };
}

/**
 * Where the business card / logo image should link, if anywhere. The website
 * only — the external booking link is gone (see deriveServiceCta), so a card
 * image can no longer become a side door out to someone else's checkout.
 * Contact-only services get a non-clickable image: a mailto fired by clicking a
 * picture is a surprise, not a feature.
 */
export function cardImageHref(input: { websiteUrl?: string | null }): string | null {
  return clean(input.websiteUrl ?? null);
}

// ---- Persisted row shape ---------------------------------------------------

/** The persisted Service row (what the builder, cards, and admin render from). */
export type ServiceRow = {
  id: string;
  category: ServiceCategory;
  category_other_label: string | null;
  business_name: string;
  short_description: string | null;
  location: string | null;
  service_type: ServiceType | null;
  website_url: string | null;
  social_url: string | null;
  business_email: string | null;
  business_phone: string | null;
  show_email: boolean;
  show_phone: boolean;
  image_url: string | null;
  cta_label: ServiceCtaLabel | null;
  instrument: Instrument | null;
  instrument_other: string | null;
  accompanist_for: AccompanistFor[] | null;
  rate_display: string | null;
  rate_contact: boolean;
  media_url: string | null;
  status: ServiceStatus;
  moderation_status: ModerationStatus;
  sort_order: number;
};

/** The column list every Service read selects. One place, so they can't drift. */
export const SERVICE_SELECT =
  "id, category, category_other_label, business_name, short_description, location, " +
  "service_type, website_url, social_url, business_email, business_phone, " +
  "show_email, show_phone, image_url, cta_label, instrument, instrument_other, " +
  "accompanist_for, rate_display, rate_contact, media_url, status, moderation_status, sort_order";

/**
 * Strip a row down to what a PUBLIC visitor may see. The public page reads with
 * the service-role client (which bypasses RLS), so the privacy rule has to be
 * applied in code — this is that one place. Unpublished contact details never
 * leave the server.
 */
export type PublicServiceRow = Omit<ServiceRow, "business_email" | "business_phone"> & {
  business_email: string | null;
  business_phone: string | null;
};

export function toPublicService(row: ServiceRow): PublicServiceRow {
  return {
    ...row,
    business_email: row.show_email ? row.business_email : null,
    business_phone: row.show_phone ? row.business_phone : null,
  };
}

/** True when a row may appear on the public profile (status + moderation seam). */
export function isPubliclyVisible(row: Pick<ServiceRow, "status" | "moderation_status">): boolean {
  return row.status === "active" && row.moderation_status !== "removed";
}
