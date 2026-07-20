// The Climb — the newsletter's own page: what it is, how to join, and a
// readable archive of past issues.
//
// Public and account-free by design. Someone should be able to read every issue
// we've ever sent without signing up for anything — the archive IS the argument
// for joining. Issues are linked by their MailerLite web-view URL, so no content
// is duplicated here and nothing goes stale.

import Link from "next/link";
import { ClimbSignup } from "@/components/home/ClimbSignup";
import { CLIMB_ISSUES } from "@/lib/climb/issues";
import "@/components/home/tokens.css";

export const metadata = {
  title: "The Climb — Relevé Connect",
  description:
    "The Climb is Relevé Connect's monthly letter to the working dance world. Read past issues and join — no account needed.",
};

export default function ClimbPage() {
  return (
    <div className="home-scope flex flex-1 flex-col">
      <header className="border-b border-[color:rgba(182,145,47,0.25)] px-4 py-3.5 sm:px-8">
        <Link href="/" className="flex items-baseline gap-2.5 no-underline">
          <span className="text-2xl font-semibold tracking-[0.14em] text-[var(--rc-ink)]">
            RELEV<span className="rc-gold">É</span>
          </span>
          <span className="text-[0.6rem] uppercase tracking-[0.34em] text-[var(--rc-muted)]">
            Connect
          </span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-14 sm:py-20">
        <p className="text-center text-[0.72rem] uppercase tracking-[0.32em] text-[var(--rc-gold)]">
          The Climb
        </p>
        <h1 className="mt-3 text-center text-[clamp(1.9rem,4.6vw,2.8rem)] font-medium leading-tight text-[var(--rc-ink)]">
          A monthly letter to the working dance world.
        </h1>
        <p className="mx-auto mt-5 max-w-[34rem] text-center text-[1.05rem] leading-relaxed text-[var(--rc-ink-soft)]">
          One issue a month, on the 1st. What&apos;s moving in the industry, what we&apos;re
          building, and the things worth saying out loud. Open to everyone — you don&apos;t need
          an account, and you don&apos;t need to be a member.
        </p>

        <ClimbSignup />

        {/* ─────────────────────────── Archive ─────────────────────────── */}
        <section aria-labelledby="archive-heading" className="mt-16">
          <h2
            id="archive-heading"
            className="border-t border-[color:rgba(182,145,47,0.25)] pt-8 text-center text-[0.72rem] uppercase tracking-[0.28em] text-[var(--rc-muted)]"
          >
            Past issues
          </h2>

          {CLIMB_ISSUES.length === 0 ? (
            <p className="mt-6 text-center text-[0.95rem] italic text-[var(--rc-muted)]">
              The archive goes up here as issues are published.
            </p>
          ) : (
            <ul className="mt-6 space-y-3">
              {CLIMB_ISSUES.map((issue) => (
                <li key={issue.url}>
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-sm border border-[color:rgba(182,145,47,0.3)] px-5 py-4 no-underline transition-colors hover:border-[var(--rc-gold)] hover:bg-[color:rgba(182,145,47,0.05)]"
                  >
                    <span className="text-[0.7rem] uppercase tracking-[0.2em] text-[var(--rc-gold)]">
                      {issue.number}
                      {" · "}
                      {new Date(issue.date).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                    <span className="mt-1 block text-[1.1rem] text-[var(--rc-ink)]">
                      {issue.title}
                    </span>
                    {issue.blurb && (
                      <span className="mt-1 block text-[0.9rem] text-[var(--rc-ink-soft)]">
                        {issue.blurb}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-14 text-center">
          <Link
            href="/"
            className="text-[0.85rem] text-[var(--rc-muted)] underline underline-offset-4"
          >
            ← Back to Relevé
          </Link>
        </p>
      </main>

      <footer className="border-t border-[color:rgba(217,184,95,0.15)] bg-[var(--rc-black)] px-6 py-8 text-center">
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#8a7f6a]">
          together we rise · nous nous levons · relevé
        </p>
      </footer>
    </div>
  );
}
