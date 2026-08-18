// Server boot hook (Next.js `instrumentation.ts`). Runs ONCE, in the server
// runtime, before the first request is served.
//
// Its only job today is F5: prove that NEXT_PUBLIC_SITE_URL is present and
// sane in production. Checking here means a misconfigured deploy announces
// itself in the deploy log at start-up, instead of at the moment a member
// hands us their card and gets redirected to a machine that is not theirs.
//
// It deliberately does NOT run during `next build` (Next only invokes
// `register()` in a running server) and is a silent no-op outside production.

import { assertSiteUrlConfigured } from "@/lib/stripe/config";

export async function register() {
  // Edge and Node runtimes both call this; the check is environment-only, so it
  // is safe in either, but there is no reason to run it twice.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    assertSiteUrlConfigured();
  } catch (err) {
    // Loud, and in the deploy log. Rethrown so the boot genuinely fails rather
    // than serving a build that will take money and strand the payer.
    console.error(
      "\n[boot] Relevé cannot start: misconfigured environment.\n" +
        `${(err as Error).message}\n`,
    );
    throw err;
  }
}
