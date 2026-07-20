// Gate for admin PAGES (server components).
//
// ── Why this is separate from admin-auth.ts ──
// `requireAdmin()` guards the admin API ROUTES with an `x-admin-token` header.
// That works for fetch() calls but CANNOT protect a page: a browser navigating
// to /admin/applications sends no custom headers. So the admin pages were
// rendering every applicant's full submission — names, emails, mobile numbers,
// references, work authorisation — to anyone who typed the URL, while only the
// buttons were protected.
//
// Pages therefore need a session-based check, which is what this is. It uses the
// real role already in the schema (`users.account_type = 'admin'`, CLAUDE.md §3)
// rather than inventing a second secret.
//
// Follow-up worth doing: give the admin API routes this same check so the shared
// ADMIN_TOKEN can be retired. Left in place for now as defence in depth — it
// fails closed, so it is not a risk, just a weaker mechanism than this one.

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
