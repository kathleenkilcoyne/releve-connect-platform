// Browser-side connection to Supabase (your database).
//
// Use this in code that runs in the visitor's browser ("client components").
// It uses the PUBLIC keys only — safe to ship to the browser.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // A clear, friendly error if the keys haven't been filled in yet.
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "(see docs/SETUP-SUPABASE.md).",
    );
  }

  return createBrowserClient(url, anonKey);
}
