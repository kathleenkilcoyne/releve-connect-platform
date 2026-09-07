// Pure copy-selection logic for /subscribe's "not a member yet" branch — pulled
// out of the page component so it's directly testable without rendering an RSC.
//
// 2026-09-07 audit finding: someone who followed a Founding Professional (or
// private) invitation link, but whose sign-in email didn't match any live
// grant, lands here via the SAME generic "Membership is by acceptance — Apply
// now" message shown to a total stranger. That's honest (the system truly has
// no record for that email either way) but misleading — it reads as "you need
// to pay," when the likely explanation is a mismatched email, not a lack of
// invitation. `/profile/edit` and `/profile/review` already tag their redirect
// with `?from=profile` / `?from=review`; this only makes that existing, until-now
// unused signal change the copy — no new param, no new routing, no DB query.

export type SubscribeMessage = {
  h: string;
  p: string;
  cta: { href: string; label: string } | null;
};

const NEXT_ATTEMPT_ORIGINS = new Set(["profile", "review"]);

/**
 * The message for someone with NO application on file and NO active
 * membership. Returns the invitation-aware variant when `from` shows they
 * arrived via a profile-editor/review redirect (the shape of a broken or
 * mismatched invitation link); otherwise the original public-apply copy.
 */
export function noMembershipMessage(from: string | null | undefined): SubscribeMessage {
  if (from && NEXT_ATTEMPT_ORIGINS.has(from)) {
    return {
      h: "We couldn't find an active invitation for this email",
      p:
        "If you were personally invited to Relevé — as a Founding Professional or otherwise — " +
        "double-check you're signing in with the exact email address your invitation was sent to. " +
        "Still stuck? Reach out and we'll sort it out. Otherwise, you're welcome to apply below.",
      cta: { href: "/welcome", label: "Apply now" },
    };
  }
  return {
    h: "Membership is by acceptance",
    p: "Relevé is a vetted community of professionals. Apply to join — every application is reviewed with care.",
    cta: { href: "/welcome", label: "Apply now" },
  };
}
