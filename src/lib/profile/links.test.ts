import { describe, it, expect } from "vitest";
import { normalizeExternalLink, normalizeInstagramLink, normalizeSocialLink } from "./links";

describe("normalizeExternalLink", () => {
  it("prepends https:// to a bare domain (Todd Shanks's actual stored value)", () => {
    expect(normalizeExternalLink("toddshanks.com")).toBe("https://toddshanks.com/");
  });

  it("prepends https:// to a bare www. domain", () => {
    expect(normalizeExternalLink("www.toddshanks.com")).toBe("https://www.toddshanks.com/");
  });

  it("prepends https:// to a bare domain (Geoffrey Doig-Marx's actual stored value)", () => {
    expect(normalizeExternalLink("gdmartist.com")).toBe("https://gdmartist.com/");
  });

  it("passes an already-https URL through unchanged in substance (Kathleen's own stored value)", () => {
    expect(normalizeExternalLink("https://www.releveconnect.com")).toBe("https://www.releveconnect.com/");
  });

  it("preserves an explicit http:// scheme rather than forcing https", () => {
    expect(normalizeExternalLink("http://example.com")).toBe("http://example.com/");
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(normalizeExternalLink("")).toBeNull();
    expect(normalizeExternalLink("   ")).toBeNull();
    expect(normalizeExternalLink(null)).toBeNull();
    expect(normalizeExternalLink(undefined)).toBeNull();
  });

  it("rejects a non-http(s) scheme rather than rendering it", () => {
    expect(normalizeExternalLink("javascript:alert(1)")).toBeNull();
  });

  it("returns null for a value that still isn't a valid URL once https:// is added", () => {
    expect(normalizeExternalLink("not a url at all")).toBeNull();
  });
});

describe("normalizeInstagramLink", () => {
  it("accepts a bare username (Todd Shanks's actual stored value)", () => {
    expect(normalizeInstagramLink("toddshanks")).toBe("https://instagram.com/toddshanks");
  });

  it("accepts an @-prefixed handle", () => {
    expect(normalizeInstagramLink("@toddshanks")).toBe("https://instagram.com/toddshanks");
  });

  it("accepts a bare instagram.com/username", () => {
    expect(normalizeInstagramLink("instagram.com/toddshanks")).toBe("https://instagram.com/toddshanks");
  });

  it("accepts a full https URL and normalizes the host (drops www.)", () => {
    expect(normalizeInstagramLink("https://www.instagram.com/toddshanks")).toBe(
      "https://instagram.com/toddshanks",
    );
  });

  it("passes an already-canonical URL through unchanged (Kathleen's own stored value)", () => {
    expect(normalizeInstagramLink("https://instagram.com/kathleenmcaree")).toBe(
      "https://instagram.com/kathleenmcaree",
    );
  });

  it("strips a trailing slash or query string from a pasted profile URL", () => {
    expect(normalizeInstagramLink("https://instagram.com/toddshanks/")).toBe(
      "https://instagram.com/toddshanks",
    );
    expect(normalizeInstagramLink("https://instagram.com/toddshanks?hl=en")).toBe(
      "https://instagram.com/toddshanks",
    );
  });

  it("returns null for empty input", () => {
    expect(normalizeInstagramLink("")).toBeNull();
    expect(normalizeInstagramLink(null)).toBeNull();
  });

  it("returns null when no valid username can be extracted", () => {
    expect(normalizeInstagramLink("https://instagram.com/")).toBeNull();
    expect(normalizeInstagramLink("@")).toBeNull();
  });
});

describe("normalizeSocialLink — dispatch by key", () => {
  it("routes 'instagram' through the Instagram normalizer", () => {
    expect(normalizeSocialLink("instagram", "toddshanks")).toBe("https://instagram.com/toddshanks");
  });

  it("routes every other key through the generic external-link normalizer", () => {
    expect(normalizeSocialLink("website", "toddshanks.com")).toBe("https://toddshanks.com/");
    expect(normalizeSocialLink("facebook", "facebook.com/toddshanks")).toBe(
      "https://facebook.com/toddshanks",
    );
    expect(normalizeSocialLink("tiktok", "https://tiktok.com/@releveconnect")).toBe(
      "https://tiktok.com/@releveconnect",
    );
  });

  it("returns null (never a broken href) for malformed input on any key", () => {
    expect(normalizeSocialLink("website", "")).toBeNull();
    expect(normalizeSocialLink("instagram", "@")).toBeNull();
  });
});
