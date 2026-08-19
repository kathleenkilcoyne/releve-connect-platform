// The public handle (`talent_profiles.public_slug`) — one implementation.
//
// A handle is a ROOT-LEVEL URL (releveconnect.com/<handle>), so it must never
// collide with a real app route or with another member. Until Profile V2 this
// logic lived inside saveProfile; activation now needs it too, and two copies of
// a uniqueness loop is how you end up with two members sharing a URL.

import { isReservedSlug } from "@/lib/reserved-slugs";

/** Lowercase, hyphenate, trim to 40 chars. Never returns an empty string. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "profile"
  );
}

/**
 * Loose Supabase-like client — just enough for the one read below, without
 * importing Supabase's heavily-generic types (which trip TS's deep-instantiation
 * guard). Matches the pattern already used in @/lib/membership/access.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (table: string) => any };

/**
 * Find a free handle: `base`, else `base-2`, `base-3`, … skipping reserved words
 * and anyone else's handle.
 *
 * MUST be given a service-role client — an RLS-scoped client cannot see other
 * members' rows, so it would report every taken handle as free.
 *
 * `currentProfileId` lets a member keep their own handle when re-saving.
 */
export async function resolveUniqueSlug(
  admin: SupabaseLike,
  base: string,
  currentProfileId?: string,
): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  for (let n = 2; n < 50; n++) {
    const { data: taken } = await admin
      .from("talent_profiles")
      .select("profile_id")
      .eq("public_slug", candidate)
      .maybeSingle();
    const collides =
      (taken && (taken as { profile_id: string }).profile_id !== currentProfileId) ||
      isReservedSlug(candidate);
    if (!collides) return candidate;
    candidate = `${root}-${n}`;
  }
  // 48 collisions on one name is not a real scenario, but returning something
  // unique beats looping forever or handing back a duplicate.
  return `${root}-${Date.now().toString(36)}`;
}
