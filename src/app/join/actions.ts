"use server";

// "Join Through Your Studio" — the family self-enrollment action (V1 three-paths).
//
// This is the one place families enter Relevé, and it is STUDIO-GATED AT THE DATA
// LAYER: nothing is created unless the typed code resolves to an active
// studio_invites row for a participating studio. Open family signup is impossible
// — not by wording, by this function. A minor never becomes public: this only
// opens the EXISTING guarded family layer (family_accounts / students /
// guardianships), whose RLS keeps a student unreachable except through a
// guardianship link.
//
// The whole creation runs under the SERVICE ROLE (admin client). That is
// deliberate and safe: the caller is authenticated (we key every row to their
// own user.id), the invite code IS the studio's authorization to enroll a
// family, and the affiliation row (student → studio) is a studio-authority write
// that a guardian's own RLS client is correctly forbidden from making.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JOIN_INTENT_COOKIE } from "@/lib/auth/destination";

export type JoinState = { ok: boolean; message: string };

// The COPPA/consent version stamped on the guardianship when the guardian agrees.
// Bump this string when the consent copy materially changes.
const CONSENT_VERSION = "join-consent.v1-2026-07-24";

export async function joinThroughStudio(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Should not happen (the page gates on sign-in) but never trust the client.
  if (!user) return { ok: false, message: "Your session expired — please sign in again." };

  const str = (k: string) => String(formData.get(k) ?? "").trim();

  const code = str("studio_code").toUpperCase();
  const childName = str("child_name");
  const ageRange = str("child_age_range");
  const relationship = str("relationship") || null;
  const consent = formData.get("consent_guardian") === "on";

  // ---- Validation ----------------------------------------------------------
  if (!code) return { ok: false, message: "Please enter your studio's join code." };
  if (!childName) return { ok: false, message: "Please enter your child's first name." };
  if (!consent) {
    return {
      ok: false,
      message:
        "Please confirm you're the parent or legal guardian and agree to manage this profile.",
    };
  }

  const admin = createAdminClient();

  // ---- THE GATE: the code must resolve to an active participating studio ----
  const { data: invite, error: inviteErr } = await admin
    .from("studio_invites")
    .select("invite_id, employer_id, status, max_uses, use_count, expires_at")
    .ilike("code", code)
    .maybeSingle();

  if (inviteErr) {
    console.error("[join] invite lookup failed:", inviteErr.message);
    return { ok: false, message: "Something went wrong — please try again in a moment." };
  }

  const invalid = { ok: false, message: "That join code isn't valid. Please check with your studio." };
  if (!invite) return invalid;
  if (invite.status !== "active") return invalid;
  if (invite.expires_at && new Date(invite.expires_at as string) < new Date()) return invalid;
  if (
    invite.max_uses != null &&
    (invite.use_count as number) >= (invite.max_uses as number)
  ) {
    return {
      ok: false,
      message: "That join code has been fully used. Please ask your studio for a new one.",
    };
  }

  const employerId = invite.employer_id as string;

  // ---- Make sure there's a matching account row (guardians are consumers) ---
  // Only set account_type when the row is first created — never downgrade an
  // existing admin/talent/employer just because they joined a family.
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

  // ---- Find or create this guardian's family account -----------------------
  const { data: existingFamily } = await admin
    .from("family_accounts")
    .select("family_id")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  let familyId = (existingFamily as { family_id?: string } | null)?.family_id;
  if (!familyId) {
    const { data: fam, error: famErr } = await admin
      .from("family_accounts")
      .insert({ owner_user_id: user.id, subscription_status: "none" })
      .select("family_id")
      .single();
    if (famErr) {
      console.error("[join] family_account insert failed:", famErr.message);
      return { ok: false, message: "Couldn't create your family account — please try again." };
    }
    familyId = (fam as { family_id: string }).family_id;
  }

  // ---- The student (the minor) ---------------------------------------------
  const { data: student, error: studentErr } = await admin
    .from("students")
    .insert({
      family_id: familyId,
      display_name: childName,
      age_range: ageRange || null,
      visibility: "family_only",
    })
    .select("student_id")
    .single();
  if (studentErr) {
    console.error("[join] student insert failed:", studentErr.message);
    return { ok: false, message: "Couldn't create the family profile — please try again." };
  }
  const studentId = (student as { student_id: string }).student_id;

  // ---- The guardianship (with COPPA consent stamped) -----------------------
  const { error: guardianErr } = await admin.from("guardianships").insert({
    guardian_user_id: user.id,
    student_id: studentId,
    relationship,
    is_primary: true,
    // Default permission set (calendar + messages) is applied by the column
    // default; billing/medical/pickup are granted later, per guardian.
    consent_at: new Date().toISOString(),
    consent_version: CONSENT_VERSION,
  });
  if (guardianErr) {
    console.error("[join] guardianship insert failed:", guardianErr.message);
    return { ok: false, message: "Couldn't link you as guardian — please try again." };
  }

  // ---- The studio affiliation (student ↔ participating studio) -------------
  // Studio-authority write — hence the admin client. Idempotent via the
  // (subject_kind, subject_id, employer_id, role) unique key.
  const { error: affErr } = await admin.from("affiliations").insert({
    subject_kind: "student",
    subject_id: studentId,
    employer_id: employerId,
    role: "student",
    status: "active",
    started_at: new Date().toISOString().slice(0, 10),
  });
  if (affErr) {
    // Non-fatal: the family exists and works even if the affiliation didn't
    // stick. Log loudly rather than tearing down a created family.
    console.error("[join] affiliation insert failed (non-fatal):", affErr.message);
  }

  // ---- Count the redemption (best-effort) ----------------------------------
  await admin
    .from("studio_invites")
    .update({ use_count: (invite.use_count as number) + 1 })
    .eq("invite_id", invite.invite_id as string);

  // The join is done — clear the intent cookie so a later ordinary sign-in isn't
  // bounced back here. (Best-effort; a stale cookie only self-corrects to /join.)
  (await cookies()).set(JOIN_INTENT_COOKIE, "", { path: "/", maxAge: 0 });

  // Land the guardian in their family dashboard — on the dancer they just added,
  // NOT their own professional view. A studio owner or teacher who also has a kid
  // who dances has a talent profile too, so /this-week would otherwise default to
  // the teacher view (build spec: multi-role people exist). The `view=student` +
  // `child=<id>` params force the just-created dancer's week to open selected.
  redirect(`/this-week?view=student&child=${studentId}`);
}
