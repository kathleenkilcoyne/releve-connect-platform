// The PUBLIC profile page — the member's shareable "link in bio" at the ROOT
// of the domain: releveconnect.com/<handle> (build spec §6). Rendered on the
// server with the admin client so logged-out visitors can view it. Only
// PUBLISHED, public profiles are shown to the world — EXCEPT the owner, who may
// preview their own draft (marked with a banner).
//
// Built VISUAL-FIRST: the above-the-fold hero is the autoplay-muted vertical
// Teaching Reel + headshot + name/roles/location + earned proof (completed-Swing
// count + rating — hidden until that data exists) + the Verified Member mark and
// honorifics. Text credentials live BELOW the hero.
//
// Handles collide with the app's real routes, but Next matches static routes
// (/apply, /login, …) before this dynamic segment, and we reject reserved
// handles at save time — so reaching this file with a reserved handle is a 404.

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { toReelEmbed } from "@/lib/profile/reel";

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
  teaching_reel_url: string | null;
  gallery_urls: string[] | null;
  resume_url: string | null;
  honorifics: string[] | null;
  verification_flag: boolean;
  social_links: Record<string, string> | null;
  profile_status: string;
  visibility: string;
};

async function loadProfile(handle: string) {
  if (isReservedSlug(handle)) return null;

  const db = createAdminClient();
  const { data } = await db
    .from("talent_profiles")
    .select(
      "profile_id, user_id, display_name, public_slug, primary_role, city, state_province, country, " +
        "bio, years_experience, credentials, headshot_url, teaching_reel_url, gallery_urls, resume_url, " +
        "honorifics, verification_flag, social_links, profile_status, visibility",
    )
    .eq("public_slug", handle)
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
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const loaded = await loadProfile(handle);
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
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const loaded = await loadProfile(handle);
  if (!loaded) notFound();

  const { profile, styles, levels, focus, isDraftPreview } = loaded;
  const location = [profile.city, profile.state_province, profile.country]
    .filter(Boolean)
    .join(", ");
  const social = profile.social_links ?? {};
  const gallery = (profile.gallery_urls ?? []).filter(Boolean);
  const honorifics = (profile.honorifics ?? []).filter(Boolean);
  const reel = toReelEmbed(profile.teaching_reel_url);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      {isDraftPreview && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            <span className="font-medium">Draft preview</span> — only you can see this. It won&apos;t
            be public until you turn on <span className="font-medium">Publish</span>.
          </p>
          <Link href="/profile/edit" className="shrink-0 text-sm font-medium text-amber-900 underline">
            Edit &amp; publish →
          </Link>
        </div>
      )}

      {/* ===== HERO (above the fold) ========================================= */}
      <section className="flex flex-col gap-8 sm:flex-row sm:items-center">
        {/* Teaching Reel — vertical, autoplay-muted. Falls back to nothing. */}
        {reel && (
          <div className="mx-auto w-full max-w-[300px] shrink-0 sm:mx-0">
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-neutral-200">
              <iframe
                src={reel.src}
                title={`${profile.display_name} — Teaching Reel`}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        )}

        {/* Identity block */}
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200">
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
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-neutral-900">{profile.display_name}</h1>
                {/* Verified Member — identity/standing mark (§13). Only when granted. */}
                {profile.verification_flag && (
                  <span
                    title="Verified Member — a real, vetted, active Relevé member"
                    className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200"
                  >
                    ✓ Verified Member
                  </span>
                )}
              </div>
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

          {/* Honorifics — editorial recognition, visually separate from the mark. */}
          {honorifics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {honorifics.map((h) => (
                <span
                  key={h}
                  className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
                >
                  {titleCase(h)}
                </span>
              ))}
            </div>
          )}

          {/* Earned proof (completed-Swing count + rating) is intentionally
              OMITTED until the Swing/Reviews data exists (Step 5) — no fake numbers. */}
        </div>
      </section>

      {/* ===== BELOW THE HERO: text credentials ============================= */}

      {/* Bio */}
      {profile.bio && (
        <section className="mt-12">
          <p className="whitespace-pre-line leading-relaxed text-neutral-700">{profile.bio}</p>
        </section>
      )}

      {/* Tag rows */}
      <TagRow title="Styles" items={styles} />
      <TagRow title="Teaching levels" items={levels} />
      <TagRow title="Focus" items={focus} />

      {/* Photo gallery grid */}
      {gallery.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-neutral-500">Gallery</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {gallery.map((url) => (
              <div
                key={url}
                className="aspect-square overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-neutral-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Credentials */}
      {profile.credentials && (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-neutral-500">
            Credentials &amp; training
          </h2>
          <p className="mt-2 whitespace-pre-line text-neutral-700">{profile.credentials}</p>
        </section>
      )}

      {/* Résumé / CV + Links */}
      {(profile.resume_url || Object.keys(social).length > 0) && (
        <section className="mt-10 flex flex-wrap gap-3">
          {profile.resume_url && (
            <a
              href={profile.resume_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Résumé / CV ↗
            </a>
          )}
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
