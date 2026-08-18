import { describe, it, expect } from "vitest";
import {
  artistTransferCents,
  LOCAL_SITE_URL,
  platformFeeCents,
  resolveSiteUrl,
  SIGNATURE_PRICE_CENTS,
  SiteUrlNotConfiguredError,
  type SiteUrlEnv,
} from "./config";

// ---------------------------------------------------------------------------
// The 80/20 split — the no-tax-on-labor canon. Locked so it cannot drift.
// ---------------------------------------------------------------------------
describe("the Signature Experience split", () => {
  it("takes 20% for Relevé and leaves 80% to the artist", () => {
    expect(platformFeeCents(SIGNATURE_PRICE_CENTS)).toBe(9_980);
    expect(artistTransferCents(SIGNATURE_PRICE_CENTS)).toBe(39_920);
  });

  it("always accounts for every cent — fee + transfer is the whole sale", () => {
    for (const amount of [1, 7, 99, 4_999, 49_900, 150_000, 1]) {
      expect(platformFeeCents(amount) + artistTransferCents(amount)).toBe(amount);
    }
  });
});

// ---------------------------------------------------------------------------
// F5 — NEXT_PUBLIC_SITE_URL must never fail silently in production.
//
// These run against an injected environment, never the real process.env, so a
// test can describe production without any risk of leaking into another test.
// ---------------------------------------------------------------------------

const dev = (over: Partial<SiteUrlEnv> = {}): SiteUrlEnv => ({
  NODE_ENV: "development",
  ...over,
});
const prod = (over: Partial<SiteUrlEnv> = {}): SiteUrlEnv => ({
  NODE_ENV: "production",
  ...over,
});
const build = (over: Partial<SiteUrlEnv> = {}): SiteUrlEnv => ({
  NODE_ENV: "production",
  NEXT_PHASE: "phase-production-build",
  ...over,
});

describe("resolveSiteUrl — local development keeps working", () => {
  it("falls back to localhost when the variable is unset", () => {
    expect(resolveSiteUrl(dev())).toBe(LOCAL_SITE_URL);
  });

  it("falls back to localhost when the variable is blank or whitespace", () => {
    expect(resolveSiteUrl(dev({ NEXT_PUBLIC_SITE_URL: "" }))).toBe(LOCAL_SITE_URL);
    expect(resolveSiteUrl(dev({ NEXT_PUBLIC_SITE_URL: "   " }))).toBe(LOCAL_SITE_URL);
  });

  it("falls back rather than throwing on a malformed value in development", () => {
    expect(resolveSiteUrl(dev({ NEXT_PUBLIC_SITE_URL: "releveconnect.com" }))).toBe(LOCAL_SITE_URL);
  });

  it("still honours an explicitly set URL (tunnels, preview hosts)", () => {
    expect(resolveSiteUrl(dev({ NEXT_PUBLIC_SITE_URL: "https://abc.ngrok.io" }))).toBe(
      "https://abc.ngrok.io",
    );
  });

  it("treats an absent NODE_ENV as non-production", () => {
    expect(resolveSiteUrl({})).toBe(LOCAL_SITE_URL);
  });
});

describe("resolveSiteUrl — production fails loudly", () => {
  it("throws when the variable is not set", () => {
    expect(() => resolveSiteUrl(prod())).toThrow(SiteUrlNotConfiguredError);
  });

  it("throws when the variable is blank", () => {
    expect(() => resolveSiteUrl(prod({ NEXT_PUBLIC_SITE_URL: "  " }))).toThrow(
      SiteUrlNotConfiguredError,
    );
  });

  it("throws on a relative or scheme-less value", () => {
    for (const bad of ["releveconnect.com", "/subscribe", "www.releveconnect.com"]) {
      expect(() => resolveSiteUrl(prod({ NEXT_PUBLIC_SITE_URL: bad }))).toThrow(
        SiteUrlNotConfiguredError,
      );
    }
  });

  it("throws on a non-http scheme", () => {
    expect(() => resolveSiteUrl(prod({ NEXT_PUBLIC_SITE_URL: "ftp://releveconnect.com" }))).toThrow(
      SiteUrlNotConfiguredError,
    );
  });

  // The failure mode that a mere presence check would have missed.
  it("throws when production points at a loopback address", () => {
    for (const bad of [
      "http://localhost:3000",
      "http://LOCALHOST:3000",
      "http://127.0.0.1:3000",
      "http://0.0.0.0:3000",
      "http://[::1]:3000",
    ]) {
      expect(() => resolveSiteUrl(prod({ NEXT_PUBLIC_SITE_URL: bad }))).toThrow(
        SiteUrlNotConfiguredError,
      );
    }
  });

  it("names the variable and says how to fix it", () => {
    try {
      resolveSiteUrl(prod());
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as Error).message).toContain("NEXT_PUBLIC_SITE_URL");
      expect((e as Error).message).toContain("releveconnect.com");
    }
  });

  it("accepts a correct production value, trailing slash and all", () => {
    expect(resolveSiteUrl(prod({ NEXT_PUBLIC_SITE_URL: "https://releveconnect.com" }))).toBe(
      "https://releveconnect.com",
    );
    expect(resolveSiteUrl(prod({ NEXT_PUBLIC_SITE_URL: "https://releveconnect.com/" }))).toBe(
      "https://releveconnect.com",
    );
  });

  it("accepts a Vercel preview host", () => {
    expect(
      resolveSiteUrl(prod({ NEXT_PUBLIC_SITE_URL: "https://releve-git-branch.vercel.app" })),
    ).toBe("https://releve-git-branch.vercel.app");
  });
});

// The trap named in the brief: a broken build is its own kind of outage.
describe("resolveSiteUrl — `next build` is never broken by this", () => {
  it("does not throw during the production build phase when unset", () => {
    expect(resolveSiteUrl(build())).toBe(LOCAL_SITE_URL);
  });

  it("does not throw during the build phase on a malformed value", () => {
    expect(resolveSiteUrl(build({ NEXT_PUBLIC_SITE_URL: "not a url" }))).toBe(LOCAL_SITE_URL);
  });

  it("still uses a good value during the build phase", () => {
    expect(resolveSiteUrl(build({ NEXT_PUBLIC_SITE_URL: "https://releveconnect.com" }))).toBe(
      "https://releveconnect.com",
    );
  });
});
