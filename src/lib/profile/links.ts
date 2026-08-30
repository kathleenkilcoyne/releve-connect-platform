// Normalizes a professional's typed social/website links into safe, absolute
// external URLs for rendering. Pure + dependency-free (no DB, no React) so the
// exact bug class that broke Todd Shanks's and Geoffrey Doig-Marx's Website
// links — a bare domain like "toddshanks.com" rendered as-is in an <a href>,
// which the browser resolves RELATIVE to the current page (producing
// releveconnect.com/toddshanks.com instead of https://toddshanks.com) — can be
// unit-tested without a browser.
//
// Used at BOTH ends of the pipe: at save time (so newly-typed links are stored
// already-normalized) and at render time (so links already stored raw, like
// Todd's and Geoffrey's, are fixed retroactively with no data migration).

/**
 * Normalize a generic external link (Website, Facebook, TikTok, LinkedIn,
 * Vimeo, YouTube-as-a-profile-link, …). A bare domain gets `https://`
 * prepended; an already-absolute http(s) URL passes through unchanged (so
 * correctly-entered links, like Kathleen's own, are never altered). Anything
 * that still isn't a valid http(s) URL after that — garbage input, a
 * javascript: URL, an empty string — returns null so the caller can simply not
 * render it, rather than emit a broken or unsafe href.
 */
export function normalizeExternalLink(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Normalize an Instagram entry into a canonical profile URL. Accepts every
 * shape the app has ever asked for or a member might reasonably paste:
 *   @username · username · instagram.com/username · https://instagram.com/username
 *   · https://www.instagram.com/username (with or without a trailing slash / query string).
 * Returns null for empty input or a value with no extractable username.
 */
export function normalizeInstagramLink(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const fromUrl = trimmed.match(/instagram\.com\/@?([A-Za-z0-9_.]+)/i);
  const username = fromUrl ? fromUrl[1] : trimmed.replace(/^@/, "");
  if (!username || !/^[A-Za-z0-9_.]+$/.test(username)) return null;

  return `https://instagram.com/${username}`;
}

/** Per-key dispatch — every social key normalizes the same way except Instagram. */
const SPECIAL_NORMALIZERS: Partial<Record<string, (raw: string) => string | null>> = {
  instagram: normalizeInstagramLink,
};

/**
 * Normalize a stored social-link value by its key (website, instagram, …).
 * Returns null when the value can't be turned into a safe external link — the
 * caller's job is then to skip rendering it, never to render a broken href.
 */
export function normalizeSocialLink(key: string, raw: string | null | undefined): string | null {
  const normalizer = SPECIAL_NORMALIZERS[key] ?? normalizeExternalLink;
  return normalizer(raw ?? "");
}
