// The landing spot for the emailed sign-in link. Supabase sends the visitor here
// with a one-time `code`; we exchange it for a real login session (stored in a
// cookie) and then send them to their profile editor.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile/edit";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong (expired/used link) — send them back to sign in.
  return NextResponse.redirect(`${origin}/login?error=link`);
}
