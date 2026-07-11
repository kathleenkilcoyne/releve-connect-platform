// Where the applicant lands after paying the $30 application fee. The webhook
// (kind: 'application_fee') is what actually moves the application into review
// and sends the confirmation email — this page is just the friendly "done".

import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ApplicationSubmittedPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; waived?: string }>;
}) {
  const { waived } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8">
        <p className="text-2xl">🎉</p>
        <h1 className="mt-3 text-2xl font-semibold text-green-900">Your application is in.</h1>
        <p className="mt-3 text-green-800">
          Thank you — a member of the Relevé council reviews every application personally. We&apos;ll
          email you as soon as there&apos;s a decision.
        </p>
        <p className="mt-4 text-sm text-green-700">
          {waived
            ? "As a Founding honoree, no application fee was charged."
            : "Your $30 is held as a commitment — credited in full toward your membership when you're accepted, or refunded if you're not accepted."}
        </p>
      </div>

      <Link href="/" className="mt-8 text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
