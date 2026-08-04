"use server";

// "Join Your College Team" — the ADULT, self-managed join pathway (B3, Gate 3).
//
// This is DELIBERATELY SEPARATE from the family /join (joinThroughStudio):
//   · It accepts ONLY a team code (studio_invites.kind = 'team'); a family code
//     is refused here (and a team code is refused at /join). They never cross.
//   · It creates a SELF-MANAGED ADULT record — a `students` row transferred to the
//     dancer's OWN account (transferred_to_user_id = auth.uid()), with NO
//     guardian, NO minor-under-guardian relationship, and NO family_account
//     (family_id stays null). The self-member RLS (Slice 3) then lets them read
//     their own week.
//   · It connects them to the team via an affiliation, and NOTHING else. It does
//     NOT create a talent_profile, Swing, or Roster entry — that is a separate
//     opt-in + approval later.
//
// Runs under the service role: the caller is authenticated (we key the record to
// their own user.id), and the team code is the team's authorization to add them.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JOIN_INTENT_COOKIE } from "@/lib/auth/destination";

export type TeamJoinState = { ok: boolean; message: string };

export async function joinCollegeTeam(
  _prev: TeamJoinState,
  formData: FormData,
): Promise<TeamJoinState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session expired — please sign in again." };

  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const code = str("team_code").toUpperCase();
  const dancerName = str("dancer_name");
  const adult = formData.get("adult_confirm") === "on";

  if (!code) return { ok: false, message: "Please enter your team's join code." };
  if (!dancerName) return { ok: false, message: "Please enter your name." };
  if (!adult) {
    return { ok: false, message: "Please confirm you're joining as an adult dancer (18 or older)." };
  }

  const admin = createAdminClient();

  const { data: inviteRow, error: inviteErr } = await admin
    .from("studio_invites")
    .select("invite_id, employer_id, status, kind, max_uses, use_count, expires_at")
    .ilike("code", code)
    .maybeSingle();
  if (inviteErr) {
    console.error("[team-join] invite lookup failed:", inviteErr.message);
    return { ok: false, message: "Something went wrong — please try again in a moment." };
  }
  const invite = inviteRow as {
    invite_id: string;
    employer_id: string;
    status: string;
    kind: string;
    max_uses: number | null;
    use_count: number;
    expires_at: string | null;
  } | null;

  const invalid = {
    ok: false,
    message: "That team join code isn't valid. Please check with your coach.",
  };
  if (!invite) return invalid;
  // Keep SEPARATE from the family flow: only a team code is redeemable here.
  if (invite.kind !== "team") {
    return {
      ok: false,
      message:
        "That looks like a studio family code, not a college-team code. If you're a parent joining a studio, use the family join page instead.",
    };
  }
  if (invite.status !== "active") return invalid;
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return invalid;
  if (invite.max_uses != null && invite.use_count >= invite.max_uses) {
    return { ok: false, message: "That team code has been fully used. Please ask your coach for a new one." };
  }

  const employerId = invite.employer_id;

  // Defensive: the code must belong to a college team.
  const { data: empRow } = await admin
    .from("employer_profiles")
    .select("org_type")
    .eq("employer_id", employerId)
    .maybeSingle();
  if ((empRow as { org_type?: string } | null)?.org_type !== "college_team") return invalid;

  // Ensure an account row — a self-managed dancer is a 'consumer'. Never downgrade
  // an existing admin/talent/employer just because they joined a team.
  const { data: existingUser } = await admin
    .from("users")
    .select("account_type")
    .eq("user_id", user.id)
    .maybeSingle();
  await admin.from("users").upsert(
    {
      user_id: user.id,
      email: user.email ?? "",
      account_type: (existingUser as { account_type?: string } | null)?.account_type ?? "consumer",
      status: "active",
    },
    { onConflict: "user_id" },
  );

  // The self-managed adult record — NO guardian, NO family_account (family_id null),
  // NO minor-under-guardian relationship. One per account; reused if they join a
  // second team.
  const { data: existingStudent } = await admin
    .from("students")
    .select("student_id")
    .eq("transferred_to_user_id", user.id)
    .maybeSingle();
  let studentId = (existingStudent as { student_id?: string } | null)?.student_id;
  if (!studentId) {
    const { data: st, error: stErr } = await admin
      .from("students")
      .insert({
        family_id: null,
        display_name: dancerName,
        visibility: "self_managed",
        transferred_to_user_id: user.id,
        transferred_at: new Date().toISOString(),
      })
      .select("student_id")
      .single();
    if (stErr || !st) {
      console.error("[team-join] self record insert failed:", stErr?.message);
      return { ok: false, message: "Couldn't set up your dancer account — please try again." };
    }
    studentId = (st as { student_id: string }).student_id;
  }

  // Connect to the team (idempotent via the unique affiliation key).
  const { error: affErr } = await admin.from("affiliations").insert({
    subject_kind: "student",
    subject_id: studentId,
    employer_id: employerId,
    role: "student",
    status: "active",
    started_at: new Date().toISOString().slice(0, 10),
  });
  if (affErr && affErr.code !== "23505") {
    console.error("[team-join] affiliation insert failed:", affErr.message);
  }

  // Count the redemption (best-effort).
  await admin
    .from("studio_invites")
    .update({ use_count: invite.use_count + 1 })
    .eq("invite_id", invite.invite_id);

  // NO talent_profile, NO swing_availability, NO Roster entry — joining the team
  // never places a dancer on the professional Roster or The Swing. That is a
  // separate opt-in + approval later.

  // Clear any stale family join-intent cookie so a later sign-in isn't bounced to /join.
  (await cookies()).set(JOIN_INTENT_COOKIE, "", { path: "/", maxAge: 0 });

  // Land on their own week (the self-managed view resolves per-self, Slice 3).
  redirect("/this-week?view=student");
}
