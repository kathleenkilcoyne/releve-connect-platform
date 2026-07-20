// Ownership check for the Stripe Connect routes.
//
// ── Why this exists ──
// The /api/connect/* routes take a `profileId` from the request and then use the
// SERVICE-ROLE client, which bypasses RLS. Without an ownership check that means
// anyone who knows or guesses a talent profile id can:
//   · mint a Stripe Express ONBOARDING LINK for another artist, complete it with
//     their own bank details, and have every future 80% payout routed to them;
//   · re-open onboarding for an already-connected artist (the refresh route) and
//     change the bank details on file.
//
// That is a payout-hijack, so every one of those routes must first prove the
// caller is the artist whose profile they named. This helper is that proof, in
// one place, so no route can forget it.
//
// The check deliberately runs against the COOKIE-backed client (the caller's own
// session). The admin client is only used afterwards, for the writes the route
// legitimately needs to make.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** The profile fields every Connect route needs once ownership is proven. */
export interface OwnedProfile {
  profile_id: string;
  display_name: string | null;
  stripe_account_id: string | null;
  payouts_enabled: boolean | null;
}

export type ProfileOwnerCheck =
  | { ok: true; userId: string; profile: OwnedProfile }
  | { ok: false; status: 401 | 403 | 404; reason: "signin_required" | "not_authorized" | "not_found" };

/**
 * Resolve the signed-in user and confirm they own `profileId`.
 *
 * Returns the profile as well, so callers do not re-query it.
 *
 * Note the deliberate blurring of "not yours" and "does not exist": both are
 * reported to the caller as a generic failure by the routes, so this endpoint
 * cannot be used to enumerate which profile ids are real.
 */
export async function requireProfileOwner(
  profileId: string,
): Promise<ProfileOwnerCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, status: 401, reason: "signin_required" };

  // Read through the ADMIN client but compare ownership explicitly. (Reading via
  // RLS would also work; doing the comparison here keeps the rule visible in
  // code rather than depending on a policy staying correct elsewhere.)
  const db = createAdminClient();
  const { data: profile, error } = await db
    .from("talent_profiles")
    .select("profile_id, user_id, display_name, stripe_account_id, payouts_enabled")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error || !profile) return { ok: false, status: 404, reason: "not_found" };

  if (profile.user_id !== user.id) {
    return { ok: false, status: 403, reason: "not_authorized" };
  }

  return {
    ok: true,
    userId: user.id,
    profile: {
      profile_id: profile.profile_id as string,
      display_name: (profile.display_name as string | null) ?? null,
      stripe_account_id: (profile.stripe_account_id as string | null) ?? null,
      payouts_enabled: (profile.payouts_enabled as boolean | null) ?? null,
    },
  };
}
