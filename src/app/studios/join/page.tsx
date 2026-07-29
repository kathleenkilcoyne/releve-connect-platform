// "Become a Founding Studio" — the recruitment / information page.
//
// Moved here from /studios on 2026-07-29: /studios is now the PUBLIC DIRECTORY
// of live studios, and this founding-studio information lives beneath it on its
// own page. Invite-only, no form (spec: STUDIO-ONBOARDING-ONE-FLOW-FROM-KATHLEEN).
// The one interactive element is a mailto link for a future cohort — it grants no
// access and starts no onboarding. Actual setup is behind /studio/setup?token=…

import Link from "next/link";

export const metadata = {
  title: "Become a Founding Studio — Relevé Connect",
  description:
    "Relevé opens with a small, hand-picked founding cohort of studios — onboarding is personal and by invitation.",
};

export default function StudiosJoinPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-20">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect · For Studios
      </p>
      <h1 className="mt-2 text-4xl font-semibold leading-tight text-neutral-900">
        Become a Founding Studio.
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-neutral-600">
        We&apos;re opening Relevé with a small founding cohort of studios — partners we onboard
        personally, one at a time. Founding Studios bring their faculty and their competition
        families into the ecosystem, and help shape what Relevé becomes.
      </p>

      <ul className="mt-8 space-y-3 text-neutral-700">
        <li>• A vetted, searchable roster of teachers and choreographers to hire from.</li>
        <li>• One calendar and one home for your studio, your faculty, and your families.</li>
        <li>• A founding rate and a hand to hold through setup — you won&apos;t do it alone.</li>
      </ul>

      <div className="mt-10 rounded-xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-neutral-900">Joining is by invitation</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          The founding cohort is hand-picked, and each studio is onboarded personally through a
          private invitation link — there&apos;s no form to fill out here.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-neutral-700">
          Interested in a future Founding Studio cohort?{" "}
          <a
            href="mailto:info@releveconnect.com"
            className="font-medium text-neutral-900 underline"
          >
            Contact Relevé Connect
          </a>
          .
        </p>
      </div>

      <Link href="/studios" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to the studio directory
      </Link>
    </main>
  );
}
