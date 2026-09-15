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
