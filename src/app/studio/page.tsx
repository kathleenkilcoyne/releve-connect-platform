// The "For Studios" front door. A short pitch + a button into the studio profile
// setup. Public; the setup page itself handles sign-in (magic link → back here).

import Link from "next/link";

export default function StudioLandingPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-24">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect · For Studios
      </p>
      <h1 className="mt-2 text-4xl font-semibold leading-tight text-neutral-900">
        Never scramble for a sub again.
      </h1>
      <p className="mt-6 text-lg text-neutral-600">
        Set up your studio in a few minutes. Post an open class, and qualified teachers who&apos;ve
        opted in to sub — matched by style, level, and how far they&apos;ll travel — raise their
        hand. You pick who covers it.
      </p>

      <ul className="mt-8 space-y-3 text-neutral-700">
        <li>• A real studio account — no application, no fee to join.</li>
        <li>• A profile built around what a sub actually needs: styles, levels, and how to get there.</li>
        <li>• The sub-finder (The Swing), directory hiring, and job posts, all in one place.</li>
      </ul>

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
