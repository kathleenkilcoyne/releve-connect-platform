// The Climb — the public archive of past issues.
//
// Deliberately a plain list in code, not a table or an admin screen. The Climb
// goes out monthly, so this changes twelve times a year; a database table and a
// CRUD UI would be more machinery than the thing it manages.
//
// ── To add an issue ──
// Publish it in MailerLite, open the campaign, copy its WEB-VIEW URL (the
// "view in browser" link — NOT the tracked click URL from an email, which is
// per-subscriber and will not work for the public), and add a row below.
// Newest first.

export interface ClimbIssue {
  /** "Issue 01" */
  number: string;
  /** "Together We Rise" */
  title: string;
  /** ISO date the issue went out — used for display only. */
  date: string;
  /** MailerLite web-view URL. Must be publicly readable without an account. */
  url: string;
  /** One line on what's inside, for the archive list. */
  blurb?: string;
}

/**
 * Past issues, newest first.
 *
 * Empty until the web-view URLs are added. Issue 01 ("Together We Rise") went
 * out before this page existed — paste its web-view URL here to publish it.
 */
export const CLIMB_ISSUES: readonly ClimbIssue[] = [
  // {
  //   number: "Issue 01",
  //   title: "Together We Rise",
  //   date: "2026-07-01",
  //   url: "https://preview.mailerlite.io/…",
  //   blurb: "The first one — why Relevé exists, and who it's for.",
  // },
];
