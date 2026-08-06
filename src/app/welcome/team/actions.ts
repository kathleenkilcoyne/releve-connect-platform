"use server";

// Dance Team (Director) inquiry — the WRITE.
//
// A short interest capture, NOT a self-serve account: it lands in team_interest
// (default-deny RLS) and fires ONE internal admin alert so Kathleen can reach out
// and onboard the team personally. No dashboard is created here. Idempotent — a
// Director who submits twice doesn't create two rows; the page shows them their
// confirmation instead of the blank form.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTeamInterestAlert } from "@/lib/notifications";

/** Allowed team levels (must match the DB check constraint). */
const TEAM_LEVELS = ["middle_school", "high_school", "college", "professional", "independent"];

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}
/** Empty string → null, so optional fields store as NULL not "". */
function orNull(v: FormDataEntryValue | null): string | null {
  const s = clean(v);
  return s === "" ? null : s;
}

export async function submitTeamInterest(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/welcome/team")}`);

  const teamName = clean(formData.get("team_name"));
  const email = clean(formData.get("email"));
  // Required fields are enforced in the browser too; re-check here and bounce
  // back with a flag rather than writing a half-empty row.
  if (!teamName || !email) redirect("/welcome/team?error=1");

  const level = clean(formData.get("team_level"));
  const teamLevel = TEAM_LEVELS.includes(level) ? level : null;

  const admin = createAdminClient();

  // Idempotent: one open inquiry per person. If they already have one, don't
  // write another — just take them to their confirmation.
  const { data: already } = await admin
    .from("team_interest")
    .select("interest_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!already) {
    await admin.from("team_interest").insert({
      user_id: user.id,
      team_name: teamName,
      school_org: orNull(formData.get("school_org")),
      team_level: teamLevel,
      coach_name: orNull(formData.get("coach_name")),
      email,
      city_state: orNull(formData.get("city_state")),
      use_case: orNull(formData.get("use_case")),
      message: orNull(formData.get("message")),
    });

    // Best-effort admin alert (sendEmail never throws) — the row is already saved.
    await sendTeamInterestAlert({
      teamName,
      schoolOrg: orNull(formData.get("school_org")),
      teamLevel,
      coachName: orNull(formData.get("coach_name")),
      email,
      cityState: orNull(formData.get("city_state")),
      useCase: orNull(formData.get("use_case")),
      message: orNull(formData.get("message")),
    });
  }

  // Back to the page, which now renders the confirmation (a row exists).
  redirect("/welcome/team?sent=1");
}
