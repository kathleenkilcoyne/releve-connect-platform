// "Join Through Your Studio" — the Families path (V1 three-paths).
//
// Families do NOT apply to the Professional Roster. They join through a
// PARTICIPATING studio, with a code that studio gave them. This page:
//   • signed out → shows a warm welcome and hands off to the code sign-in,
//     carrying the studio code through so they land right back here;
//   • signed in  → shows the short enrollment form (child + consent), which the
//     joinThroughStudio action gates on the code at the data layer.
//
// No application, no resume, no vetting — that integrity belongs to the
// professional roster, and families must never touch it.

import { createClient } from "@/lib/supabase/server";
import JoinForm from "./JoinForm";

export const metadata = {
  title: "Join Through Your Studio — Relevé Connect",
  description:
    "With a participating studio? Create your family's private “This Week” — the one calendar for your dancer's classes, all in one place.",
};

export const dynamic = "force-dynamic";

export default async function JoinPage({
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
        Relevé Connect · For Families
      </p>
      <h1 className="mt-2 text-4xl font-semibold leading-tight text-neutral-900">
        Join through your studio.
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-neutral-600">
        If your studio is on Relevé, they gave you a join code. Enter it and we&apos;ll set up your
        family&apos;s private <span className="italic">This Week</span> — one calendar for your
        dancer&apos;s classes, yours to manage.
      </p>

      <JoinForm signedIn={Boolean(user)} presetCode={presetCode} />

      <p className="mt-10 text-sm leading-relaxed text-neutral-500">
        Don&apos;t have a code? It comes from your studio — reach out to them directly. Relevé
        families join through a participating studio, not on their own.
      </p>
    </main>
  );
}
