// Org Hero image + Photo Gallery — shared, pure pieces (2026-08-28).
//
// Real photographs, not logo/mascot graphics — restricted to PNG/JPEG (no SVG)
// and a larger size ceiling than the logo upload, which keeps its OWN 2MB/
// PNG-JPG-SVG check unchanged in src/app/api/studio/branding/logo/route.ts.
// Shares the same `org-branding` bucket and {employer_id}/ prefix ownership
// policies as the logo — no new storage architecture.

export const MAX_GALLERY_IMAGES = 6;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

export const PHOTO_EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export function isAllowedPhotoType(mimeType: string): boolean {
  return mimeType in PHOTO_EXT_BY_TYPE;
}

/** Pure: can one more photo be added to a gallery currently holding `count`? */
export function canAddGalleryPhoto(count: number): boolean {
  return count < MAX_GALLERY_IMAGES;
}
