// /studios — the PUBLIC studio directory (2026-07-29).
//
// Lists every LIVE studio (status = 'live') as a card linking to its public
// profile at /studios/<slug>. Loaded with the service-role client and filtered
// to status = 'live', so nothing invited/in-progress/submitted/approved is ever
// shown. Founding-studio recruitment info moved to /studios/join.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Studios on Relevé Connect",
  description: "The studios building with Relevé Connect.",
};

type DirectoryRow = {
  public_slug: string | null;
  name: string | null;
  city: string | null;
  state_province: string | null;
  mission: string | null;
};

export default async function StudiosDirectoryPage() {
  const db = createAdminClient();
  const { data } = await db
    .from("employer_profiles")
    .select("public_slug, name, city, state_province, mission")
    .eq("status", "live")
    .not("public_slug", "is", null)
    .order("name", { ascending: true });

  const studios = ((data ?? []) as DirectoryRow[]).filter((s) => s.public_slug && s.name?.trim());

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect
      </p>
      <h1 className="mt-2 text-4xl font-semibold leading-tight text-neutral-900">Studios</h1>
      <p className="mt-4 text-lg leading-relaxed text-neutral-600">
        The studios building with Relevé Connect.
      </p>

      {studios.length === 0 ? (
        <p className="mt-10 rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-neutral-600">
          No studios are live yet — check back soon.
        </p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {studios.map((s) => {
            const location = [s.city, s.state_province].filter(Boolean).join(", ");
            return (
              <li key={s.public_slug}>
                <Link
                  href={`/studios/${s.public_slug}`}
                  className="block h-full rounded-xl border border-neutral-200 p-5 no-underline transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                >
                  <h2 className="text-lg font-semibold text-neutral-900">{s.name}</h2>
                  {location && <p className="mt-1 text-sm text-neutral-500">{location}</p>}
                  {s.mission?.trim() && (
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.mission}</p>
                  )}
                  <span className="mt-3 inline-block text-sm font-medium text-neutral-900 underline">
                    View studio →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* The founding-studio recruitment info now lives on its own page, beneath
          the directory. */}
      <div className="mt-14 border-t border-neutral-200 pt-8">
        <h2 className="text-lg font-semibold text-neutral-900">Run a studio?</h2>
        <p className="mt-2 text-neutral-600">
          Relevé opens with a small, hand-picked founding cohort.{" "}
          <Link href="/studios/join" className="font-medium text-neutral-900 underline">
            Become a Founding Studio →
          </Link>
        </p>
      </div>

      <Link href="/" className="mt-12 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
