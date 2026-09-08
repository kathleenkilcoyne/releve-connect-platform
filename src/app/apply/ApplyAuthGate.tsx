"use client";

// The signed-out front door for /apply (2026-09-08).
//
// ── Why this exists ──
// /apply used to redirect a signed-out visitor straight to /login before they
// ever saw anything about applying — a generic "Sign in" page with no context,
// reached by clicking a gold "Apply" button. Confusing for a brand-new
// prospective member who has never heard of Relevé's sign-in system.
//
// This is NOT a new auth system. It is the SAME passwordless 8-digit-code flow
// as /login (supabase.auth.signInWithOtp / verifyOtp) — just presented as the
// first step of applying (matches CLAUDE.md §3A Section 1: Identity & Contact,
// which starts with email) instead of a detour through an unrelated-looking
// page. On success it hands off to /auth/after-signin, the exact same
// post-verify route /login uses, so every existing claim/activation rule
// (Founding Professional, private invitation, profile catch-up) runs unchanged.
//
// CODE_LENGTH is duplicated from src/app/login/page.tsx rather than shared,
// to keep this a self-contained addition — see docs/SETUP-SIGNIN-CODES.md for
// why it's 8, not Supabase's default of 6.
const CODE_LENGTH = 8;

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
      {children}
    </p>
  );
}

export default function ApplyAuthGate({ resume }: { resume?: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextPath = resume ? `/apply?resume=${encodeURIComponent(resume)}` : "/apply";

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
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

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
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
      // Same hand-off /login uses — resolveSignedInDestination runs every
      // existing claim/activation check, then honors this as an internal
      // `next` and returns us straight back to the application.
      window.location.assign(`/auth/after-signin?next=${encodeURIComponent(nextPath)}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

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
    <>
      {step === "email" ? (
        <>
          <p className="mt-5 text-neutral-600">
            First, verify your email — no password needed. We&apos;ll send a {CODE_LENGTH}-digit
            code, and you&apos;ll come right back here to keep going.
          </p>
          <form onSubmit={sendCode} className="mt-6 space-y-4">
            <div>
              <label htmlFor="apply-email" className="mb-1 block text-xs font-medium text-neutral-600">
                Email
              </label>
              <input
                id="apply-email"
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
              {busy ? "Sending…" : "Email me a code to start"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-5 text-neutral-600">
            We sent a {CODE_LENGTH}-digit code to <span className="font-medium">{email}</span>. Enter
            it below to continue your application — it&apos;s good for one hour.
          </p>
          <form onSubmit={verifyCode} className="mt-6 space-y-4">
            <div>
              <label htmlFor="apply-code" className="mb-1 block text-xs font-medium text-neutral-600">
                {CODE_LENGTH}-digit code
              </label>
              <input
                id="apply-code"
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
              {busy ? "Checking…" : "Continue my application"}
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
    </>
  );
}
