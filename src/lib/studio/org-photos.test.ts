import { describe, it, expect } from "vitest";
import { canAddGalleryPhoto, isAllowedPhotoType, MAX_GALLERY_IMAGES } from "./org-photos";

describe("canAddGalleryPhoto", () => {
  it("allows adding below the cap", () => {
    expect(canAddGalleryPhoto(0)).toBe(true);
    expect(canAddGalleryPhoto(MAX_GALLERY_IMAGES - 1)).toBe(true);
  });
  it("refuses at and above the cap of 6", () => {
    expect(canAddGalleryPhoto(MAX_GALLERY_IMAGES)).toBe(false);
    expect(canAddGalleryPhoto(MAX_GALLERY_IMAGES + 1)).toBe(false);
  });
});

describe("isAllowedPhotoType", () => {
  it("accepts PNG and JPEG", () => {
    expect(isAllowedPhotoType("image/png")).toBe(true);
    expect(isAllowedPhotoType("image/jpeg")).toBe(true);
  });
  it("rejects SVG (a photo gallery is real photographs, not vector logos)", () => {
    expect(isAllowedPhotoType("image/svg+xml")).toBe(false);
  });
  it("rejects other types", () => {
    expect(isAllowedPhotoType("image/gif")).toBe(false);
    expect(isAllowedPhotoType("application/pdf")).toBe(false);
  });
});
