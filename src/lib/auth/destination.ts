// Where a person lands the moment they finish signing in.
//
// Two different doors lead here — the emailed 6-digit code (verified in the
// browser, then bounced through /auth/after-signin) and the older one-tap link
// (/auth/callback). They must agree on the destination, so the rule lives in
// one place instead of being copy-pasted into both.

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cookie the family-join gate drops before sending a prospective parent to sign
 * in. It carries the studio code so the family intent survives ANY sign-in path
 * — the typed 8-digit code AND a clicked email link — because the link path
 * lands on /auth/confirm with no `?next`, which would otherwise dump a brand-new
 * parent into the PROFESSIONAL default (/profile/edit → /subscribe → Apply).
 * Short-lived, and cleared the moment the join completes.
 */
export const JOIN_INTENT_COOKIE = "rc_join_code";

/**
 * Decide the page to send a freshly signed-in person to.
 *
 * @param supabase a server-side client that already carries the new session
 * @param requestedNext the `?next=` value from the URL, if any. Only an
 *   INTERNAL relative path is honored — anything else is an open-redirect risk.
 */
export async function resolveSignedInDestination(
  supabase: SupabaseClient,
  requestedNext: string | null,
): Promise<string> {
  if (requestedNext && requestedNext.startsWith("/")) return requestedNext;

  // ── Family-join intent (V1 three-paths) ──
  // A FIRST-TIME parent has no family rows yet at sign-in — those are created
  // only when they submit the enroll form AFTER signing in — so the guardian
  // check below can't catch them, and a clicked email link carries no `?next`.
  // Without this they fall through to the professional default and land on
  // Apply. The join gate drops this cookie before sign-in; honoring it here
  // returns them to /join to finish, on EVERY sign-in path. Cleared on success.
  const joinCode = (await cookies()).get(JOIN_INTENT_COOKIE)?.value?.trim();
  if (joinCode) return `/join?code=${encodeURIComponent(joinCode)}`;

  // ── Why admins go somewhere else (2026-07-22) ──
  // The old default was always /profile/edit. That page needs an ACTIVE
  // MEMBERSHIP and otherwise bounces to /subscribe — so an admin without a
  // membership (the founder's own situation: no one has approved her) was
  // thrown onto a members-only dead end every single time she signed in, and
  // never reached the vetting queue. Admins land on their console.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();

    const { data: roleRow } = await admin
      .from("users")
      .select("account_type")
      .eq("user_id", user.id)
      .maybeSingle();
    if ((roleRow as { account_type?: string } | null)?.account_type === "admin") {
      return "/admin/applications";
    }

    // ── Dashboard-by-role (V1 three-paths) ──
    // The same login lands on a different surface depending on who signs in.
    // A professional (talent profile) belongs in the profile builder / roster
    // side; a family GUARDIAN belongs in "This Week", the shared calendar
    // rendered for their household. We only send someone to /this-week when they
    // have NO talent profile — a person who is both keeps the professional home,
    // and can still open This Week directly.
    const { data: profileRow } = await admin
      .from("talent_profiles")
      .select("profile_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profileRow) {
      // No professional profile — are they a family guardian? (owns a family
      // account or holds a guardianship). If so, their dashboard is This Week.
      const [{ data: ownedFamily }, { data: guardianship }] = await Promise.all([
        admin.from("family_accounts").select("family_id").eq("owner_user_id", user.id).limit(1).maybeSingle(),
        admin.from("guardianships").select("student_id").eq("guardian_user_id", user.id).limit(1).maybeSingle(),
      ]);
      if (ownedFamily || guardianship) return "/this-week";
    }
  }

  return "/profile/edit";
}
