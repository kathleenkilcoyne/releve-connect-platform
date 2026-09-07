"use server";

// "Bring Your Team to Relevé" — the PUBLIC, no-login doorway's write path.
//
// 2026-09-07: this is the anonymous counterpart to /welcome/team's
// `submitTeamInterest`. Deliberately writes into the SAME `team_interest`
// table via the SAME `sendTeamInterestAlert()` admin alert — no second email
// system, no new table, no schema change. The only difference from the
// authenticated version is `user_id: null` (there is no signed-in user to
// attach) and a narrower, required field set matching what a first-touch,
// logged-out visitor should actually be asked for: team/school name,
// coach/director name, email, team type, and an optional message.
//
// `/welcome/team` itself, its auth gate, and its own action are UNTOUCHED —
// this file does not import from or modify anything there.

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTeamInterestAlert } from "@/lib/notifications";

/** Allowed team types (must match the DB check constraint on team_level). */
const TEAM_TYPES = ["middle_school", "high_school", "college", "professional", "independent"];

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}
/** Empty string → null, so the optional message stores as NULL not "". */
function orNull(v: FormDataEntryValue | null): string | null {
  const s = clean(v);
  return s === "" ? null : s;
}

export async function submitDanceTeamInterest(formData: FormData): Promise<void> {
  const teamName = clean(formData.get("team_name"));
  const coachName = clean(formData.get("coach_name"));
  const email = clean(formData.get("email"));
  const typeValue = clean(formData.get("team_level"));
  const teamLevel = TEAM_TYPES.includes(typeValue) ? typeValue : null;

  // Required: team/school name, coach/director name, email, team type. Message
  // is the only optional field, per the page's own copy. Re-checked here (not
  // just in the browser) rather than writing a half-empty row.
  if (!teamName || !coachName || !email || !teamLevel) {
    redirect("/dance-teams?error=1#interest");
  }

  const admin = createAdminClient();

  await admin.from("team_interest").insert({
    user_id: null, // anonymous — this is the public doorway, no session exists
    team_name: teamName,
    coach_name: coachName,
    email,
    team_level: teamLevel,
    message: orNull(formData.get("message")),
  });

  // Best-effort admin alert (sendEmail never throws) — the row is already
  // saved. Identical function to /welcome/team's — no second email path.
  await sendTeamInterestAlert({
    teamName,
    schoolOrg: null,
    teamLevel,
    coachName,
    email,
    cityState: null,
    useCase: null,
    message: orNull(formData.get("message")),
  });

  redirect("/dance-teams?sent=1#interest");
}
