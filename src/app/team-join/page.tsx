// "Join your dance team" — the ADULT self-managed entry (Dance Teams umbrella).
//
// Two steps, revealed after sign-in:
//   STEP 1 — generic. Enter the team code your Team Director gave you. Nothing
//     about the org is shown; a signed-out dancer signs in first (emailed code),
//     carrying the code through.
//   STEP 2 — once signed in AND the code resolves to a live dance team, the org
//     is revealed ("You're joining {OrgName}") and the copy switches to the
//     team's team_type language before the final confirm.
//
// Validation is server-side (validateTeamCode) and READ-ONLY — the page reveals,
// it never creates. No guardian, no minor, no family: a self-managed adult.

import { createClient } from "@/lib/supabase/server";
import { validateTeamCode } from "./actions";
import { TEAM_JOIN_ERRORS } from "./errors";
import { teamTypeLabel } from "@/lib/studio/team-types";
import TeamJoinForm, { type TeamJoinView } from "./TeamJoinForm";

export const metadata = {
  title: "Join your dance team — Relevé Connect",
  description:
    "On a dance team? Enter the team code your Team Director gave you to set up your own dancer account and see your team's week.",
};

export const dynamic = "force-dynamic";

export default async function TeamJoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawCode = params.code;
  const presetCode = (Array.isArray(rawCode) ? rawCode[0] : rawCode ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = Boolean(user);

  // Reveal only after sign-in: validate the code (read-only) once the dancer is
  // signed in and has entered one. A valid code advances to STEP 2; an invalid
  // one keeps them on STEP 1 with the matching message.
  let view: TeamJoinView = { step: "step1", signedIn, presetCode };
  if (signedIn && presetCode) {
    const v = await validateTeamCode(presetCode);
    if (v.valid) {
      view = {
        step: "step2",
        signedIn,
        presetCode,
        orgName: v.orgName,
        teamTypeLabel: teamTypeLabel(v.team_type),
        memberLabel: v.memberLabel,
      };
    } else {
      view = { step: "step1", signedIn, presetCode, error: TEAM_JOIN_ERRORS[v.reason] };
    }
  }

  return (
    <main className="mx-auto max-w-xl flex-1 px-6 py-20">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect · Dance Teams
      </p>
      <TeamJoinForm view={view} />
    </main>
  );
}
