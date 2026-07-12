// Pure helpers for the Roster hiring actions (save + the lean in-app intro
// request, CLAUDE.md Open Decision 2). Kept dependency-free so the rules can be
// unit-tested without a DB or React.

export const INTRO_MIN_LEN = 10;
export const INTRO_MAX_LEN = 1000;

export type IntroValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * Validate + normalize an intro-request note. Trims, enforces a minimum (so it's
 * a real message, not an empty ping) and a maximum (this is a lean intro, not a
 * chat inbox — Open Decision 2).
 */
export function normalizeIntroMessage(raw: string | null | undefined): IntroValidation {
  const value = (raw ?? "").trim();
  if (value.length < INTRO_MIN_LEN) {
    return { ok: false, error: `Please write at least ${INTRO_MIN_LEN} characters so they know why you're reaching out.` };
  }
  if (value.length > INTRO_MAX_LEN) {
    return { ok: false, error: `Keep it short — under ${INTRO_MAX_LEN} characters. You can share more once they respond.` };
  }
  return { ok: true, value };
}

/**
 * Can this viewer act (save / request an intro) on a profile? Any active member
 * may connect (founder decision 2026-07-12) — but never on their OWN profile,
 * and only when signed in with an active membership.
 */
export function canConnect(input: {
  viewerUserId: string | null;
  viewerHasActiveMembership: boolean;
  profileOwnerUserId: string;
}): boolean {
  const { viewerUserId, viewerHasActiveMembership, profileOwnerUserId } = input;
  if (!viewerUserId) return false;
  if (!viewerHasActiveMembership) return false;
  if (viewerUserId === profileOwnerUserId) return false; // no connecting to yourself
  return true;
}
