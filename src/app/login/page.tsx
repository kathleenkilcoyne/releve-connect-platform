"use client";

// Sign in with a numeric code — no password. Length lives in CODE_LENGTH below.
//
// ── Why a code and not a "magic link" (2026-07-23) ──
// We used to email a one-tap link. Outlook, Hotmail and most corporate mail
// scanners PRE-FETCH every link in a message to check it for malware. A magic
// link is single-use, so the scanner spends it before the human ever taps it —
// the link is dead on arrival, through no fault of theirs. A code can't be
// "clicked" by a scanner, so it survives the trip. You type it here instead.
//
// This page only works once the Supabase email template has been switched to
// send the code (`{{ .Token }}`). See docs/SETUP-SIGNIN-CODES.md.

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ── How long a code is ──
// This MUST match "Email OTP length" in the Supabase dashboard
// (Authentication → Sign In / Providers → Email). This project is set to 8;
// Supabase's own default is 6, so don't assume.
//
// Found the hard way on 2026-07-24: this was hardcoded to 6 while the project
// issued 8, so the Sign in button never enabled and the field silently chopped
// the last two digits off every code. Sign-in was impossible and said nothing.
// One constant now, used for the cap, the enable rule, and the copy — so the
// three can't drift apart again.
const CODE_LENGTH = 8;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  // "email" = asking who you are · "code" = waiting for the digits
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Say something when an old sign-in LINK fails ──
  // /auth/callback redirects here with ?error=link when a link is expired or
  // already used. Nothing read that parameter, so the person landed on a blank
  // form with no explanation and looped. Found the hard way on 2026-07-22.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("error");
    if (reason === "link") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(
        "That sign-in link had already been used or expired. We now send a " +
          `${CODE_LENGTH}-digit code instead — enter your email below and we'll send you one.`,
      );
    } else if (reason === "session") {
      setError(
        "Your code was accepted but the sign-in didn't stick — this usually means " +
          "cookies are blocked. Allow cookies for this site and try once more.",
      );
    }
  }, []);

  // Step 1 — tell Supabase to email a code to this address.
  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      // NOTE: we deliberately do NOT pass `emailRedirectTo`. That option only
      // matters for link-style sign-in, and including a link in the email is
      // exactly what the scanners burn.
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() });
      if (error) {
        setError(error.message);
      } else {
        setStep("code");
        setNotice(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Step 2 — check the code. Success writes the login cookie in this
  // browser; /auth/after-signin then decides which page you land on.
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        // "email" covers both a brand-new account and a returning one.
        type: "email",
      });
      if (error) {
        setError(
          error.message.toLowerCase().includes("expired") ||
            error.message.toLowerCase().includes("invalid")
            ? "That code didn't work. Codes expire after an hour and each one can only be used once — check the newest email, or send a fresh code."
            : error.message,
        );
        setBusy(false);
        return;
      }
      // Carry an optional post-login destination through (a studio signing in
      // from /studio lands back on /studio/edit).
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(
        "/auth/after-signin" + (next && next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : ""),
      );
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  // Send a second code without making them retype their email.
  async function resend() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() });
      if (error) setError(error.message);
      else setNotice(`A new code is on its way to ${email}. Use the newest one.`);
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

      {step === "email" ? (
        <>
          <p className="mt-3 text-neutral-600">
            Enter your email and we&apos;ll send you a {CODE_LENGTH}-digit sign-in code. No password
            needed.
          </p>
          <form onSubmit={sendCode} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium text-neutral-600">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
              />
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "Sending…" : "Email me a sign-in code"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-3 text-neutral-600">
            We sent a {CODE_LENGTH}-digit code to <span className="font-medium">{email}</span>. Enter
            it below — it&apos;s good for one hour.
          </p>
          <form onSubmit={verifyCode} className="mt-8 space-y-4">
            <div>
              <label htmlFor="code" className="mb-1 block text-xs font-medium text-neutral-600">
                {CODE_LENGTH}-digit code
              </label>
              <input
                id="code"
                // "text" + numeric inputMode, not type="number" — a number field
                // strips leading zeros and shows spinner arrows.
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                placeholder={"1234567890".slice(0, CODE_LENGTH)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center text-2xl tracking-[0.4em] focus:border-neutral-500 focus:outline-none"
              />
            </div>
            {notice && (
              <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm leading-relaxed text-green-800">
                {notice}
              </p>
            )}
            {error && <ErrorNote>{error}</ErrorNote>}
            <button
              type="submit"
              disabled={busy || code.length !== CODE_LENGTH}
              className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "Checking…" : "Sign in"}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={resend}
                disabled={busy}
                className="text-neutral-600 underline disabled:opacity-40"
              >
                Send a new code
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setNotice(null);
                }}
                className="text-neutral-500 underline"
              >
                Use a different email
              </button>
            </div>
          </form>
          <p className="mt-6 text-xs leading-relaxed text-neutral-500">
            No code after a minute or two? Check your spam or junk folder — and make sure the
            address above is spelled correctly.
          </p>
        </>
      )}

      <Link href="/" className="mt-10 text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
      {children}
    </p>
  );
}
