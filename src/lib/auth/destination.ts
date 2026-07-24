// Where a person lands the moment they finish signing in.
//
// Two different doors lead here — the emailed 6-digit code (verified in the
// browser, then bounced through /auth/after-signin) and the older one-tap link
// (/auth/callback). They must agree on the destination, so the rule lives in
// one place instead of being copy-pasted into both.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const { data: roleRow } = await createAdminClient()
      .from("users")
      .select("account_type")
      .eq("user_id", user.id)
      .maybeSingle();
    if ((roleRow as { account_type?: string } | null)?.account_type === "admin") {
      return "/admin/applications";
    }
  }

  return "/profile/edit";
}
