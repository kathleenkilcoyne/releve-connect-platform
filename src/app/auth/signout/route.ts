// Sign out and return to the home page. Triggered by the "Sign out" button
// (a small form that POSTs here).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 so the browser switches from POST to a normal GET of the home page.
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
