// Org-type-aware copy for the shared org editor (studio owner vs Team Director).
//
// The editor, branding, and setup page are ONE engine with two faces (the Dance
// Teams "one engine, many faces" principle). This pure helper is the single
// source of the org-noun / role labels so the studio and dance-team wording can
// never drift — and so it can be unit-tested without a DB or React.

export interface OrgCopy {
  isTeam: boolean;
  /** "team" | "studio" */
  noun: string;
  /** "Team" | "Studio" (sentence-leading) */
  Noun: string;
  /** "Team Director" | "studio owner" */
  owner: string;
  /** "Team name" | "Studio name" */
  nameLabel: string;
  /** Submit button. */
  saveLabel: string;
  /** Page H1 for a fresh (untouched) org and a returning one. */
  setupTitle: string;
  returningTitle: string;
  /** The eyebrow line over the setup page. */
  eyebrow: string;
}

export function orgCopy(orgType: string | null | undefined): OrgCopy {
  const isTeam = orgType === "dance_team";
  const noun = isTeam ? "team" : "studio";
  const Noun = isTeam ? "Team" : "Studio";
  return {
    isTeam,
    noun,
    Noun,
    owner: isTeam ? "Team Director" : "studio owner",
    nameLabel: `${Noun} name`,
    saveLabel: `Save ${noun} profile`,
    setupTitle: `Set up your ${noun}`,
    returningTitle: `Your ${noun}`,
    eyebrow: isTeam ? "Relevé · Team setup" : "Relevé · Founding Studio setup",
  };
}
