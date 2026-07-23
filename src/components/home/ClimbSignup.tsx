"use client";

// The Climb signup — open to everyone, no account required.
//
// The consent checkbox is the whole point of this component. It is:
//   · unticked by default (never pre-checked — a pre-ticked box is not consent);
//   · required, and re-verified on the server (see lib/climb/subscribe.ts);
//   · specific about what they're agreeing to, and says they can leave any time.
//
// This is the deliberate opposite of the auto-subscribe path that adds buyers to
// the same list with no opt-in — that one stays off until it gets a step like
// this one.

// ── Variants ──
// Same form, same list, two doorways. The licensing variant exists because
// licensing is the site's headline draw but is NOT built yet — so the only
// honest call to action is "we'll tell you when it opens". Its consent line
// names The Climb out loud, because that is the list it joins.

import { useState } from "react";
import { subscribeToClimb } from "@/lib/climb/subscribe";

const COPY = {
  climb: {
    consent:
      "Yes — send me The Climb. I can unsubscribe any time, and every issue has an unsubscribe link at the bottom.",
    button: "Join The Climb",
  },
  licensing: {
    consent:
      "Yes — tell me when licensing opens, and send me The Climb, Relevé's monthly letter. I can unsubscribe any time, and every issue has an unsubscribe link at the bottom.",
    button: "Tell me when it opens",
  },
} as const;

export function ClimbSignup({ variant = "climb" }: { variant?: keyof typeof COPY }) {
  const copy = COPY[variant];
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const form = e.currentTarget;
    try {
      const res = await subscribeToClimb(new FormData(form));
      setResult(res);
      if (res.ok) form.reset();
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-8 max-w-md text-left">
      {/* Tells the server which doorway this was, so the confirmation message
          matches what the person was actually promised. */}
      <input type="hidden" name="list" value={variant} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">First name</span>
          <input
            name="first_name"
            required
            autoComplete="given-name"
            placeholder="First name"
            className="w-full rounded-sm border border-[color:rgba(182,145,47,0.45)] bg-white/70 px-4 py-3 text-[0.95rem] text-[var(--rc-ink)] placeholder:text-[var(--rc-muted)] focus:border-[var(--rc-gold)] focus:outline-none"
          />
        </label>
        <label className="flex-[1.4]">
          <span className="sr-only">Email address</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-sm border border-[color:rgba(182,145,47,0.45)] bg-white/70 px-4 py-3 text-[0.95rem] text-[var(--rc-ink)] placeholder:text-[var(--rc-muted)] focus:border-[var(--rc-gold)] focus:outline-none"
          />
        </label>
      </div>

      {/* Unticked by default. Required. Verified again on the server. */}
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[0.86rem] leading-relaxed text-[var(--rc-ink-soft)]">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--rc-gold)]"
        />
        <span>{copy.consent}</span>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-sm bg-[var(--rc-gold)] px-8 py-3.5 text-[0.82rem] uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#9c7c26] disabled:opacity-50"
      >
        {busy ? "Signing you up…" : copy.button}
      </button>

      {result && (
        <p
          role="status"
          className={`mt-3 text-center text-[0.88rem] ${
            result.ok ? "text-[var(--rc-gold)]" : "text-red-700"
          }`}
        >
          {result.message}
        </p>
      )}

      <p className="mt-3 text-center text-[0.78rem] text-[var(--rc-muted)]">
        No account needed. We never share your email.
      </p>
    </form>
  );
}
