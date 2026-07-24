// The landing spot for an emailed sign-in LINK. Supabase sends the visitor here
// with a one-time `code`; we exchange it for a real login session (stored in a
// cookie) and then hand off to the shared "where do they belong" rule.
//
// Note: sign-in from /login now uses a 6-digit code instead of a link, because
// Outlook/Hotmail pre-fetch links and burn them before the human clicks. This
// route stays for admin-generated links and any link already in someone's inbox.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedInDestination } from "@/lib/auth/destination";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const next = await resolveSignedInDestination(supabase, searchParams.get("next"));
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong (expired/used link) — send them back to sign in.
  return NextResponse.redirect(`${origin}/login?error=link`);
}
