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
  /** The wider "Relevé Connect · For X" eyebrow used on notice/error screens. */
  noticeEyebrow: string;
  /** "Coach / Team Director" | "Artistic Director" (public profile section title). */
  directorTitle: string;
  /** Public-profile section titles. */
  cultureSectionTitle: string;
  uniqueSectionTitle: string;
  aboutSectionTitle: string;
  staffScaleTitle: string;
  /** e.g. "3 coaches/staff" | "3 teachers". */
  staffCountLabel: (count: number) => string;
  /** Footer "back" link on a notice/error screen. */
  backLink: { href: string; label: string };

  // Admin review page (`/admin/studios/[id]`) field labels — a SEPARATE copy
  // surface from the public-profile section titles above. These mirror the
  // application's own question wording, not editorial headings, so they are
  // deliberately NOT the same strings as cultureSectionTitle/uniqueSectionTitle/
  // aboutSectionTitle. The Studio-side value of each is copied verbatim from
  // what the admin page already showed before it was made org-aware (fix,
  // 2026-09-02) — a Studio record must see byte-identical wording to before.
  /** "What's special about this team?" | "What is special about teaching at your school?" */
  cultureQuestionLabel: string;
  /** "What makes this team unique?" | "What makes your studio unique?" */
  uniqueQuestionLabel: string;
  /** "Team tagline" | "Your studio in one line (tagline)" */
  taglineLabel: string;
  /** "Team size" | "Student-count band" */
  scaleBandLabel: string;
  /** "Coaching staff" | "Staff (teachers)" */
  staffFieldLabel: string;
  /** "More about the team" | "Anything else about the studio" */
  bioFieldLabel: string;
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
    noticeEyebrow: isTeam ? "Relevé Connect · For Dance Teams" : "Relevé Connect · For Studios",
    directorTitle: isTeam ? "Coach / Team Director" : "Artistic Director",
    cultureSectionTitle: isTeam ? "What's special about this team" : "What is special about teaching here",
    uniqueSectionTitle: isTeam ? "What makes this team unique" : "What makes this studio unique",
    aboutSectionTitle: isTeam ? "More about the team" : "More about the studio",
    staffScaleTitle: isTeam ? "Coaches & staff" : "Teaching staff",
    staffCountLabel: (count: number) => `${count} ${isTeam ? "coaches/staff" : "teachers"}`,
    backLink: isTeam
      ? { href: "/", label: "← Back to Relevé" }
      : { href: "/studios", label: "← About Founding Studios" },

    cultureQuestionLabel: isTeam
      ? "What's special about this team?"
      : "What is special about teaching at your school?",
    uniqueQuestionLabel: isTeam ? "What makes this team unique?" : "What makes your studio unique?",
    taglineLabel: isTeam ? "Team tagline" : "Your studio in one line (tagline)",
    scaleBandLabel: isTeam ? "Team size" : "Student-count band",
    staffFieldLabel: isTeam ? "Coaching staff" : "Staff (teachers)",
    bioFieldLabel: isTeam ? "More about the team" : "Anything else about the studio",
  };
}
