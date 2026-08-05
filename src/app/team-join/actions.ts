"use server";

// "Join your dance team" — the ADULT, self-managed join pathway (Dance Teams
// umbrella; generalized from the original college-team flow).
//
// Two server entry points, both under the service role:
//   · validateTeamCode(code) — READ-ONLY. Resolves a team code to its org so the
//     page can reveal "You're joining {OrgName}" and switch to the team's
//     team_type language. Creates NOTHING.
//   · joinDanceTeam(...)      — the WRITE. Creates a self-managed adult record
//     (a `students` row transferred to the dancer's own account: family_id null,
//     visibility 'self_managed', NO guardian, NO family_account) and an
//     affiliation to the team, and NOTHING else — no talent_profile, no Swing,
//     no Roster. Those remain a separate opt-in + approval later.
//
// This is DELIBERATELY SEPARATE from the family /join: it accepts ONLY a team
// code (studio_invites.kind = 'team'); a family code is refused here (and a team
// code is refused at /join). They can never cross-redeem.

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JOIN_INTENT_COOKIE } from "@/lib/auth/destination";
import { memberLabelOf } from "@/lib/studio/team-types";
import { TEAM_JOIN_ERRORS } from "./errors";

export type TeamJoinState = {
  ok: boolean;
  message: string;
  /** Set on success so the page can show "Welcome to {OrgName}…" then send them
   *  to their week. */
  done?: boolean;
  orgName?: string;
};

type InviteRow = {
  invite_id: string;
  employer_id: string;
  status: string;
  kind: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
};

type EmployerRow = {
  name: string | null;
  org_type: string | null;
  team_type: string | null;
  member_label: string | null;
  logo_url: string | null;
  brand_accent: string | null;
};

/** Look up a team invite + its org. Read-only; shared by validate and join. */
async function resolveTeamCode(
  admin: ReturnType<typeof createAdminClient>,
  code: string,
): Promise<
  | { ok: true; invite: InviteRow; employer: EmployerRow }
  | { ok: false; reason: "invalid" | "family" | "expired" }
> {
  const { data: inviteRow, error: inviteErr } = await admin
    .from("studio_invites")
    .select("invite_id, employer_id, status, kind, max_uses, use_count, expires_at")
    .ilike("code", code)
    .maybeSingle();
  if (inviteErr) {
    console.error("[team-join] invite lookup failed:", inviteErr.message);
    return { ok: false, reason: "invalid" };
  }
  const invite = inviteRow as InviteRow | null;
  if (!invite) return { ok: false, reason: "invalid" };
  // Keep SEPARATE from the family flow: only a team code is redeemable here.
  if (invite.kind !== "team") return { ok: false, reason: "family" };
  if (invite.status !== "active") return { ok: false, reason: "expired" };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { ok: false, reason: "expired" };
  }
  if (invite.max_uses != null && invite.use_count >= invite.max_uses) {
    return { ok: false, reason: "expired" };
  }

  const { data: empRow } = await admin
    .from("employer_profiles")
    .select("name, org_type, team_type, member_label, logo_url, brand_accent")
    .eq("employer_id", invite.employer_id)
    .maybeSingle();
  const employer = empRow as EmployerRow | null;
  // Defensive: the code must belong to a dance team.
  if (!employer || employer.org_type !== "dance_team") return { ok: false, reason: "invalid" };

  return { ok: true, invite, employer };
}

export type ValidateResult =
  | {
      valid: true;
      orgName: string;
      team_type: string | null;
      memberLabel: string;
      logoUrl: string | null;
      accent: string | null;
    }
  | { valid: false; reason: "invalid" | "family" | "expired" };

/**
 * READ-ONLY resolve of a team code for the reveal step. Creates nothing. The
 * page calls this once the dancer is signed in and has entered a code.
 */
export async function validateTeamCode(codeRaw: string): Promise<ValidateResult> {
  const code = (codeRaw ?? "").trim().toUpperCase();
  if (!code) return { valid: false, reason: "invalid" };

  const admin = createAdminClient();
  const resolved = await resolveTeamCode(admin, code);
  if (!resolved.ok) return { valid: false, reason: resolved.reason };

  return {
    valid: true,
    orgName: (resolved.employer.name ?? "").trim() || "your team",
    team_type: resolved.employer.team_type,
    memberLabel: memberLabelOf(resolved.employer.member_label),
    logoUrl: resolved.employer.logo_url,
    accent: resolved.employer.brand_accent,
  };
}

export async function joinDanceTeam(
  _prev: TeamJoinState,
  formData: FormData,
): Promise<TeamJoinState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: TEAM_JOIN_ERRORS.sessionLost };

  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const code = str("team_code").toUpperCase();
  const dancerName = str("dancer_name");
  const adult = formData.get("adult_confirm") === "on";

  if (!code) return { ok: false, message: TEAM_JOIN_ERRORS.invalid };
  if (!dancerName) return { ok: false, message: TEAM_JOIN_ERRORS.noName };
  if (!adult) return { ok: false, message: TEAM_JOIN_ERRORS.notConfirmed };

  const admin = createAdminClient();

  const resolved = await resolveTeamCode(admin, code);
  if (!resolved.ok) return { ok: false, message: TEAM_JOIN_ERRORS[resolved.reason] };
  const { invite, employer } = resolved;
  const employerId = invite.employer_id;
  const orgName = (employer.name ?? "").trim() || "your team";

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

  // Success — the page shows "Welcome to {OrgName}…" then sends them to their
  // week (the self-managed view resolves per-self).
  return { ok: true, done: true, orgName, message: "" };
}
