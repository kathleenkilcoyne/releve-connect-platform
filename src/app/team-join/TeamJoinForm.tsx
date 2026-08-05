"use client";

// "Join your dance team" — the two-step ADULT self-managed form (Dance Teams
// umbrella). STEP 1 is generic (no org revealed); STEP 2 reveals the org and
// switches to its team_type language before the final confirm. All copy is the
// ratified join-page copy.
//
//   STEP 1  code field → Continue. Signed out → hand off to the emailed 8-digit
//     sign-in (?next=/team-join?code=… carries the code back). Signed in → go to
//     /team-join?code=… so the server can validate and reveal STEP 2.
//   STEP 2  the org is revealed; enter YOUR name, confirm you're an adult, join.
//     joinDanceTeam creates the self-managed record + team connection, then this
//     shows the welcome and sends you to This Week.

import { useActionState, useEffect, useState } from "react";
import { joinDanceTeam, type TeamJoinState } from "./actions";
import { monogramFrom, normalizeHex, readableTextColor } from "@/lib/studio/branding";

export type TeamJoinView =
  | { step: "step1"; signedIn: boolean; presetCode: string; error?: string }
  | {
      step: "step2";
      signedIn: boolean;
      presetCode: string;
      orgName: string;
      teamTypeLabel: string;
      memberLabel: string;
      logoUrl: string | null;
      accent: string | null;
    };

const INITIAL: TeamJoinState = { ok: false, message: "" };

export default function TeamJoinForm({ view }: { view: TeamJoinView }) {
  if (view.step === "step2") return <StepTwo view={view} />;
  return <StepOne signedIn={view.signedIn} presetCode={view.presetCode} error={view.error} />;
}

/* ── STEP 1 — generic, no org revealed ─────────────────────────────────────── */
function StepOne({
  signedIn,
  presetCode,
  error,
}: {
  signedIn: boolean;
  presetCode: string;
  error?: string;
}) {
  const [code, setCode] = useState(presetCode);

  function onContinue(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    const next = `/team-join?code=${encodeURIComponent(trimmed)}`;
    if (signedIn) {
      // Signed in → let the server validate and reveal STEP 2.
      window.location.assign(next);
    } else {
      // Signed out → sign in first (emailed code), carrying the code back.
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
  }

  return (
    <>
      <h1 className="mt-2 text-4xl font-semibold leading-tight text-neutral-900">
        Join your dance team
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-neutral-600">
        Enter the team code your Team Director gave you.
      </p>

      <form onSubmit={onContinue} className="mt-8 space-y-5">
        <div>
          <label htmlFor="team_code" className="mb-1 block text-xs font-medium text-neutral-600">
            Team code
          </label>
          <input
            id="team_code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. MANH-4K7T"
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm tracking-wide focus:border-neutral-500 focus:outline-none"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!code.trim()}
          className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Continue
        </button>
      </form>

      <p className="mt-10 text-sm leading-relaxed text-neutral-500">
        Joining a studio as a parent?{" "}
        <a href="/join" className="underline">
          Use the family join page.
        </a>
      </p>
    </>
  );
}

/** The org's logo, or an accent-tinted monogram tile, shown next to its name. */
function BrandTile({
  name,
  logoUrl,
  accent,
}: {
  name: string;
  logoUrl: string | null;
  accent: string | null;
}) {
  const normAccent = normalizeHex(accent);
  const style = normAccent
    ? { backgroundColor: normAccent, color: readableTextColor(normAccent) }
    : { backgroundColor: "#f4f1ea", color: "#111111" };
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-base font-semibold"
      style={style}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-cover" />
      ) : (
        monogramFrom(name)
      )}
    </span>
  );
}

/* ── STEP 2 — org revealed, team_type language ─────────────────────────────── */
function StepTwo({
  view,
}: {
  view: Extract<TeamJoinView, { step: "step2" }>;
}) {
  const [state, formAction, pending] = useActionState(joinDanceTeam, INITIAL);

  // On success, show the welcome, then send them to their week.
  useEffect(() => {
    if (state.done) {
      const t = setTimeout(() => window.location.assign("/this-week?view=student"), 1200);
      return () => clearTimeout(t);
    }
  }, [state.done]);

  if (state.done) {
    return (
      <div className="mt-8">
        <h1 className="text-3xl font-semibold leading-tight text-neutral-900">
          Welcome to {state.orgName}.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-neutral-600">
          You&apos;re all set —{" "}
          <a href="/this-week?view=student" className="underline">
            here&apos;s your week.
          </a>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <BrandTile name={view.orgName} logoUrl={view.logoUrl} accent={view.accent} />
        <div className="min-w-0">
          <p className="text-xl font-semibold text-neutral-900">You&apos;re joining {view.orgName}</p>
          <p className="mt-1 text-sm text-neutral-600">{view.teamTypeLabel}</p>
        </div>
      </div>

      <form action={formAction} className="mt-8 space-y-5">
        <input type="hidden" name="team_code" value={view.presetCode} />

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
          <p className="mt-1 text-xs text-neutral-500">This is how you&apos;ll appear to your team.</p>
        </div>

        <label className="flex items-start gap-3 text-sm leading-relaxed text-neutral-700">
          <input
            type="checkbox"
            name="adult_confirm"
            className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-300"
          />
          <span>I&apos;m an adult dancer, 18 or older, joining on my own behalf.</span>
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
          {pending ? "Joining…" : `Join ${view.orgName}`}
        </button>

        <p className="text-xs leading-relaxed text-neutral-500">
          You&apos;ll manage your own schedule and profile — no parent account needed.
        </p>
      </form>
    </>
  );
}
