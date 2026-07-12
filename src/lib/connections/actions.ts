"use server";

// The Roster hiring actions (Step 4, slice 2). All three run on the server and
// are gated: saving or requesting an intro needs an ACTIVE membership (any tier,
// §5) and you can't act on your own profile; responding needs to OWN the target
// profile. Writes go through the cookie/RLS client so the database's own rules
// are the backstop; the admin client is used only for cross-user reads (the
// target's owner + email) that RLS would otherwise hide.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAnyActiveMembership } from "@/lib/membership/access";
import { normalizeIntroMessage, canConnect } from "./messages";
import { sendIntroRequestNotification } from "@/lib/notifications";

type ActionResult = { ok: boolean; error?: string };

/** Look up a target profile's owner + slug (admin client — may not be mine). */
async function loadTarget(profileId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("talent_profiles")
    .select("profile_id, user_id, public_slug, display_name")
    .eq("profile_id", profileId)
    .maybeSingle();
  return data as
    | { profile_id: string; user_id: string; public_slug: string; display_name: string }
    | null;
}

/** Make sure the acting user has a `users` row (FK target) without clobbering an
 *  existing one (a talent's account_type must survive). */
async function ensureUserRow(userId: string, email: string | undefined) {
  const admin = createAdminClient();
  await admin
    .from("users")
    .upsert(
      { user_id: userId, email, account_type: "consumer", status: "active" },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
}

/** Toggle a "save" (bookmark) on a profile. Returns the new saved state. */
export async function toggleSave(profileId: string): Promise<{ saved: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { saved: false, error: "Please sign in." };

  const target = await loadTarget(profileId);
  if (!target) return { saved: false, error: "That profile no longer exists." };

  if (
    !canConnect({
      viewerUserId: user.id,
      viewerHasActiveMembership: await hasAnyActiveMembership(supabase, user.id),
      profileOwnerUserId: target.user_id,
    })
  ) {
    return { saved: false, error: "You need an active membership to save professionals." };
  }

  await ensureUserRow(user.id, user.email);

  const { data: existing } = await supabase
    .from("connections")
    .select("connection_id")
    .eq("from_user_id", user.id)
    .eq("to_profile_id", profileId)
    .eq("type", "save")
    .maybeSingle();

  if (existing) {
    await supabase.from("connections").delete().eq("connection_id", (existing as { connection_id: string }).connection_id);
    revalidatePath(`/${target.public_slug}`);
    revalidatePath("/roster/saved");
    return { saved: false };
  }

  const { error } = await supabase.from("connections").insert({
    from_user_id: user.id,
    to_profile_id: profileId,
    type: "save",
    status: "open",
  });
  if (error) return { saved: false, error: "Couldn't save — please try again." };
  revalidatePath(`/${target.public_slug}`);
  revalidatePath("/roster/saved");
  return { saved: true };
}

/** Send (or update) a lean in-app intro request. Notifies the talent (seam). */
export async function sendIntroRequest(profileId: string, message: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const target = await loadTarget(profileId);
  if (!target) return { ok: false, error: "That profile no longer exists." };

  if (
    !canConnect({
      viewerUserId: user.id,
      viewerHasActiveMembership: await hasAnyActiveMembership(supabase, user.id),
      profileOwnerUserId: target.user_id,
    })
  ) {
    return { ok: false, error: "You need an active membership to send an intro request." };
  }

  const validated = normalizeIntroMessage(message);
  if (!validated.ok) return { ok: false, error: validated.error };

  await ensureUserRow(user.id, user.email);

  // One request per (sender → target): upsert on the unique index, re-opening it.
  const { error } = await supabase.from("connections").upsert(
    {
      from_user_id: user.id,
      to_profile_id: profileId,
      type: "message-request",
      message: validated.value,
      status: "open",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "from_user_id,to_profile_id,type" },
  );
  if (error) return { ok: false, error: "Couldn't send your request — please try again." };

  // Notify the talent (EMAILS.md #8). Best-effort seam — never fail the action.
  try {
    const admin = createAdminClient();
    const { data: owner } = await admin
      .from("users")
      .select("email")
      .eq("user_id", target.user_id)
      .maybeSingle();
    const toEmail = (owner as { email: string | null } | null)?.email ?? null;
    if (toEmail) {
      await sendIntroRequestNotification({
        to: toEmail,
        talentName: target.display_name,
        requesterName: user.email ?? "A Relevé member",
        profileSlug: target.public_slug,
      });
    }
  } catch (err) {
    console.error("[connections] intro-request notification seam failed (ignored):", err);
  }

  revalidatePath(`/${target.public_slug}`);
  return { ok: true };
}

/** Talent responds to an incoming intro request: Accept (responded) or Decline (closed).
 *  No contact is revealed — status only (Open Decision 2: private by default). */
export async function respondToRequest(
  connectionId: string,
  decision: "responded" | "closed",
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };
  if (decision !== "responded" && decision !== "closed") {
    return { ok: false, error: "Invalid response." };
  }

  // RLS (connections_update_party) already restricts this to the two parties;
  // the update only touches status, so a sender can't be impersonated.
  const { error } = await supabase
    .from("connections")
    .update({ status: decision, updated_at: new Date().toISOString() })
    .eq("connection_id", connectionId)
    .eq("type", "message-request");
  if (error) return { ok: false, error: "Couldn't update — please try again." };

  revalidatePath("/profile/requests");
  return { ok: true };
}
