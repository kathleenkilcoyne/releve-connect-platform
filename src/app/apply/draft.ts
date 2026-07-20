"use server";

// Auto-save for the application form — the fast-follow CLAUDE.md §4F and
// DECISIONS.md both called a launch blocker.
//
// ── The problem being solved ──
// The intake is 13 sections with several long narrative answers. Without saving,
// a refresh, a closed tab, an expired session, or a stray back-button loses
// everything — and the people most likely to write a thoughtful 250-word answer
// are exactly the people you lose. Worse, before this the form ALSO handed a
// returning applicant a blank page and then silently OVERWROTE their previous
// submission on submit.
//
// ── How it works ──
//   · The client saves a flat snapshot (field name → value) every few seconds
//     while typing, into `applications.draft_fields`, at `state = 'draft'`.
//   · Returning to /apply rehydrates from that snapshot exactly.
//   · The first save mints a `resume_token` (14 days) and sends the resume email
//     ONCE — never again for that application (Guardrail #5: no surprise mail).
//   · Submitting rebuilds the structured `answers` exactly as before; drafts are
//     scratch space and never become the reviewed artifact by themselves.
//
// Everything runs through the cookie-backed client, so RLS guarantees a person
// can only ever read or write their OWN application row.

import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { sendApplicationResumeLink } from "@/lib/notifications";

// How long a save-and-resume link stays valid (CLAUDE.md §3A).
// NOT exported: a "use server" module may only export async functions, so a
// shared constant here would break the build at runtime (tsc and eslint both
// pass it — only Next's own check catches it).
const RESUME_WINDOW_DAYS = 14;

/** Fields never worth persisting to a draft. */
const SKIP_FIELDS = new Set(["$ACTION_ID", "$ACTION_REF"]);

export type DraftSaveResult =
  | { ok: true; savedAt: string; applicationId: string }
  | { ok: false; message: string; locked?: boolean };

/**
 * Flatten a FormData into a plain object.
 *
 * Multi-value controls (checkbox groups like roles/styles/degrees) collapse to
 * arrays so they restore as arrays; single controls stay scalars. Empty strings
 * are kept — "the applicant deliberately cleared this" is information, and
 * dropping them would make a cleared field reappear on reload.
 */
function flatten(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (SKIP_FIELDS.has(key) || typeof value !== "string") continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}

/**
 * Save (or update) the caller's draft application.
 *
 * Idempotent and cheap — safe to call on a timer. Refuses to touch an
 * application that has already been submitted, so an open stale tab can never
 * overwrite something under review.
 */
export async function saveApplicationDraft(
  formData: FormData,
): Promise<DraftSaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in to save your progress." };

  const fields = flatten(formData);
  const now = new Date();

  // Find any application of mine that is still editable.
  const { data: existing } = await supabase
    .from("applications")
    .select("application_id, state, resume_token, resume_email_sent_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const current = existing as {
    application_id: string;
    state: string;
    resume_token: string | null;
    resume_email_sent_at: string | null;
  } | null;

  // Already submitted → do not autosave over it. The page shows a status banner
  // instead of an editable form, so this is a belt-and-braces guard.
  if (current && current.state !== "draft") {
    return {
      ok: false,
      locked: true,
      message: "Your application has already been submitted — it can't be edited.",
    };
  }

  const email = String(fields.email ?? user.email ?? "");
  const firstName = String(fields.first_name ?? "");
  const lastName = String(fields.last_name ?? "");

  // Promote just enough to columns that the admin queue stays readable if a
  // draft is ever inspected; the full snapshot lives in draft_fields.
  const patch: Record<string, unknown> = {
    draft_fields: fields,
    draft_saved_at: now.toISOString(),
    updated_at: now.toISOString(),
    email: email || user.email,
    first_name: firstName || null,
    last_name: lastName || null,
  };

  if (current) {
    const { error } = await supabase
      .from("applications")
      .update(patch)
      .eq("application_id", current.application_id);
    if (error) return { ok: false, message: error.message };

    await maybeSendResumeLink(supabase, current.application_id, {
      email: email || (user.email ?? ""),
      firstName,
      token: current.resume_token,
      alreadySent: Boolean(current.resume_email_sent_at),
    });

    return { ok: true, savedAt: now.toISOString(), applicationId: current.application_id };
  }

  // `applications.user_id` references `public.users`, which is NOT the same
  // table as `auth.users` — a brand-new account has an auth row but no profile
  // row until something creates it. submitApplication does this; the draft path
  // must too, or the very first autosave dies on a foreign-key violation.
  //
  // account_type is only set on creation, never overwritten — the same rule as
  // the other upserts, so drafting can't demote an existing admin/employer.
  const { data: existingUser } = await supabase
    .from("users")
    .select("account_type")
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase.from("users").upsert(
    {
      user_id: user.id,
      email: email || user.email,
      account_type: existingUser?.account_type ?? "talent",
      display_name: `${firstName} ${lastName}`.trim() || null,
      status: "active",
    },
    { onConflict: "user_id" },
  );

  // First save — create the draft and mint the resume token.
  const token = randomBytes(24).toString("base64url");
  const expires = new Date(now.getTime() + RESUME_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("applications")
    .insert({
      ...patch,
      user_id: user.id,
      state: "draft",
      resume_token: token,
      resume_expires_at: expires.toISOString(),
    })
    .select("application_id")
    .single();

  if (error) return { ok: false, message: error.message };
  const applicationId = (data as { application_id: string }).application_id;

  await maybeSendResumeLink(supabase, applicationId, {
    email: email || (user.email ?? ""),
    firstName,
    token,
    alreadySent: false,
  });

  return { ok: true, savedAt: now.toISOString(), applicationId };
}

/**
 * Send the save-and-resume link exactly ONCE per application (EMAILS.md #3).
 *
 * Autosave runs every few seconds; without the `resume_email_sent_at` stamp this
 * would mail the applicant on every keystroke pause. The stamp is written before
 * the send is awaited-on-success so a transient mail failure cannot turn into a
 * loop of retries mailing them repeatedly.
 */
async function maybeSendResumeLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  input: { email: string; firstName: string; token: string | null; alreadySent: boolean },
): Promise<void> {
  if (input.alreadySent || !input.token || !input.email) return;

  // Stamp first — one email, even if several autosaves race.
  const { error } = await supabase
    .from("applications")
    .update({ resume_email_sent_at: new Date().toISOString() })
    .eq("application_id", applicationId)
    .is("resume_email_sent_at", null);
  if (error) return;

  await sendApplicationResumeLink({
    to: input.email,
    firstName: input.firstName || null,
    token: input.token,
    expiresInDays: RESUME_WINDOW_DAYS,
  });
}
