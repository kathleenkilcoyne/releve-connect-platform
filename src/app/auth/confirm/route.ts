// Completes sign-in for a link that carries a `token_hash` (this is how an
// admin-generated magic link — and Supabase's own "server-side" email template —
// finish signing you in). We verify the token, which sets your login cookie,
// then send you to your profile editor.

import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedInDestination } from "@/lib/auth/destination";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "magiclink") as EmailOtpType;

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const next = await resolveSignedInDestination(supabase, searchParams.get("next"));
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
