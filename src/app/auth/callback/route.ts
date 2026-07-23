// The landing spot for the emailed sign-in link. Supabase sends the visitor here
// with a one-time `code`; we exchange it for a real login session (stored in a
// cookie) and then send them to their profile editor.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only honor an INTERNAL relative path (guard against open-redirects).
  const nextParam = searchParams.get("next");
  const explicitNext = nextParam && nextParam.startsWith("/") ? nextParam : null;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // ── Where to land when nothing was requested (2026-07-22) ──
      // The old default was always /profile/edit. That page needs an ACTIVE
      // MEMBERSHIP and otherwise bounces to /subscribe — so an admin without a
      // membership (the founder's own situation: no one has approved her) was
      // thrown onto a members-only dead end every single time she signed in,
      // and never reached the vetting queue. Admins land on their console.
      let next = explicitNext;
      if (!next) {
        next = "/profile/edit";
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
            next = "/admin/applications";
          }
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong (expired/used link) — send them back to sign in.
  return NextResponse.redirect(`${origin}/login?error=link`);
}
