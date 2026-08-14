// Where a person lands the moment they finish signing in.
//
// Two different doors lead here — the emailed 6-digit code (verified in the
// browser, then bounced through /auth/after-signin) and the older one-tap link
// (/auth/callback). They must agree on the destination, so the rule lives in
// one place instead of being copy-pasted into both.

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudioForUser } from "@/lib/studio/access";
import { claimFoundingProfessionalOnSignIn } from "@/lib/founding/founding-professional";

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
  // Resolve the signed-in user up front — needed for the Founding Professional
  // claim below, which must run BEFORE we honor `next` (an invite link points at
  // /profile/edit, and the claim is what makes that page reachable).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = user ? createAdminClient() : null;

  // ── Founding Professional claim (best-effort, EVERY sign-in) ──
  // If this AUTHENTICATED email matches a pending Founding Professional grant,
  // materialize the complimentary Professional membership + stamp identity now —
  // so an invited founder following their link arrives already activated and is
  // never routed to the $30 screen. The grant is matched by the verified email,
  // never by anything the invite link carries; the link confers nothing. Must
  // never throw into the sign-in path.
  if (user?.email && admin) {
    try {
      await claimFoundingProfessionalOnSignIn(admin, user.id, user.email);
    } catch (err) {
      console.error("[founding-professional] claim on sign-in failed (ignored):", err);
    }
  }

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
  // (`user` + `admin` were resolved at the top of this function.)
  if (user && admin) {
    const { data: roleRow } = await admin
      .from("users")
      .select("account_type, onboarding_intent")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = roleRow as { account_type?: string; onboarding_intent?: string } | null;
    if (role?.account_type === "admin") {
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

      // An org owner/admin with no talent profile — a studio owner or a dance-team
      // Director — lands on their org home (schedule + roster + team join code +
      // the link to their profile/branding editor), NOT the members-only
      // professional default which would bounce them to /subscribe.
      const orgId = await resolveStudioForUser(user.id);
      if (orgId) return "/studio/schedule";

      // ── The onboarding gateway (2026-08-06) ──
      // A signed-in person with NO talent profile, NO family/guardianship, and NO
      // org is a cold user — the exact case that used to fall through to the
      // PROFESSIONAL default (/profile/edit → /subscribe → /apply), funneling
      // studios, teams, and partners into the Roster application.
      //
      // If they already chose a door at the gateway, route them straight to that
      // flow so they never re-see the gateway. If they haven't chosen yet, the
      // gateway is where they must go BEFORE any application.
      switch (role?.onboarding_intent) {
        case "professional":
          return "/apply";
        case "studio":
          return "/studios/join";
        case "team":
          return "/welcome/team";
        case "partner":
          return "/welcome/partner";
        default:
          return "/welcome";
      }
    }
  }

  return "/profile/edit";
}
