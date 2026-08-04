"use client";

// "Join Your College Team" — the ADULT self-managed form (B3, Gate 3). Parallel
// to the family JoinForm but adult: no child, no guardian, no family. Two states:
//
//   SIGNED OUT → a team-code field + "Continue", handing off to the same emailed
//     8-digit sign-in (?next=/team-join?code=… carries the code back).
//   SIGNED IN  → confirm the code, enter YOUR name, confirm you're an adult, and
//     join. joinCollegeTeam creates the self-managed record + team connection and
//     lands you on This Week.

import { useActionState, useState } from "react";
import { joinCollegeTeam, type TeamJoinState } from "./actions";

const INITIAL: TeamJoinState = { ok: false, message: "" };

export default function TeamJoinForm({
  signedIn,
  presetCode,
}: {
  signedIn: boolean;
  presetCode: string;
}) {
  if (!signedIn) return <SignInGate presetCode={presetCode} />;
  return <JoinForm presetCode={presetCode} />;
}

/** Signed-out: collect the code, then hand off to the emailed-code sign-in. */
function SignInGate({ presetCode }: { presetCode: string }) {
  const [code, setCode] = useState(presetCode);

  function continueToSignIn(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    const next = `/team-join${trimmed ? `?code=${encodeURIComponent(trimmed)}` : ""}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <form onSubmit={continueToSignIn} className="mt-8 space-y-5">
      <div>
        <label htmlFor="team_code" className="mb-1 block text-xs font-medium text-neutral-600">
          Team join code
        </label>
        <input
          id="team_code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. MANH-7K9P"
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
        Next we&apos;ll email you an 8-digit sign-in code to create your own dancer account — no
        password needed.
      </p>
    </form>
  );
}

/** Signed-in: the short adult join. */
function JoinForm({ presetCode }: { presetCode: string }) {
  const [state, formAction, pending] = useActionState(joinCollegeTeam, INITIAL);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label htmlFor="team_code" className="mb-1 block text-xs font-medium text-neutral-600">
          Team join code
        </label>
        <input
          id="team_code"
          name="team_code"
          defaultValue={presetCode}
          required
          placeholder="e.g. MANH-7K9P"
          autoComplete="off"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase tracking-wide focus:border-neutral-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="dancer_name" className="mb-1 block text-xs font-medium text-neutral-600">
          Your name
        </label>
        <input
          id="dancer_name"
          name="dancer_name"
          required
          autoComplete="name"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </div>

      <label className="flex items-start gap-3 text-sm leading-relaxed text-neutral-700">
        <input
          type="checkbox"
          name="adult_confirm"
          className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300"
        />
        <span>
          I&apos;m an adult dancer (18 or older) joining and managing my own account. No parent or
          guardian is involved.
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
        {pending ? "Connecting you to your team…" : "Join my team"}
      </button>
    </form>
  );
}
