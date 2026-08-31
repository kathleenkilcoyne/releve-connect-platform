"use server";

// The Climb — newsletter signup, done the RIGHT way.
//
// ── Why this file exists separately from notifications.ts ──
// There is already a `addBuyerToClimb()` in lib/notifications.ts that adds every
// $499 buyer to this same MailerLite group with NO opt-in checkbox and NO
// unsubscribe surface. That is the auto-subscribe trap, and it stays switched
// off (its env vars are empty) until it is given a real consent step.
//
// THIS path is the opposite, by construction:
//   · a person types their own name and email into a form, on purpose;
//   · they must TICK A BOX that says what they are agreeing to;
//   · the server refuses the subscribe if that box wasn't ticked — consent is
//     verified server-side, not just enforced by a disabled button;
//   · every email carries MailerLite's unsubscribe link (its own footer), and
//     the form says so before they sign up.
//
// No account is required — this doesn't create a user, only a subscriber row.
//
// ── DB-first architecture (2026-08-30 reconciliation) ──
// newsletter_subscribers in Supabase is the source of truth (see its table
// comment). A signup is recorded there FIRST, via the service-role client —
// RLS on that table has no INSERT/UPDATE policy at all, so this is the only
// path in; the anon/authenticated keys cannot write to it directly.
// MailerLite is synced SECOND, best-effort: if that call fails, the person is
// still safely subscribed in our own database (mailerlite_synced_at stays
// null, which is exactly what newsletter_subscribers_unsynced_idx exists to
// surface for a future resync pass — none exists yet by deliberate choice,
// since nothing has ever needed it).
//
// The unique index is on lower(email), not the raw column, so matching is
// done as an explicit select-then-write rather than relying on Postgres
// ON CONFLICT (which only matches a plain-column constraint).

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const MAILERLITE_ENDPOINT = "https://connect.mailerlite.com/api/subscribers";

export type ClimbSignupResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Which form the person came from. Both write to the SAME MailerLite list — the
 * consent copy on the licensing form names The Climb explicitly, so nobody ends
 * up on a list they didn't agree to.
 *
 * If MAILERLITE_LICENSING_GROUP_ID is set, licensing sign-ups are added to that
 * group AS WELL AS The Climb (not instead of it) — so Kathleen can write to
 * "people waiting on licensing" without breaking the promise they were shown.
 * Leave the env var unset and everything simply lands in The Climb.
 */
type SignupList = "climb" | "licensing";

/** Deliberately permissive — just enough to catch a typo, not to police addresses. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Subscribe someone to The Climb.
 *
 * `consent` must be literally true. It is checked HERE, on the server, because a
 * required checkbox in the DOM is a UI nicety — the guarantee has to live where
 * it can't be edited away.
 */
