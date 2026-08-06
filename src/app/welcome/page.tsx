// The onboarding gateway — "How are you joining Relevé?"
//
// Why this exists: a brand-new signed-in user with no role/linkage used to fall
// through resolveSignedInDestination() to the PROFESSIONAL default (/profile/edit
// → /subscribe → /apply). That funneled studios, dance teams, and industry
// partners into the Roster application. This page is the required fork BEFORE any
// application: the person names how they're joining, and each door leads to its
// own flow. The choice is persisted (users.onboarding_intent) so the resolver
// routes them past this gateway on every later sign-in — they see it once.
//
// Anyone already linked (admin, a talent profile, a family, an org) never reaches
// here — the resolver catches them first. This page is only ever the cold default.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chooseIntent } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "How are you joining Relevé?",
  description: "Tell us how you're joining Relevé Connect so we can point you the right way.",
};

// The four doors, in the ratified order. Copy is exact (spec).
const OPTIONS = [
  {
    intent: "professional",
    label: "Dance Professional",
    hint: "You dance, teach, or choreograph. Apply to the Roster.",
  },
  {
    intent: "studio",
    label: "Dance Studio",
    hint: "You own or run a studio and want to build with Relevé.",
  },
  {
    intent: "team",
    label: "Dance Team",
    hint: "You direct a school, college, or independent dance team.",
  },
  {
    intent: "partner",
    label: "Industry Partner",
    hint: "You're a brand, vendor, or organization that wants to reach the dance world.",
  },
] as const;

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in only, so the choice ties to the person. A clicked email link can
  // land here with no session; send them to sign in and back.
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/welcome")}`);
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">How are you joining Relevé?</h1>
      <p className="mt-3 text-neutral-600">
        Relevé is home to a few different kinds of people. Tell us how you&apos;re joining and
        we&apos;ll take you to the right place.
      </p>

      {/* One form, four submit buttons. Only the clicked button's name/value is
          sent, so the server action knows which door was chosen — no client JS. */}
      <form action={chooseIntent} className="mt-8 grid gap-3">
        {OPTIONS.map((o) => (
          <button
            key={o.intent}
            type="submit"
            name="intent"
            value={o.intent}
            className="group flex flex-col rounded-xl border border-neutral-300 bg-white px-5 py-4 text-left transition-colors hover:border-neutral-900 hover:bg-neutral-50"
          >
            <span className="flex items-center justify-between">
              <span className="text-lg font-semibold text-neutral-900">{o.label}</span>
              <span className="text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-900">
                →
              </span>
            </span>
            <span className="mt-1 text-sm text-neutral-500">{o.hint}</span>
          </button>
        ))}
      </form>

      <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
