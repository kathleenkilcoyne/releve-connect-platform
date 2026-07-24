// Plain (non-"use server") constants for the Families join flow.
//
// These MUST NOT live in actions.ts: that file is "use server", and Next.js only
// permits async-function exports from a server-action module. A client component
// importing a non-function value from a "use server" file receives `undefined`
// at runtime — which is exactly how STUDENT_AGE_RANGES.map became
// "not a function" on the enrollment form. Keeping the constant here lets both
// the client form and the server action import it safely.

/** Studio-safe age brackets a guardian can pick for a child. */
export const STUDENT_AGE_RANGES = [
  "Under 5",
  "5–7",
  "8–10",
  "11–13",
  "14–17",
] as const;
