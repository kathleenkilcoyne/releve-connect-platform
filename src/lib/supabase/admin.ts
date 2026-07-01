// Admin (privileged) connection to Supabase — SERVER ONLY. NEVER import this
// into browser/client code.
//
// This uses the SERVICE-ROLE key, which bypasses all row-level security. Only
// use it for trusted server tasks: admin tooling, webhooks (e.g. Stripe payment
// confirmation), and background jobs.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in .env.local (see docs/SETUP-SUPABASE.md).",
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      // This client acts as the system, not a logged-in user — no session.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
