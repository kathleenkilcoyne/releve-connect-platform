// Dance Teams — the PUBLIC front door for a brand-new, logged-out coach.
//
// 2026-09-07 audit found that /welcome/team (the only existing "Dance Team"
// page) is sign-in-gated and was designed as the confirmation step INSIDE the
// authenticated /welcome gateway, never as a cold public landing page — and
// that the homepage has no visible Dance Team path at all. This page is the
// fix: a completely public, no-login page explaining the offering (the Team
// Profile + This Week) and a no-login interest form, sitting in FRONT of the
// existing authenticated onboarding. It is purely additive:
//
//   · Does NOT import, alter, or redirect through /welcome/team.
//   · Does NOT read or write employer_profiles, founding_studio_invites, or
//     anything in the Manhattan-critical file list (org-copy.ts, the
//     studios/[slug] public page, /studio/schedule, the publish/unpublish
//     admin route).
//   · Mentions Manhattan University Dance Team by name as the first live
//     pilot, linking ONLY to its already-public profile page — nothing about
//     its authenticated dashboard, roster, or schedule is referenced here.
//   · The interest form writes into the SAME team_interest table via the SAME
//     sendTeamInterestAlert() used by /welcome/team — no second email system.

import Link from "next/link";
import { submitDanceTeamInterest } from "./actions";
import "@/components/home/tokens.css";

export const metadata = {
  title: "Dance Teams — Relevé Connect",
  description:
    "A professional home for college, high school, and competition dance teams — a public team profile, and This Week for the work behind the scenes. No account needed to learn more.",
};

const TEAM_TYPES = [
  { value: "middle_school", label: "Middle school" },
  { value: "high_school", label: "High school" },
  { value: "college", label: "College" },
  { value: "professional", label: "Professional" },
  { value: "competition", label: "Competition Team" },
  { value: "independent", label: "Independent / other" },
];

const inputCls =
  "w-full rounded-sm border border-[color:rgba(182,145,47,0.35)] bg-white px-3.5 py-2.5 text-[0.95rem] text-[var(--rc-ink)] placeholder:text-[var(--rc-muted)] focus:border-[var(--rc-gold)] focus:outline-none";

