// Dance Team (Director) inquiry — the page.
//
// Two states, one route:
//   · already submitted → a clear confirmation ("we've got it, we'll be in touch")
//   · not yet           → the short inquiry form
// The resolver routes a team-intent user here on every sign-in; showing the
// confirmation to a returning Director (rather than the blank form again) is how
// "you only fill this in once" works, and it also prevents duplicate rows.
//
// This is an INTERIM real inquiry — it captures interest and alerts an admin. It
// is deliberately NOT a self-serve team dashboard; that comes later.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitTeamInterest } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bring your dance team to Relevé",
  description: "Tell us about your dance team and we'll be in touch to get you set up.",
};

const TEAM_LEVELS = [
  { value: "middle_school", label: "Middle school" },
  { value: "high_school", label: "High school" },
  { value: "college", label: "College" },
  { value: "professional", label: "Professional" },
  { value: "independent", label: "Independent" },
];

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none";

export default async function TeamInquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/welcome/team")}`);

  // Have they already told us about their team? (default-deny table → admin read,
  // scoped to their own user_id.)
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("team_interest")
    .select("team_name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-16">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-8">
          <p className="text-2xl">💛</p>
          <h1 className="mt-3 text-2xl font-semibold text-green-900">We&apos;ve got it.</h1>
          <p className="mt-3 text-green-800">
            Thanks for telling us about{" "}
            <span className="font-medium">{(existing as { team_name: string }).team_name}</span>.
            Relevé onboards dance teams personally — someone will reach out by email to get you set
            up. There&apos;s nothing else you need to do right now.
          </p>
        </div>
        <Link href="/" className="mt-8 text-sm text-neutral-500 underline">
          ← Back to Relevé
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect · Dance Teams
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Bring your dance team to Relevé.</h1>
      <p className="mt-3 text-neutral-600">
        Tell us a little about your team. This isn&apos;t an application to judge — it&apos;s how we
        reach out and get you set up. It takes a minute.
      </p>

      {error && (
        <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Please add at least your team name and an email so we can reach you.
        </p>
      )}

      <form action={submitTeamInterest} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Team name</span>
          <input name="team_name" required className={inputCls} placeholder="e.g. Ridgeline Dance Company" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">School / organization</span>
          <input name="school_org" className={inputCls} placeholder="The school, college, or org the team belongs to" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Team level</span>
          <select name="team_level" className={inputCls} defaultValue="">
            <option value="">Choose…</option>
            {TEAM_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Coach / director name</span>
          <input name="coach_name" className={inputCls} placeholder="Who leads the team" />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Email</span>
            <input type="email" name="email" required defaultValue={user.email ?? ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">City / state</span>
            <input name="city_state" className={inputCls} placeholder="e.g. Austin, TX" />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            What would you like to use Relevé for?
          </span>
          <textarea
            name="use_case"
            className={`${inputCls} min-h-[90px]`}
            placeholder="Scheduling, hiring choreographers, one home for your dancers and families…"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            Anything else? <span className="text-neutral-400">(optional)</span>
          </span>
          <textarea name="message" className={`${inputCls} min-h-[70px]`} />
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Send to Relevé
        </button>
      </form>

      <Link href="/welcome" className="mt-8 inline-block text-sm text-neutral-500 underline">
        ← Not a dance team? Choose again
      </Link>
    </main>
  );
}
