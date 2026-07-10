"use client";

// Sign in with a "magic link" — no password. You enter your email, we email you
// a one-tap link, and clicking it signs you in and drops you on your profile
// editor. (The link lands on /auth/callback, which finishes the sign-in.)

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
      else setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-6 py-24">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Sign in</h1>
      <p className="mt-3 text-neutral-600">
        Enter your email and we&apos;ll send you a one-tap sign-in link. No password needed.
      </p>

      {sent ? (
        <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="font-medium text-green-800">Check your email 📬</p>
          <p className="mt-1 text-sm text-green-700">
            We sent a sign-in link to <span className="font-medium">{email}</span>. Open it on this
            device to continue. You can close this tab.
          </p>
        </div>
      ) : (
        <form onSubmit={sendLink} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      )}

      <Link href="/" className="mt-10 text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
