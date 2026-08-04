// "Join Your College Team" — the ADULT self-managed entry (B3, Gate 3).
//
// Deliberately SEPARATE from the family /join page. This is for adult college-team
// dancers who got a TEAM code from their coach. It:
//   • signed out → welcome + code field, handing off to the emailed-code sign-in,
//     carrying the team code through so they land right back here;
//   • signed in  → the short adult join (name + adult confirmation), which
//     joinCollegeTeam gates on a kind='team' code at the data layer.
//
// No guardian, no minor, no family — a self-managed adult account. Joining the
// team does NOT place anyone on the professional Roster or The Swing; that's a
// separate opt-in + approval later.

import { createClient } from "@/lib/supabase/server";
import TeamJoinForm from "./TeamJoinForm";

export const metadata = {
  title: "Join Your College Team — Relevé Connect",
  description:
    "On a college dance team? Enter your team's join code to set up your own dancer account and see your team's week.",
};

export const dynamic = "force-dynamic";

export default async function TeamJoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawCode = params.code;
  const presetCode = (Array.isArray(rawCode) ? rawCode[0] : rawCode ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-xl flex-1 px-6 py-20">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect · College Teams
      </p>
      <h1 className="mt-2 text-4xl font-semibold leading-tight text-neutral-900">
        Join your college team.
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-neutral-600">
        Your coach gave you a team join code. Enter it and we&apos;ll set up your own dancer account
        and connect you to the team — no parent or guardian needed. You&apos;ll see your team&apos;s
        rehearsals, competitions, and events in <span className="italic">This Week</span>, right
        alongside anything assigned just to you.
      </p>

      <TeamJoinForm signedIn={Boolean(user)} presetCode={presetCode} />

      <p className="mt-10 text-sm leading-relaxed text-neutral-500">
        Adults only, and separate from a studio&apos;s family join. Joining your team does{" "}
        <span className="font-medium">not</span> add you to the Relevé Roster or The Swing — those
        are separate opt-ins you can choose later.
      </p>
    </main>
  );
}
