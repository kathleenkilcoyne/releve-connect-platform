// Runs on every request to keep the login session fresh. (Next.js 16 renamed the
// old "middleware" convention to "proxy" — same idea.) See the helper for detail.
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on all pages EXCEPT static files and images (those don't need a session).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
