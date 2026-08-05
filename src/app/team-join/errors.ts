// Dance-team join page — the canonical error/validation copy.
//
// Kept in a plain module (NOT the "use server" actions file, which may only
// export async functions) so both the server action and the page can share it.

export const TEAM_JOIN_ERRORS = {
  invalid: "That team code isn't valid. Please check with your Team Director.",
  family:
    "That's a studio family code, not a dance team code. If you're a parent joining a studio, use the family join page instead.",
  expired:
    "That team code has expired or been fully used — ask your Team Director for a new one.",
  notConfirmed: "Please confirm you're joining as an adult dancer (18 or older).",
  noName: "Please enter your name.",
  sessionLost: "Your session expired — please sign in again.",
  generic: "Something went wrong — please try again in a moment.",
} as const;

export type TeamJoinErrorReason = "invalid" | "family" | "expired";
