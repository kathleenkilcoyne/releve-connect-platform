import { describe, it, expect } from "vitest";
import { noMembershipMessage } from "./messages";

describe("noMembershipMessage — the invitation-mismatch clarification (2026-09-07)", () => {
  it("shows the invitation-aware message for from=profile (the /profile/edit redirect)", () => {
    const msg = noMembershipMessage("profile");
    expect(msg.h).toMatch(/couldn't find an active invitation/i);
    expect(msg.p).toMatch(/exact email address your invitation was sent to/i);
  });

  it("shows the same invitation-aware message for from=review (the /profile/review redirect)", () => {
    const msg = noMembershipMessage("review");
    expect(msg.h).toMatch(/couldn't find an active invitation/i);
  });

  it("falls back to the original public-apply message for no `from` at all", () => {
    const msg = noMembershipMessage(null);
    expect(msg.h).toBe("Membership is by acceptance");
  });

  it("falls back to the original message for an unrelated `from` value", () => {
    const msg = noMembershipMessage("somewhere-else");
    expect(msg.h).toBe("Membership is by acceptance");
  });

  it("always offers the Apply now CTA either way — never a dead end", () => {
    expect(noMembershipMessage("profile").cta).toEqual({ href: "/welcome", label: "Apply now" });
    expect(noMembershipMessage(null).cta).toEqual({ href: "/welcome", label: "Apply now" });
  });
});
