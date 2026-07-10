// The PUBLIC profile page — what anyone (logged in or not) sees at
// /talent/<handle>. Read on the server with the admin client so logged-out
// visitors can view it. Only PUBLISHED, public profiles are shown to the world —
// EXCEPT the owner, who may preview their own draft (marked with a banner).

import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProfileRow = {
  profile_id: string;
  user_id: string;
  display_name: string;
  public_slug: string;
  primary_role: string | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  bio: string | null;
  years_experience: string | null;
  credentials: string | null;
  headshot_url: string | null;
  social_links: Record<string, string> | null;
  profile_status: string;
  visibility: string;
};

async function loadProfile(slug: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("talent_profiles")
    .select(
      "profile_id, user_id, display_name, public_slug, primary_role, city, state_province, country, " +
        "bio, years_experience, credentials, headshot_url, social_links, profile_status, visibility",
    )
    .eq("public_slug", slug)
    .maybeSingle();

  const profile = data as ProfileRow | null;
  if (!profile) return null;

  const isLive = profile.profile_status === "published" && profile.visibility === "public";
  let isDraftPreview = false;
  if (!isLive) {
    // Not public yet — only the owner (if signed in) may preview it.
    try {
      const supabase = await createServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && user.id === profile.user_id) {
        isDraftPreview = true;
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }

  const pid = profile.profile_id;
  const [styles, levels, focus] = await Promise.all([
    db.from("profile_styles").select("styles(label)").eq("profile_id", pid),
    db.from("profile_levels").select("levels(label)").eq("profile_id", pid),
    db.from("profile_focus_areas").select("focus_areas(label)").eq("profile_id", pid),
  ]);
  const labelsOf = (rows: unknown, key: string): string[] =>
    ((rows as Array<Record<string, { label: string } | { label: string }[]>>) ?? [])
      .map((r) => {
        const v = r[key];
        return Array.isArray(v) ? v[0]?.label : v?.label;
      })
      .filter(Boolean) as string[];

  return {
    profile,
    isDraftPreview,
    styles: labelsOf(styles.data, "styles"),
    levels: labelsOf(levels.data, "levels"),
    focus: labelsOf(focus.data, "focus_areas"),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadProfile(slug);
  if (!loaded) return { title: "Profile · Relevé Connect" };
  return {
    title: `${loaded.profile.display_name} · Relevé Connect`,
    description: loaded.profile.bio?.slice(0, 160) ?? undefined,
  };
}

function titleCase(s: string) {
  return s.replace(/(^|[-_ ])(\w)/g, (_, sep, c) => (sep ? " " : "") + c.toUpperCase()).trim();
}

const SOCIAL_LABELS: Record<string, string> = {
  website: "Website",
  instagram: "Instagram",
  vimeo: "Vimeo",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadProfile(slug);

  if (!loaded) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Profile not found</h1>
        <p className="mt-3 text-neutral-600">
          This profile doesn&apos;t exist yet, or it hasn&apos;t been published.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm text-neutral-500 underline">
          ← Back to Relevé
        </Link>
      </main>
    );
  }

  const { profile, styles, levels, focus, isDraftPreview } = loaded;
  const location = [profile.city, profile.state_province, profile.country]
    .filter(Boolean)
    .join(", ");
  const social = profile.social_links ?? {};

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {isDraftPreview && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            <span className="font-medium">Draft preview</span> — only you can see this. It won&apos;t
            be public until you turn on <span className="font-medium">Publish</span>.
          </p>
          <Link
            href="/profile/edit"
            className="shrink-0 text-sm font-medium text-amber-900 underline"
          >
            Edit &amp; publish →
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
        <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200">
          {profile.headshot_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.headshot_url}
              alt={profile.display_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl text-neutral-300">
              ☺
            </div>
          )}
        </div>
        <div className="mt-5 sm:mt-0">
          <h1 className="text-3xl font-semibold text-neutral-900">{profile.display_name}</h1>
          <p className="mt-1 text-neutral-600">
            {profile.primary_role ? titleCase(profile.primary_role) : ""}
            {profile.primary_role && location ? " · " : ""}
            {location}
          </p>
          {profile.years_experience && (
            <p className="mt-1 text-sm text-neutral-500">
              {profile.years_experience} years experience
            </p>
          )}
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <section className="mt-10">
          <p className="whitespace-pre-line leading-relaxed text-neutral-700">{profile.bio}</p>
        </section>
      )}

      {/* Tag rows */}
      <TagRow title="Styles" items={styles} />
      <TagRow title="Levels" items={levels} />
      <TagRow title="Focus" items={focus} />

      {/* Credentials */}
      {profile.credentials && (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-neutral-500">
            Credentials & training
          </h2>
          <p className="mt-2 whitespace-pre-line text-neutral-700">{profile.credentials}</p>
        </section>
      )}

      {/* Links */}
      {Object.keys(social).length > 0 && (
        <section className="mt-10 flex flex-wrap gap-3">
          {Object.entries(social).map(([k, v]) => (
            <a
              key={k}
              href={v}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              {SOCIAL_LABELS[k] ?? titleCase(k)} ↗
            </a>
          ))}
        </section>
      )}

      <Link href="/" className="mt-14 inline-block text-sm text-neutral-400 underline">
        together we rise · relevé
      </Link>
    </main>
  );
}

function TagRow({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-neutral-500">{title}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((it) => (
          <span key={it} className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700">
            {it}
          </span>
        ))}
      </div>
    </section>
  );
}
