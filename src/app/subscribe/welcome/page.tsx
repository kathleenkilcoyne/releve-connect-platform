// Landing after a successful subscription. The webhook is what actually flips
// the membership active + credits the $30 — this is the friendly confirmation.

import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SubscribeWelcomePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8">
        <p className="text-2xl">🎉</p>
        <h1 className="mt-3 text-2xl font-semibold text-green-900">Welcome to Relevé.</h1>
        <p className="mt-3 text-green-800">
          Your membership is being activated (a moment for the payment to confirm). Your $30
          application fee has been credited to this first year. Your membership renews annually, and
          you can cancel anytime in one click from the membership page.
        </p>
        <Link
          href="/profile/edit"
          className="mt-5 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
        >
          Build your profile →
        </Link>
      </div>
      <Link href="/subscribe" className="mt-6 text-sm text-neutral-500 underline">Manage membership</Link>
    </main>
  );
}
