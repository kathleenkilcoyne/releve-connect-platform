// Server-side connection to Supabase (your database).
//
// Use this in code that runs on the server ("server components", route handlers).
// It reads/writes the login cookie so a signed-in visitor stays signed in.
// Still uses the PUBLIC (anon) key — permissions are enforced by the database.

import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Accept the new "publishable key" name or the older "anon key" name.
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in " +
        "the Supabase keys (see docs/SETUP-SUPABASE.md).",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In a plain server component you can't set cookies; that's fine and
        // expected. This try/catch keeps it from crashing in that case.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a server component — cookie writes are handled by
          // middleware/route handlers instead. Safe to ignore.
        }
      },
    },
  });
}

/**
 * The signed-in user, memoized for the lifetime of ONE request (React `cache`).
 *
 * `supabase.auth.getUser()` is a real network round-trip to GoTrue by design —
 * that's the secure, non-spoofable check, and it must stay that way. The bug
 * this fixes isn't that call; it's that AdminConsoleLink, ProfessionalNav, and
 * a page itself each independently call `createClient()` + `.auth.getUser()`
 * in the SAME render, on every single page — multiplying one request into
 * several. React's `cache()` de-dupes calls with the same arguments within one
 * request, so every caller here shares the one lookup instead of repeating it.
 *
 * Callers that also need the `supabase` client for further queries should
 * still call `createClient()` themselves (cheap — no I/O until a query runs);
 * this only dedupes the getUser() round-trip itself.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
