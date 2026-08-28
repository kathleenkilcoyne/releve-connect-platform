import { describe, it, expect } from "vitest";
import { orgBrandingPathFromUrl } from "./org-branding-storage";

describe("orgBrandingPathFromUrl", () => {
  it("extracts the storage path from a public org-branding URL", () => {
    const url = "https://hmqqxbkhcqspqmsjxodq.supabase.co/storage/v1/object/public/org-branding/abc-123/hero-deadbeef.jpg";
    expect(orgBrandingPathFromUrl(url)).toBe("abc-123/hero-deadbeef.jpg");
  });

  it("returns null for null/empty/unrelated input", () => {
    expect(orgBrandingPathFromUrl(null)).toBeNull();
    expect(orgBrandingPathFromUrl(undefined)).toBeNull();
    expect(orgBrandingPathFromUrl("")).toBeNull();
    expect(orgBrandingPathFromUrl("https://example.com/some/other/image.jpg")).toBeNull();
  });
});