export async function subscribeToClimb(
  formData: FormData,
): Promise<ClimbSignupResult> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const consent = formData.get("consent") === "on";
  const list: SignupList = formData.get("list") === "licensing" ? "licensing" : "climb";

  if (!firstName) return { ok: false, message: "Please add your first name." };
  if (!looksLikeEmail(email)) return { ok: false, message: "That email doesn't look right." };
  if (!consent) {
    // The one non-negotiable.
    return {
      ok: false,
      message: "Please tick the box to confirm you'd like to receive The Climb.",
    };
  }

  // ── 1. Record the signup in Supabase first. This is the source of truth. ──
  const db = createAdminClient();
  const forwardedFor = (await headers()).get("x-forwarded-for");
  const consentIp = forwardedFor?.split(",")[0]?.trim() || null;
  const nowIso = new Date().toISOString();

  const { data: existing, error: lookupError } = await db
    .from("newsletter_subscribers")
    .select("subscriber_id, status, mailerlite_subscriber_id")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    console.error("[climb] Supabase lookup failed:", lookupError);
    return { ok: false, message: "Something went wrong signing you up. Please try again." };
  }

  const wasAlreadyActive = existing?.status === "active";
  let subscriberId: string;

  if (existing) {
    // Repeat signup: refresh consent (a real, fresh opt-in event) and
    // reactivate if they'd previously unsubscribed. Never create a second row.
    const { error: updateError } = await db
      .from("newsletter_subscribers")
      .update({
        name: firstName,
        status: "active",
        consent_source: "site_form",
        consent_at: nowIso,
        consent_ip: consentIp,
        unsubscribed_at: null,
      })
      .eq("subscriber_id", existing.subscriber_id);

    if (updateError) {
      console.error("[climb] Supabase update failed:", updateError);
      return { ok: false, message: "Something went wrong signing you up. Please try again." };
    }
    subscriberId = existing.subscriber_id;
  } else {
    const { data: inserted, error: insertError } = await db
      .from("newsletter_subscribers")
      .insert({
        email,
        name: firstName,
        status: "active",
        consent_source: "site_form",
        consent_at: nowIso,
        consent_ip: consentIp,
      })
      .select("subscriber_id")
      .single();

    if (insertError || !inserted) {
      console.error("[climb] Supabase insert failed:", insertError);
      return { ok: false, message: "Something went wrong signing you up. Please try again." };
    }
    subscriberId = inserted.subscriber_id;
  }

  const successMessage =
    wasAlreadyActive
      ? list === "licensing"
        ? "You're already on the list — we'll write the moment licensing opens."
        : "You're already on the list — see you on the 1st."
      : list === "licensing"
        ? "You're in. We'll write the moment licensing opens."
        : "You're in. Look for The Climb on the 1st.";

  // ── 2. Sync to MailerLite second, best-effort. ──
  // A failure here does not fail the signup — they're already safely
  // recorded above, and the row's null mailerlite_synced_at marks it for a
  // future resync pass.
  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_CLIMB_GROUP_ID;
  const licensingGroupId = process.env.MAILERLITE_LICENSING_GROUP_ID;

  if (!apiKey || !groupId) {
    console.warn("[climb] MailerLite not configured — recorded in Supabase only:", { email });
    return { ok: true, message: successMessage };
  }

  const groupIds =
    list === "licensing" && licensingGroupId ? [groupId, licensingGroupId] : [groupId];

  try {
    // ── Step 1: create/update the subscriber — WITHOUT a `groups` field. ──
    // MailerLite group IDs are 18-digit numbers, which exceed JavaScript's
    // safe integer range (Number.MAX_SAFE_INTEGER is ~16 digits) — sending
    // one as a JSON number would silently corrupt it, and sending it as a
    // JSON string is what produced "The groups.0 field must be a number."
    // Group membership is assigned separately in step 2 below, where both
    // IDs travel as opaque strings in a URL path instead of a JSON value.
    const subscriberRes = await fetch(MAILERLITE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        fields: { name: firstName },
        status: "active",
      }),
    });

    if (!subscriberRes.ok) {
      const detail = await subscriberRes.text().catch(() => "");

      // A 422 from MailerLite is a generic "validation failed" status — it
      // does NOT always mean "already subscribed". Only treat it as such if
      // the error body actually says so; anything else is a real failure.
      let alreadySubscribed = false;
      if (subscriberRes.status === 422) {
        try {
          const parsed = JSON.parse(detail) as {
            message?: string;
            errors?: Record<string, string[]>;
          };
          const text = [parsed.message, ...Object.values(parsed.errors ?? {}).flat()]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          alreadySubscribed =
            text.includes("already") || text.includes("exists") || text.includes("taken");
        } catch {
          // Non-JSON body — can't confirm it means "already subscribed".
        }
      }

      if (!alreadySubscribed) {
        console.error(
          "[climb] MailerLite subscriber upsert failed (recorded in Supabase; will need a resync):",
          subscriberRes.status,
          detail,
        );
      }
      // Either way, we have no confirmed subscriber id to assign groups to
      // (an "already subscribed" response here carries no body to trust)
      // — leave the row unsynced rather than guess.
      return { ok: true, message: successMessage };
    }

    const subscriberBody = (await subscriberRes.json().catch(() => null)) as {
      data?: { id?: string };
    } | null;
    const mailerliteId: string | null =
      subscriberBody?.data?.id ?? existing?.mailerlite_subscriber_id ?? null;

    if (!mailerliteId) {
      console.error(
        "[climb] MailerLite subscriber upsert succeeded but returned no id — cannot assign groups.",
      );
      return { ok: true, message: successMessage };
    }

    // ── Step 2: assign each intended group via MailerLite's dedicated ──
    // group-assignment endpoint, one request per group. Both ids are kept
    // as plain strings interpolated into the URL — never parsed as numbers.
    let allGroupsAssigned = true;
    for (const gid of groupIds) {
      const groupRes = await fetch(`${MAILERLITE_ENDPOINT}/${mailerliteId}/groups/${gid}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      if (!groupRes.ok) {
        allGroupsAssigned = false;
        const detail = await groupRes.text().catch(() => "");
        console.error(
          "[climb] MailerLite group assignment failed (recorded in Supabase; will need a resync):",
          gid,
          groupRes.status,
          detail,
        );
      }
    }

    if (allGroupsAssigned) {
      await db
        .from("newsletter_subscribers")
        .update({
          mailerlite_subscriber_id: mailerliteId,
          mailerlite_synced_at: nowIso,
        })
        .eq("subscriber_id", subscriberId);
    }
  } catch (err) {
    console.error(
      "[climb] MailerLite sync error (recorded in Supabase; will need a resync):",
      err,
    );
  }

  return { ok: true, message: successMessage };
}
