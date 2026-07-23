// Gate for admin PAGES (server components).
//
// ── Why this is separate from admin-auth.ts ──
// This guards PAGES (server components, via redirect/notFound); `requireAdmin()`
// guards API ROUTES (returning a JSON response). Both now apply the SAME rule —
// `users.account_type = 'admin'` (CLAUDE.md §3) on the signed-in session.
//
// Historical note: the routes used to use a shared `x-admin-token` header
// instead, which could not protect a page (a browser navigating to
// /admin/applications sends no custom headers) — so the pages got this check.
// The token was retired on 2026-07-22; see the header of admin-auth.ts.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Allow only signed-in admins past. Never returns for anyone else.
 *
 *   not signed in     → /login (with a return path)
 *   signed in, not admin → 404
 *
 * The 404 is deliberate: a plain member who stumbles onto /admin should not have
 * the existence of an admin console confirmed to them.
 *
 * @param returnTo path to come back to after signing in.
 */
export async function requireAdminPage(returnTo: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);

  // Read the role with the admin client: a user's own row is readable under RLS
  // today, but this check must not silently start passing (or failing) because a
  // policy changed elsewhere.
  const db = createAdminClient();
  const { data, error } = await db
    .from("users")
    .select("account_type")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || data?.account_type !== "admin") notFound();
}
