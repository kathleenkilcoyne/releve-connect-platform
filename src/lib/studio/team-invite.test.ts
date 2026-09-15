import { describe, it, expect } from "vitest";
import { parseInviteAddresses } from "./team-invite";

describe("parseInviteAddresses", () => {
  it("splits on commas", () => {
    expect(parseInviteAddresses("a@x.com,b@x.com").valid).toEqual(["a@x.com", "b@x.com"]);
  });

  it("splits on semicolons", () => {
    expect(parseInviteAddresses("a@x.com;b@x.com").valid).toEqual(["a@x.com", "b@x.com"]);
  });

  it("splits on spaces", () => {
    expect(parseInviteAddresses("a@x.com b@x.com").valid).toEqual(["a@x.com", "b@x.com"]);
  });

  it("splits on newlines", () => {
    expect(parseInviteAddresses("a@x.com\nb@x.com\r\nc@x.com").valid).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
    ]);
  });

  it("splits on a mix of delimiters in one paste", () => {
    expect(parseInviteAddresses("a@x.com, b@x.com;\nc@x.com   d@x.com").valid).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
  });

  it("de-duplicates case-insensitively and lower-cases the result", () => {
    const { valid } = parseInviteAddresses("a@x.com, A@X.com, a@x.com");
    expect(valid).toEqual(["a@x.com"]);
  });

  it("reports malformed entries separately, de-duplicated, without touching the valid list", () => {
    const { valid, invalid } = parseInviteAddresses("a@x.com, not-an-email, also bad, not-an-email");
    expect(valid).toEqual(["a@x.com"]);
    expect(invalid).toEqual(["not-an-email", "also", "bad"]);
  });

  it("ignores blank/whitespace-only input", () => {
    expect(parseInviteAddresses("   \n\n  ")).toEqual({ valid: [], invalid: [] });
  });

  it("ignores extra surrounding whitespace around an address", () => {
    expect(parseInviteAddresses("  a@x.com  ").valid).toEqual(["a@x.com"]);
  });

  it("rejects an address with no domain dot", () => {
    expect(parseInviteAddresses("a@localhost").invalid).toEqual(["a@localhost"]);
  });
});
