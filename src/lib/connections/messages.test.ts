import { describe, it, expect } from "vitest";
import { normalizeIntroMessage, canConnect, INTRO_MIN_LEN, INTRO_MAX_LEN } from "./messages";

describe("normalizeIntroMessage", () => {
  it("accepts and trims a real message", () => {
    const res = normalizeIntroMessage("  Hi, I'd love to have you sub a class.  ");
    expect(res).toEqual({ ok: true, value: "Hi, I'd love to have you sub a class." });
  });

  it("rejects empty or too-short notes", () => {
    expect(normalizeIntroMessage("").ok).toBe(false);
    expect(normalizeIntroMessage("   ").ok).toBe(false);
    expect(normalizeIntroMessage("hi").ok).toBe(false);
    expect(normalizeIntroMessage(null).ok).toBe(false);
    expect(normalizeIntroMessage(undefined).ok).toBe(false);
  });

  it("accepts exactly the minimum length", () => {
    expect(normalizeIntroMessage("x".repeat(INTRO_MIN_LEN)).ok).toBe(true);
  });

  it("rejects an over-long note", () => {
    expect(normalizeIntroMessage("x".repeat(INTRO_MAX_LEN + 1)).ok).toBe(false);
    expect(normalizeIntroMessage("x".repeat(INTRO_MAX_LEN)).ok).toBe(true);
  });
});

describe("canConnect", () => {
  const owner = "owner-1";
  it("allows an active member on someone else's profile", () => {
    expect(
      canConnect({ viewerUserId: "viewer-1", viewerHasActiveMembership: true, profileOwnerUserId: owner }),
    ).toBe(true);
  });

  it("blocks a logged-out visitor", () => {
    expect(
      canConnect({ viewerUserId: null, viewerHasActiveMembership: true, profileOwnerUserId: owner }),
    ).toBe(false);
  });

  it("blocks a signed-in member with no active membership", () => {
    expect(
      canConnect({ viewerUserId: "viewer-1", viewerHasActiveMembership: false, profileOwnerUserId: owner }),
    ).toBe(false);
  });

  it("blocks connecting to your own profile", () => {
    expect(
      canConnect({ viewerUserId: owner, viewerHasActiveMembership: true, profileOwnerUserId: owner }),
    ).toBe(false);
  });
});
