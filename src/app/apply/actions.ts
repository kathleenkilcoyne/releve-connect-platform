"use server";

// Save an application (the vetted-tier intake). Runs on the server through the
// cookie (logged-in) Supabase client, so RLS guarantees a person can only write
// their OWN application row. The full role-branched answers live in `answers`
// (JSONB); the routing fields the admin queue filters on are promoted to columns.
//
// This does NOT charge anyone. On success it returns the application id; the form
// then sends the applicant to the $30 fee checkout (/api/applications/[id]/fee-checkout).
//
// Auto-save + the 14-day resume link are a deliberate FAST-FOLLOW (see DECISIONS.md)
// and are REQUIRED before the intake opens to real applicants — a long essay form
// with no save will lose good people. This pass is submit-only.

import { createClient } from "@/lib/supabase/server";

export type ApplyState = { ok: boolean; message: string; applicationId?: string };

/** Count words in a narrative field (whitespace-separated, trimmed). */
function wordCount(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

const STORY_MIN_WORDS = 150; // CLAUDE.md §3A.3: aim 150–250, enforced minimum

const VALID_ROLES = ["teacher", "studio_owner", "choreographer", "working_dancer"];

/** The five Section-13 agreements + the Section-9 Code of Conduct — all required. */
const REQUIRED_CONSENTS = [
  "terms",
  "privacy",
  "media_release",
  "contact",
  "review_understanding",
  "code_of_conduct",
] as const;

export async function submitApplication(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Your session expired — please sign in again." };

  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const list = (k: string) => formData.getAll(k).map(String).filter(Boolean);

  // ---- Routing fields (promoted to columns) --------------------------------
  const firstName = str("first_name");
  const lastName = str("last_name");
  const email = str("email") || user.email || "";
  const roles = list("roles").filter((r) => VALID_ROLES.includes(r));
  let primaryRole = str("primary_role");
  const city = str("city") || null;
  const stateProvince = str("state_province") || null;

  // ---- Validation ----------------------------------------------------------
  if (!firstName || !lastName) return { ok: false, message: "Please enter your first and last name." };
  if (!email) return { ok: false, message: "Please enter your email." };
  if (roles.length === 0) return { ok: false, message: "Choose at least one professional role." };
  if (!primaryRole || !roles.includes(primaryRole)) primaryRole = roles[0];

  const story = str("story_bio");
  if (wordCount(story) < STORY_MIN_WORDS) {
    return {
      ok: false,
      message: `Your story needs at least ${STORY_MIN_WORDS} words — it's the heart of vetting. You have ${wordCount(story)}.`,
    };
  }

  for (const c of REQUIRED_CONSENTS) {
    if (formData.get(`consent_${c}`) !== "on") {
      return { ok: false, message: "Please agree to all of the required statements at the end to submit." };
    }
  }

  // ---- The full 13-section payload (JSONB) ---------------------------------
  const answers = {
    identity: {
      first_name: firstName,
      last_name: lastName,
      email,
      mobile: str("mobile"),
      city,
      state_province: stateProvince,
      country: str("country"),
      age_range: str("age_range"),
    },
    roles,
    primary_role: primaryRole,
    story: { bio: story, years_experience: str("years_experience") },
    industry: {
      studios_companies: str("studios_companies"),
      notable_credits: str("notable_credits"),
      unions: list("unions"),
      certifications: str("certifications"),
      degrees: list("degrees"),
    },
    teaching: roles.includes("teacher")
      ? {
          philosophy: str("teaching_philosophy"),
          levels: list("teaching_levels"),
          styles: list("teaching_styles"),
          adaptive_experience: str("adaptive_experience"),
          available_to_sub: str("available_to_sub"),
          currently_teaching: str("currently_teaching"),
        }
      : null,
    studio_owner: roles.includes("studio_owner")
      ? { details: str("studio_owner_details") }
      : null,
    choreographer: roles.includes("choreographer")
      ? {
          focus_areas: list("choreographer_focus"),
          years: str("choreographer_years"),
          available_to_license: str("available_to_license"),
          work_links: [str("work_link_1"), str("work_link_2"), str("work_link_3")].filter(Boolean),
        }
      : null,
    working_dancer: roles.includes("working_dancer")
      ? {
          training: str("dancer_training"),
          performance: str("dancer_performance"),
          auditioning_for: list("auditioning_for"),
        }
      : null,
    references: [
      { name: str("ref1_name"), contact: str("ref1_contact"), relationship: str("ref1_relationship") },
      { name: str("ref2_name"), contact: str("ref2_contact"), relationship: str("ref2_relationship") },
    ],
    work_authorization: str("work_authorization"),
    digital_presence: {
      website: str("website"),
      instagram: str("instagram"),
      vimeo: str("vimeo"),
      youtube: str("youtube"),
      linkedin: str("linkedin"),
      headshot_url: str("headshot_url"),
      resume_url: str("resume_url"),
      teaching_reel: str("teaching_reel"),
      choreography_reel: str("choreography_reel"),
      performance_reel: str("performance_reel"),
    },
    alignment: { prompt_1: str("alignment_1"), prompt_2: str("alignment_2") },
    open_to: list("open_to"),
  };

  const consents = Object.fromEntries(
    REQUIRED_CONSENTS.map((c) => [c, formData.get(`consent_${c}`) === "on"]),
  );

  // ---- Make sure there's a matching account row (applicants are talent) -----
  await supabase.from("users").upsert(
    { user_id: user.id, email, account_type: "talent", display_name: `${firstName} ${lastName}`, status: "active" },
    { onConflict: "user_id" },
  );

  // ---- Upsert the application (one open application per person) -------------
  const { data: existing } = await supabase
    .from("applications")
    .select("application_id, state")
    .eq("user_id", user.id)
    .not("state", "in", "(approved,declined)")
    .maybeSingle();

  const row = {
    user_id: user.id,
    email,
    first_name: firstName,
    last_name: lastName,
    roles,
    primary_role: primaryRole,
    city,
    state_province: stateProvince,
    state: "submitted" as const,
    answers,
    consents,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let applicationId = (existing as { application_id?: string } | null)?.application_id;
  if (applicationId) {
    const { error } = await supabase.from("applications").update(row).eq("application_id", applicationId);
    if (error) return { ok: false, message: `Couldn't save your application: ${error.message}` };
  } else {
    const { data, error } = await supabase
      .from("applications")
      .insert(row)
      .select("application_id")
      .single();
    if (error) return { ok: false, message: `Couldn't submit your application: ${error.message}` };
    applicationId = (data as { application_id: string }).application_id;
  }

  return { ok: true, message: "Application saved.", applicationId };
}
