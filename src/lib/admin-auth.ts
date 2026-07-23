// Gate for admin API ROUTES.
//
// ── 2026-07-22: the shared ADMIN_TOKEN is retired ──
// This used to require an `x-admin-token` header matching a shared secret in
// the environment. That secret dates from when the app had no login at all and
// the admin write routes (which use the service role and bypass RLS) had to be
// protected somehow.
//
// It became the thing STOPPING the founder from running her own launch: every
// button in the applications console was disabled until a 48-character string —
// which lived only in a local dotfile — was pasted into a box. Signed in as a
// real admin, she could see the queue and act on none of it.
//
// The admin PAGES have always used the real role already in the schema
// (`users.account_type = 'admin'`, CLAUDE.md §3) via `requireAdminPage()`. The
// routes now use the SAME check, so being signed in as an admin is sufficient
// and nothing has to be copied by hand.
//
// This is strictly stronger than what it replaces: a shared secret is one
// string that grants full admin to whoever holds it, with no identity, no
// revocation, and no audit trail. A session names a specific person, is
// revocable, and matches the gate on the pages.
//
// Fails CLOSED — no session, a lookup error, or any non-admin role is refused.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

function deny(status: number, error: string): AdminCheck {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * Allow only a signed-in admin to perform an admin write.
 *
 * Returns the acting admin's user id on success, so a route can record WHO made
 * a decision (`applications.reviewed_by`) — something the shared token could
 * never do.
 */
export async function requireAdmin(req: Request): Promise<AdminCheck> {
  // ── CSRF, defence in depth ──
  // Header-token auth was immune to cross-site forgery because another site
  // cannot set a custom header. Cookie auth is not immune by construction, so
  // check the Origin. Supabase's auth cookie is SameSite=Lax, which already
  // stops a cross-site PATCH from carrying it; this is the second lock, not the
  // first. Origin is absent on some same-origin/server-to-server calls, so a
  // missing Origin is allowed — only a PRESENT and MISMATCHED one is refused.
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(req.url).host) {
        return deny(403, "Cross-origin admin request refused.");
      }
    } catch {
      return deny(403, "Malformed origin.");
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return deny(401, "Sign in as an admin to do that.");

  // Read the role with the service-role client for the same reason the page
  // gate does: this check must not silently start passing (or failing) because
  // an RLS policy changed somewhere else.
  const db = createAdminClient();
  const { data, error } = await db
    .from("users")
    .select("account_type")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return deny(500, "Could not verify admin access.");
  if (data?.account_type !== "admin") return deny(403, "Admins only.");

  return { ok: true, userId: user.id };
}

/** Lowercase, hyphenated slug from a display name (with a short random suffix). */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "artist"}-${suffix}`;
}
