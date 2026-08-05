// Dance Teams umbrella — the team "flavor" vocabulary (display-only).
//
// A dance team's org_type is always 'dance_team'; team_type is a display-only
// label that switches the join page's language ("College Dance Team" vs
// "Professional Dance Company"). It NEVER branches the join structure — every
// dance team creates the same self-managed adult record. member_label is what a
// team calls its members ("Dancers", "Athletes", …); copy falls back to
// "Team Members".

export const TEAM_TYPES = [
  "college",
  "pro_sports",
  "pro_company",
  "independent",
  "other",
] as const;
export type TeamType = (typeof TEAM_TYPES)[number];

/** The label shown to a joining dancer under the org banner. */
export const TEAM_TYPE_LABELS: Record<TeamType, string> = {
  college: "College Dance Team",
  pro_sports: "Pro Sports Dance Team",
  pro_company: "Professional Dance Company",
  independent: "Independent Dance Team",
  other: "Dance Team",
};

/** The admin-facing option labels (invite console). */
export const TEAM_TYPE_OPTION_LABELS: Record<TeamType, string> = {
  college: "College dance team",
  pro_sports: "Pro sports dance team",
  pro_company: "Professional dance company",
  independent: "Independent dance team",
  other: "Other dance team",
};

export const DEFAULT_MEMBER_LABEL = "Team Members";

export function isTeamType(v: unknown): v is TeamType {
  return typeof v === "string" && (TEAM_TYPES as readonly string[]).includes(v);
}

/** Resolve the display label from a stored (possibly null) team_type. */
export function teamTypeLabel(teamType: string | null | undefined): string {
  return isTeamType(teamType) ? TEAM_TYPE_LABELS[teamType] : "Dance Team";
}

/** What this team calls its members, defaulting when unset. */
export function memberLabelOf(memberLabel: string | null | undefined): string {
  const s = (memberLabel ?? "").trim();
  return s === "" ? DEFAULT_MEMBER_LABEL : s;
}
