// Dance team — parsing for the "invite your members by email" box on
// /studio/schedule. Pure, no DB/server imports, so it runs identically on the
// client (live parsed-count preview) and the server (the authoritative
// validation before anything is sent) — one parser, not two that can drift.

// Same shape as the admin studio-invite route's EMAIL_RE — kept local (not
// imported) since that file is route-scoped and this needs to stay a
// zero-dependency module callable from a client component.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Emails never contain commas, semicolons, or whitespace, so splitting on any
// run of those characters is always safe — handles comma, semicolon, space,
// and newline (and any mix) as the same delimiter.
const SPLIT_RE = /[,;\s]+/;

export interface ParsedAddresses {
  /** Valid, de-duplicated (case-insensitive), lower-cased addresses, in first-seen order. */
  valid: string[];
  /** Malformed tokens, exactly as typed, de-duplicated, in first-seen order. */
  invalid: string[];
}

/** Split, validate, and de-duplicate a free-typed list of email addresses. */
export function parseInviteAddresses(raw: string): ParsedAddresses {
  const tokens = raw
    .split(SPLIT_RE)
    .map((t) => t.trim())
    .filter(Boolean);

  const seenValid = new Set<string>();
  const seenInvalid = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    const email = token.toLowerCase();
    if (EMAIL_RE.test(email)) {
      if (!seenValid.has(email)) {
        seenValid.add(email);
        valid.push(email);
      }
    } else if (!seenInvalid.has(token)) {
      seenInvalid.add(token);
      invalid.push(token);
    }
  }

  return { valid, invalid };
}

/**
 * Who to credit as the sender in the invite email.
 *
 * Prefers the team's own "Coach / Team Director" field
 * (`employer_profiles.artistic_director` — a real person's name, captured for
 * exactly this purpose in the org profile editor) over the signed-in user's
 * `users.display_name`. That field is NOT safe to use unguarded: saving an
 * org's profile (src/app/studio/edit/actions.ts) sets the OWNER's
 * `display_name` to the ORG's own name, so using it directly produced
 * "Manhattan University Dance Team invited you to join Manhattan University
 * Dance Team on Relevé" for every org owner who had ever saved their profile.
 * `displayName` is used only as a second fallback, and only when it is
 * demonstrably NOT just the team's own name reflected back.
 */
export function resolveCoachName(input: {
  artisticDirector: string[] | null | undefined;
  displayName: string | null | undefined;
  teamName: string;
}): string {
  const director = (input.artisticDirector ?? []).map((d) => d.trim()).find(Boolean);
  if (director) return director;

  const display = input.displayName?.trim();
  if (display && display !== input.teamName.trim()) return display;

  return "Your coach";
}
