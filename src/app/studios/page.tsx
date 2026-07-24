// The Studios path — "Become a Founding Studio" (V1 three-paths).
//
// Studios are onboarded MANUALLY / white-glove by Kathleen in V1: five hand-
// picked pilots, no self-serve signup, no billing. So this page is an INTEREST
// form, not an account flow. It pitches the founding cohort and collects a note
// that emails Kathleen (see studios/actions.ts).
//
// The existing /studio (singular) landing + /studio/edit self-serve profile
// tools still exist for the white-glove flow once a studio is onboarded — this
// page is the public front door that precedes them.

import Link from "next/link";
import StudioInterestForm from "./StudioInterestForm";

export const metadata = {
  title: "Become a Founding Studio — Relevé Connect",
  description:
    "Relevé partners with a small founding cohort of studios. Tell us about yours and we'll be in touch — onboarding is personal, by invitation.",
};

export default function StudiosInterestPage() {
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
        <h2 className="text-xl font-semibold text-neutral-900">Tell us about your studio</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Founding studios join by invitation. Share a few details and Kathleen will reach out to
          walk you through it.
        </p>
        <StudioInterestForm />
      </div>

      <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
