// Admin-only resend of the EMAILS.md #14 "studio-live" email for an org that
// is ALREADY live — e.g. Madeline Donohue (Manhattan University Dance Team)
// needs the new studio-live.v2 copy but must NOT be unpublished/republished
// to get it (that would flip `status` away from "live", taking her public
// page offline for however long the round trip takes — /studios/[slug]
// filters strictly on status = 'live').
//
// This function performs NO writes of any kind. It only reads the owner's
// email and calls the existing `sendStudioLive()` — the exact same function
// `publish` calls, so the copy can never drift between "first time live" and
// "resend." It never touches `employer_profiles` (status, live_at,
// public_slug, or anything else) or `founding_studio_invites`.
//
// Authorization is NOT this function's job — the caller (the admin route)
// must gate on `requireAdmin` before ever loading a profile to pass in here.
// This function assumes that has already happened.
//
// v2 (2026-09-06 diagnostic): checks `sendStudioLive()`'s result instead of
// discarding it. Before this, the ONLY way this action could report failure
// was the profile-shape checks below (already live? has an owner? owner has
// an email?) — once those passed, this always returned `{ ok: true }` no
// matter what actually happened when Resend was called. The Manhattan resend
// on 2026-09-06 was exactly this: the admin UI said "resent," and it took a
// manual check of the Resend dashboard to learn the send was never confirmed.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendStudioLive } from "@/lib/notifications";
import { emailSiteUrl } from "@/lib/email/send";

export type ResendLiveEmailProfile = {
  name: string | null;
  status: string;
  owner_user_id: string | null;
  public_slug: string | null;
  org_type: string | null;
  member_label: string | null;
};

export type ResendLiveEmailResult =
  | { ok: true; messageId: string | null }
  | { ok: false; status: number; error: string };

export async function resendStudioLiveEmail(
  db: SupabaseClient,
  prof: ResendLiveEmailProfile,
): Promise<ResendLiveEmailResult> {
  // Live-only, by design (Kathleen, 2026-09-04): this is a resend for an org
  // that already went through the real publish flow, not a shortcut around it.
  if (prof.status !== "live") {
    return {
      ok: false,
      status: 409,
      error: `Can only resend the live email for an org that is already live (this one is "${prof.status}").`,
    };
  }
  if (!prof.owner_user_id) {
    return { ok: false, status: 422, error: "This org has no owner account to email." };
  }

  const { data: ownerRow, error } = await db
    .from("users")
    .select("email")
    .eq("user_id", prof.owner_user_id)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: "Could not look up the owner's email." };
  const ownerEmail = ownerRow?.email;
  if (!ownerEmail) {
    return { ok: false, status: 422, error: "This org's owner has no email on file." };
  }

  const result = await sendStudioLive({
    to: ownerEmail,
    studioName: prof.name || "Your studio",
    profileUrl: prof.public_slug
      ? `${emailSiteUrl()}/studios/${prof.public_slug}`
      : `${emailSiteUrl()}/studios`,
    orgType: prof.org_type,
    memberLabel: prof.member_label,
  });

  if (!result.sent) {
    return {
      ok: false,
      status: 502,
      error: `Email vendor did not confirm delivery (${result.reason}${
        result.detail ? `: ${result.detail}` : ""
      }).`,
    };
  }

  return { ok: true, messageId: result.id };
}
