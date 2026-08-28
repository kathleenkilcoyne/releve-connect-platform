// Shared helper: recover the `org-branding` Storage object path from one of
// its own public URLs, so a replace/delete can clean up the OLD object
// instead of leaving it orphaned in the bucket forever. Pure string parsing.

const MARKER = "/object/public/org-branding/";

export function orgBrandingPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const i = url.indexOf(MARKER);
  if (i === -1) return null;
  const path = url.slice(i + MARKER.length);
  return path || null;
}
