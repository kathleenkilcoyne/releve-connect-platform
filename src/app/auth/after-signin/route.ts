// The landing spot after a 6-digit sign-in CODE is accepted.
//
// The code is verified in the browser (see /login), which writes the login
// cookie. The browser then sends you here so the server — which can read your
// role — decides where you actually belong: admins to the vetting console,
// members to their profile editor.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedInDestination } from "@/lib/auth/destination";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session means the cookie never made it — send them back to try again
  // rather than dumping them on a page that will just bounce them.
  if (!user) return NextResponse.redirect(`${origin}/login?error=session`);

  const next = await resolveSignedInDestination(supabase, searchParams.get("next"));
  return NextResponse.redirect(`${origin}${next}`);
}