export default async function DanceTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <div className="home-scope flex flex-1 flex-col">
      {/* ─────────────────────────── Top nav ─────────────────────────── */}
      <header className="border-b border-[color:rgba(182,145,47,0.25)] px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2.5 no-underline">
            <span className="text-2xl font-semibold tracking-[0.14em] text-[var(--rc-ink)]">
              RELEV<span className="rc-gold">É</span>
            </span>
            <span className="text-[0.6rem] uppercase tracking-[0.34em] text-[var(--rc-muted)]">
              Connect
            </span>
          </Link>
          <Link
            href="/login"
            className="text-[0.82rem] tracking-[0.08em] text-[var(--rc-ink)] no-underline transition-colors hover:text-[var(--rc-gold)]"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* ──────────────────────────── Hero ──────────────────────────── */}
      <section className="mx-auto max-w-3xl px-7 pb-10 pt-14 text-center sm:pb-16 sm:pt-20">
        <p className="text-[0.72rem] uppercase tracking-[0.32em] text-[var(--rc-gold)]">
          For College, High School &amp; Competition Dance Teams
        </p>

        <h1 className="mt-4 text-[clamp(1.9rem,4.6vw,3rem)] font-medium leading-[1.16] tracking-[0.3px] text-[var(--rc-ink)]">
          Your team deserves more than
          <span className="block italic text-[var(--rc-gold)]">a group chat.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-[640px] text-[clamp(1.02rem,2.1vw,1.15rem)] leading-relaxed text-[var(--rc-ink-soft)]">
          Give your dance team a professional home — a public team profile for the world to see,
          and This Week for the work happening behind the scenes.
        </p>

        <p className="mt-5 text-[0.95rem] italic text-[var(--rc-muted)]">
          Built for the way dance teams actually work.
        </p>

        <div className="mt-9">
          <a
            href="#interest"
            className="inline-block rounded-sm bg-[var(--rc-gold)] px-8 py-3.5 text-[0.82rem] uppercase tracking-[0.16em] text-white no-underline transition-colors hover:bg-[#9c7c26]"
          >
            Bring Your Team to Relevé
          </a>
        </div>
      </section>

      {/* ────────────────── The two pieces every team gets ────────────────── */}
      <section
        aria-labelledby="pieces-heading"
        className="border-y border-[color:rgba(182,145,47,0.18)] bg-[var(--rc-cream-2)] px-7 py-14 sm:py-20"
      >
        <div className="mx-auto max-w-[880px]">
          <h2
            id="pieces-heading"
            className="text-center text-[clamp(1.5rem,3.6vw,2.15rem)] font-medium leading-tight text-[var(--rc-ink)]"
          >
            Two things, one home.
          </h2>
          <p className="mx-auto mt-3 max-w-[38rem] text-center text-[1.02rem] leading-relaxed text-[var(--rc-ink-soft)]">
            Everything a team needs, in front of the people who matter and behind the scenes where
            the real work happens.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--rc-gold)] bg-white p-7 shadow-sm">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--rc-gold)]">
                Team Profile
              </p>
              <p className="mt-3 text-[1rem] leading-relaxed text-[var(--rc-ink-soft)]">
                A beautiful, public page that gives your team a real professional home on Relevé —
                your story, your roster, your photos and video, shareable with recruiters, families,
                and fans.
              </p>
            </div>
            <div className="rounded-lg border border-[color:rgba(182,145,47,0.28)] bg-[color:rgba(255,255,255,0.55)] p-7">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--rc-gold)]">
                This Week
              </p>
              <p className="mt-3 text-[1rem] leading-relaxed text-[var(--rc-ink-soft)]">
                The working hub behind the scenes — schedules, rehearsals, events, updates, and team
                communication, with a simple way for your dancers to see and acknowledge what&apos;s
                ahead.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Manhattan — proof, not a preview ─────────────────────────
          Names the first live pilot and links ONLY to its already-public page.
          Nothing about its authenticated dashboard is referenced here. */}
      <section className="px-7 py-14 text-center sm:py-16">
        <div className="mx-auto max-w-[640px]">
          <p className="text-[0.7rem] uppercase tracking-[0.28em] text-[var(--rc-muted)]">
            Already live
          </p>
          <p className="mt-4 text-[1.15rem] leading-relaxed text-[var(--rc-ink)]">
            Manhattan University Dance Team is our first live pilot — a real team, on a real Relevé
            profile, today.
          </p>
          <Link
            href="/studios/manhattan-university-dance-team"
            className="mt-4 inline-block text-[0.85rem] uppercase tracking-[0.14em] text-[var(--rc-gold)] no-underline transition-colors hover:text-[#9c7c26]"
          >
            View their team page →
          </Link>
        </div>
      </section>

      {/* ────────────────────────── Interest form ────────────────────────── */}
      <section
        id="interest"
        aria-labelledby="interest-heading"
        className="scroll-mt-10 bg-[var(--rc-cream-2)] px-7 py-14 sm:py-20"
      >
        <div className="mx-auto max-w-lg">
          {sent === "1" ? (
            <div className="rounded-2xl border border-green-200 bg-white p-8 text-center">
              <p className="text-2xl">💛</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--rc-ink)]">We&apos;ve got it.</h2>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-[var(--rc-ink-soft)]">
                Thank you for telling us about your team — we&apos;ll be in touch to get you set up.
              </p>
              <Link
                href="/"
                className="mt-6 inline-block text-[0.85rem] text-[var(--rc-muted)] underline underline-offset-4"
              >
                ← Back to Relevé
              </Link>
            </div>
          ) : (
            <>
              <h2
                id="interest-heading"
                className="text-center text-[clamp(1.5rem,3.6vw,2rem)] font-medium leading-tight text-[var(--rc-ink)]"
              >
                Bring Your Team to Relevé
              </h2>
              <p className="mx-auto mt-3 max-w-[30rem] text-center text-[0.98rem] leading-relaxed text-[var(--rc-ink-soft)]">
                Tell us a little about your team — no account needed. We&apos;ll reach out
                personally to get you set up.
              </p>

              {error === "1" && (
                <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  Please fill in your team name, coach/director name, email, and team type so we can
                  reach you.
                </p>
              )}

              <form action={submitDanceTeamInterest} className="mt-8 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--rc-ink-soft)]">
                    Team / School Name
                  </span>
                  <input
                    name="team_name"
                    required
                    className={inputCls}
                    placeholder="e.g. Manhattan University Dance Team"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--rc-ink-soft)]">
                    Coach / Director Name
                  </span>
                  <input name="coach_name" required className={inputCls} placeholder="Who leads the team" />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--rc-ink-soft)]">Email</span>
                  <input type="email" name="email" required className={inputCls} />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--rc-ink-soft)]">
                    Team Type
                  </span>
                  <select name="team_level" required className={inputCls} defaultValue="">
                    <option value="" disabled>
                      Choose…
                    </option>
                    {TEAM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--rc-ink-soft)]">
                    Message <span className="text-[var(--rc-muted)]">(optional)</span>
                  </span>
                  <textarea name="message" className={`${inputCls} min-h-[90px]`} />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-sm bg-[var(--rc-gold)] px-5 py-3 text-[0.82rem] uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#9c7c26]"
                >
                  Bring Your Team to Relevé
                </button>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ─────────────────────────── Footer ─────────────────────────── */}
      <footer className="border-t border-[color:rgba(217,184,95,0.15)] bg-[var(--rc-black)] px-6 py-8 text-center">
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#8a7f6a]">
          together we rise · nous nous levons · relevé
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-[0.7rem] uppercase tracking-[0.16em] text-[#8a7f6a] no-underline transition-colors hover:text-[var(--rc-gold-bright)]"
        >
          ← Back to Relevé
        </Link>
      </footer>
    </div>
  );
}
