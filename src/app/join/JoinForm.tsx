"use client";

// The Families "Join Through Your Studio" form — two states in one component:
//
//   SIGNED OUT → a studio-code field + "Continue". Because a family is a real,
//     guardian-managed account, they sign in first (the same emailed code every
//     Relevé member uses). We carry their studio code through the sign-in via
//     ?next=/join?code=… so they land right back here, signed in, ready to
//     finish. We do NOT rebuild OTP here — /login owns that.
//
//   SIGNED IN → the short enrollment: confirm the code, name the child, pick an
//     age bracket, agree to manage the profile. Submitting runs joinThroughStudio,
//     which enforces the studio-code gate at the data layer and lands them in the
//     family dashboard (/this-week).

import { useActionState, useState } from "react";
import { joinThroughStudio, type JoinState } from "./actions";
import { STUDENT_AGE_RANGES } from "./constants";

const INITIAL: JoinState = { ok: false, message: "" };

export default function JoinForm({
  signedIn,
  presetCode,
}: {
  signedIn: boolean;
  presetCode: string;
}) {
  if (!signedIn) return <SignInGate presetCode={presetCode} />;
  return <EnrollForm presetCode={presetCode} />;
}

/** Signed-out: collect the code, then hand off to the emailed-code sign-in. */
function SignInGate({ presetCode }: { presetCode: string }) {
  const [code, setCode] = useState(presetCode);

  function continueToSignIn(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();

    // Drop the join intent as a short-lived cookie BEFORE leaving for sign-in.
    // The `?next` below handles the typed-code path, but if the parent clicks the
    // LINK in the sign-in email instead, that lands on /auth/confirm with no
    // `next` — and a brand-new parent would be routed to the professional Apply
    // funnel. The cookie is the backstop the central redirect reads on every
    // path. SameSite=Lax so it survives the email-link top-level navigation.
    if (trimmed) {
      document.cookie = `rc_join_code=${encodeURIComponent(
        trimmed,
      )}; path=/; max-age=1800; samesite=lax`;
    }

    const next = `/join${trimmed ? `?code=${encodeURIComponent(trimmed)}` : ""}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <form onSubmit={continueToSignIn} className="mt-8 space-y-5">
      <div>
        <label htmlFor="studio_code" className="mb-1 block text-xs font-medium text-neutral-600">
          Studio join code
        </label>
        <input
          id="studio_code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. PILOT-2026"
          autoComplete="off"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase tracking-wide focus:border-neutral-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={!code.trim()}
        className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        Continue
      </button>
      <p className="text-xs leading-relaxed text-neutral-500">
        Next we&apos;ll email you an 8-digit sign-in code to create your family account — no
        password needed.
      </p>
    </form>
  );
}

/** Signed-in: the short enrollment form. */
function EnrollForm({ presetCode }: { presetCode: string }) {
  const [state, formAction, pending] = useActionState(joinThroughStudio, INITIAL);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label htmlFor="studio_code" className="mb-1 block text-xs font-medium text-neutral-600">
          Studio join code
        </label>
        <input
          id="studio_code"
          name="studio_code"
          defaultValue={presetCode}
          required
          placeholder="e.g. PILOT-2026"
          autoComplete="off"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase tracking-wide focus:border-neutral-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="child_name" className="mb-1 block text-xs font-medium text-neutral-600">
          Your dancer&apos;s first name
        </label>
        <input
          id="child_name"
          name="child_name"
          required
          autoComplete="off"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="child_age_range"
            className="mb-1 block text-xs font-medium text-neutral-600"
          >
            Age (optional)
          </label>
          <select
            id="child_age_range"
            name="child_age_range"
            defaultValue=""
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          >
            <option value="">Prefer not to say</option>
            {STUDENT_AGE_RANGES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="relationship" className="mb-1 block text-xs font-medium text-neutral-600">
            You are their… (optional)
          </label>
          <input
            id="relationship"
            name="relationship"
            placeholder="Parent, guardian…"
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm leading-relaxed text-neutral-700">
        <input
          type="checkbox"
          name="consent_guardian"
          className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300"
        />
        <span>
          I&apos;m the parent or legal guardian of this child, and I&apos;ll manage their profile.
          It stays private to our family and our studio — it never appears publicly.
        </span>
      </label>

      {state.message && !state.ok && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {pending ? "Setting up your family…" : "Create our family profile"}
      </button>
    </form>
  );
}
