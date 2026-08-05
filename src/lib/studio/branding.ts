// Organization branding — the PURE core (no I/O, no React), so the monogram,
// contrast, and motto rules can be proven in tests and reused by the server
// (This Week header, join reveal) and the admin editor.
//
// Design intent: an org's accent is used only on SAFE surfaces (a tinted tile, a
// thin rule) with a COMPUTED accessible foreground — never as raw text color on
// the page. So any accent a Team Director picks stays legible.

export const MOTTO_MAX = 60;

/** The resolved branding for one org, as the header/reveal consume it. */
export interface OrgBrand {
  name: string;
  logoUrl: string | null;
  accent: string | null;
  accent2: string | null;
  motto: string | null;
}

/* ─────────────────────────────  Hex colors  ──────────────────────────────── */

/** #rgb or #rrggbb (case-insensitive). */
export function isHexColor(v: string | null | undefined): boolean {
  return typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

/** Normalize to #rrggbb lowercase, or null if not a valid hex. */
export function normalizeHex(v: string | null | undefined): string | null {
  if (!isHexColor(v)) return null;
  let h = (v as string).trim().toLowerCase().slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h}`;
}

function channels(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? "#000000";
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const srgb = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const NEAR_BLACK = "#111111";
const WHITE = "#ffffff";

/**
 * The legible foreground for text/marks placed ON `bg`: near-black or white,
 * whichever has the higher contrast. A dark accent yields white; a light accent
 * yields near-black — both legible. Invalid input falls back to near-black.
 */
export function readableTextColor(bg: string | null | undefined): string {
  const hex = normalizeHex(bg);
  if (!hex) return NEAR_BLACK;
  return contrastRatio(hex, WHITE) >= contrastRatio(hex, NEAR_BLACK) ? WHITE : NEAR_BLACK;
}

/**
 * True when an accent is so light it would be nearly invisible on the app's
 * cream/white surfaces — the editor warns (does not block) on save.
 */
export function accentIsWashedOut(hex: string | null | undefined): boolean {
  const norm = normalizeHex(hex);
  if (!norm) return false;
  return contrastRatio(norm, WHITE) < 1.3;
}

/* ─────────────────────────────  Motto  ────────────────────────────────────── */

/** Trim; null when empty. (Length is validated separately so the UI can warn.) */
export function normalizeMotto(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export function isValidMotto(v: string | null | undefined): boolean {
  const t = normalizeMotto(v);
  return t === null || t.length <= MOTTO_MAX;
}

/* ─────────────────────────────  Monogram  ─────────────────────────────────── */

/**
 * Initials for the logo-less fallback tile. Up to three letters taken from the
 * significant words of the org name — skipping the leading article "The" and any
 * "(…)" parenthetical tags. A single significant word yields its first two
 * letters ("Rockettes" → "RO"); multiple words yield one initial each, capped at
 * three ("The Manhattan College Dance Team" → "MCD").
 */
export function monogramFrom(name: string | null | undefined): string {
  const cleaned = (name ?? "")
    .replace(/\([^)]*\)/g, " ") // drop "(…)" tags
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // keep letters/numbers/space
    .trim();

  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 0 && w.toLowerCase() !== "the");

  if (words.length === 0) {
    const fallback = cleaned.replace(/\s+/g, "");
    return fallback.slice(0, 2).toUpperCase();
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* ─────────────────────────  Header render model  ──────────────────────────── */

/** Everything the co-branded header needs, computed once (pure). */
export interface BrandHeaderModel {
  name: string;
  logoUrl: string | null;
  monogram: string;
  /** The accent for safe surfaces (tile/rule), or null to fall back to neutral. */
  accent: string | null;
  /** Legible foreground for marks placed on the accent tile. */
  foreground: string;
  motto: string | null;
}

/**
 * Resolve a brand into the header's render model. Depends ONLY on the brand
 * (from the member's affiliation) — never on schedule items — so the header
 * renders identically whether or not the member has any events this week.
 */
export function brandHeaderModel(brand: OrgBrand): BrandHeaderModel {
  const accent = normalizeHex(brand.accent);
  return {
    name: brand.name,
    logoUrl: brand.logoUrl && brand.logoUrl.trim() !== "" ? brand.logoUrl : null,
    monogram: monogramFrom(brand.name),
    accent,
    foreground: readableTextColor(accent ?? WHITE),
    motto: normalizeMotto(brand.motto),
  };
}
