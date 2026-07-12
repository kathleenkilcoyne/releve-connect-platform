// A member's saved professionals (the bookmarks made from the Roster / profiles).
// Gated to active members, same as the Roster. Reads the viewer's own `save`
// connections (RLS-safe) and loads the corresponding profile cards.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAnyActiveMembership } from "@/lib/membership/access";

export const dynamic = "force-dynamic";

type Card = {
  profile_id: string;
  display_name: string;
  public_slug: string;
  primary_role: string | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  headshot_url: string | null;
  verification_flag: boolean;
};

function titleCase(s: string) {
  return s.replace(/(^|[-_ ])(\w)/g, (_, sep, c) => (sep ? " " : "") + c.toUpperCase()).trim();
}

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?from=roster");
  if (!(await hasAnyActiveMembership(supabase, user.id))) redirect("/subscribe?from=roster");

  // My saves (own rows via RLS), newest first.
  const { data: saves } = await supabase
    .from("connections")
    .select("to_profile_id, created_at")
    .eq("from_user_id", user.id)
    .eq("type", "save")
    .order("created_at", { ascending: false });

  const ids = ((saves ?? []) as Array<{ to_profile_id: string }>).map((s) => s.to_profile_id);

  let cards: Card[] = [];
  if (ids.length) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("talent_profiles")
      .select(
        "profile_id, display_name, public_slug, primary_role, city, state_province, country, headshot_url, verification_flag",
      )
      .in("profile_id", ids);
    // Preserve the saved order.
    const byId = new Map((data as Card[] | null ?? []).map((c) => [c.profile_id, c]));
    cards = ids.map((id) => byId.get(id)).filter((c): c is Card => Boolean(c));
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · Saved
        </p>
        <Link href="/roster" className="text-sm text-neutral-500 underline">
          ← The Roster
        </Link>
      </div>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Saved professionals</h1>

      {cards.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center">
          <p className="text-neutral-600">You haven&apos;t saved anyone yet.</p>
          <Link href="/roster" className="mt-3 inline-block text-sm text-neutral-500 underline">
            Browse the Roster →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const location = [c.city, c.state_province, c.country].filter(Boolean).join(", ");
            return (
              <li key={c.profile_id} className="rounded-xl border border-neutral-200 p-5 hover:border-neutral-300">
                <Link href={`/${c.public_slug}`} className="flex items-start gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200">
                    {c.headshot_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.headshot_url} alt={c.display_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-neutral-300">☺</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-neutral-900">{c.display_name}</span>
                      {c.verification_flag && (
                        <span title="Verified Member" className="shrink-0 text-sky-600">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-neutral-600">
                      {c.primary_role ? titleCase(c.primary_role) : ""}
                      {c.primary_role && location ? " · " : ""}
                      {location}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
