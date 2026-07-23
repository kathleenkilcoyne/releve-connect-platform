// The "For Studios" front door. A short pitch + a button into the studio profile
// setup. Public; the setup page itself handles sign-in (magic link → back here).
//
// ── 2026-07-22 positioning change ──
// This page used to be built entirely around The Swing (the sub-finder): the
// headline was "Never scramble for a sub again." The Swing and The Flex Series
// have been pulled off the public site until they are paid, working products, so
// the page now stands on the two things that are real for a studio today:
//   1. the Roster — vetted teachers and choreographers they can actually browse;
//   2. a studio account + profile — /studio/edit is built and working.
// Licensing is named as the direction of travel, NOT as something live. Do not
// add a licensing CTA here until the lane exists.

import Link from "next/link";

export const metadata = {
  title: "For Studios — Relevé Connect",
  description:
    "Browse a vetted roster of teachers and choreographers, and set up your studio's profile. No application, no fee to join.",
};

export default function StudioLandingPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-24">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect · For Studios
      </p>
      <h1 className="mt-2 text-4xl font-semibold leading-tight text-neutral-900">
        Find the people. License the work.
      </h1>
      <p className="mt-6 text-lg text-neutral-600">
        Every studio rebooks the same few names because it has no way of knowing who else is out
        there. Relevé is that way of knowing — a vetted, searchable roster of teachers and
        choreographers, with the credits, the reels, and the reach to decide for yourself.
      </p>

      <ul className="mt-8 space-y-3 text-neutral-700">
        <li>• A real studio account — no application, no fee to join.</li>
        <li>
          • A profile that tells a professional who you are, where you are, and how to reach you.
        </li>
        <li>
          • Browse{" "}
          <Link href="/roster" className="underline">
            The Roster
          </Link>{" "}
          — filter by style, level, and region, then reach out through Relevé.
        </li>
      </ul>

      {/* Named as direction, chipped as unbuilt — same honesty rule as the
          homepage. Licensing has no self-serve lane yet. */}
      <p className="mt-8 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-neutral-500">
        <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-neutral-500">
          Coming
        </span>
        <span>
          Licensing original choreography directly from the artists who made it.
        </span>
      </p>

      <div className="mt-10">
        <Link
          href="/studio/edit"
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Set up your studio
        </Link>
      </div>

      <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
