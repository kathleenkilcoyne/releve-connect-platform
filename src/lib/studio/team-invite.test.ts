import { describe, it, expect } from "vitest";
import { parseInviteAddresses, resolveCoachName } from "./team-invite";

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

describe("resolveCoachName", () => {
  it("prefers the org's artistic_director (the real person's name)", () => {
    expect(
      resolveCoachName({
        artisticDirector: ["Madeline Donohue"],
        displayName: "Manhattan University Dance Team",
        teamName: "Manhattan University Dance Team",
      }),
    ).toBe("Madeline Donohue");
  });

  it("takes the first name when artistic_director has co-directors", () => {
    expect(
      resolveCoachName({
        artisticDirector: ["Jordan Blake", "Sam Rivera"],
        displayName: null,
        teamName: "Vanguard Dance Team",
      }),
    ).toBe("Jordan Blake");
  });

  it("skips blank entries in artistic_director", () => {
    expect(
      resolveCoachName({ artisticDirector: ["  ", ""], displayName: "Real Name", teamName: "Team" }),
    ).toBe("Real Name");
  });

  it("REGRESSION: never uses display_name when it is just the team's own name reflected back", () => {
    // This is the exact production bug: studio/edit's save path sets an org
    // owner's users.display_name to the org's own name, so an unguarded
    // fallback produced "Manhattan University Dance Team invited you to join
    // Manhattan University Dance Team on Relevé."
    expect(
      resolveCoachName({
        artisticDirector: [],
        displayName: "Manhattan University Dance Team",
        teamName: "Manhattan University Dance Team",
      }),
    ).toBe("Your coach");
  });

  it("falls back to display_name when it genuinely differs from the team name", () => {
    expect(
      resolveCoachName({ artisticDirector: null, displayName: "Jamie Lee", teamName: "Montclair Dance" }),
    ).toBe("Jamie Lee");
  });

  it("falls back to 'Your coach' when nothing usable is available", () => {
    expect(resolveCoachName({ artisticDirector: [], displayName: null, teamName: "Team" })).toBe(
      "Your coach",
    );
  });
});
