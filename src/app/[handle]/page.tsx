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
import { normalizeSocialLink, normalizeExternalLink } from "@/lib/profile/links";
import { hasAnyActiveMembership } from "@/lib/membership/access";
import { canConnect } from "@/lib/connections/messages";
import { isProfessionalOfferingsEnabled } from "@/lib/offerings";
import ConnectActions from "./ConnectActions";
import OfferingsSection, { type PublicOffering } from "./OfferingsSection";

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
  founder_distinction: string | null;
  social_links: Record<string, string> | null;
  profile_status: string;
  visibility: string;
  teaching_at: string | null;
  video_reels: VideoReel[] | null;
};

// Mirrors src/lib/profile/activation.ts's SeedReel shape — additional reels
// (choreography / performance / work) beyond the single Featured Video
// (teaching_reel_url). Populated today only when an approved application
// supplied one; there is currently no Profile Editor UI to add or edit these
// after activation (see the "Media / Work" section below).
type VideoReel = { label: string; url: string; kind: string; order: number };

async function loadProfile(handle: string) {
  if (isReservedSlug(handle)) return null;

  const db = createAdminClient();
  const { data } = await db
    .from("talent_profiles")
    .select(
      "profile_id, user_id, display_name, public_slug, primary_role, city, state_province, country, " +
        "bio, years_experience, credentials, headshot_url, teaching_reel_url, gallery_urls, resume_url, " +
        "honorifics, verification_flag, founder_distinction, social_links, profile_status, visibility, " +
        "teaching_at, video_reels",
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
  const [styles, levels, focus, roles] = await Promise.all([
    db.from("profile_styles").select("styles(label)").eq("profile_id", pid),
    db.from("profile_levels").select("levels(label)").eq("profile_id", pid),
    db.from("profile_focus_areas").select("focus_areas(label)").eq("profile_id", pid),
    db.from("profile_roles").select("role_types(slug, label, sort_order)").eq("profile_id", pid),
  ]);
  const labelsOf = (rows: unknown, key: string): string[] =>
    ((rows as Array<Record<string, { label: string } | { label: string }[]>>) ?? [])
      .map((r) => {
        const v = r[key];
        return Array.isArray(v) ? v[0]?.label : v?.label;
      })
      .filter(Boolean) as string[];

  // The full role identity (build spec §3), consistent with the Roster card,
  // not just whichever one happens to be `primary_role`. The embedded row
  // comes back as either an object or a one-element array depending on how
  // the client infers the relationship — cast through `unknown` and normalize.
  type RoleTag = { slug: string; label: string; sort_order: number };
  let roleRows = ((roles.data ?? []) as unknown as Array<{
    role_types: RoleTag | RoleTag[] | null;
  }>)
    .map((r) => (Array.isArray(r.role_types) ? r.role_types[0] : r.role_types))
    .filter((t): t is RoleTag => Boolean(t));

  // A profile saved before multi-role editing existed has no profile_roles
  // rows yet, only the legacy primary_role column — fall back to it rather
  // than showing no role at all. Resolved by SLUG, never rendered raw: an
  // inactive/renamed role_types row simply yields nothing here, same as it
  // already does everywhere else.
  if (roleRows.length === 0 && profile.primary_role) {
    const { data: legacy } = await db
      .from("role_types")
      .select("slug, label, sort_order")
      .eq("slug", profile.primary_role)
      .maybeSingle();
    if (legacy) roleRows = [legacy as RoleTag];
  }

  // Primary role first (if it's still one of their active roles), then the
  // taxonomy's own order — deterministic, and never dependent on whatever
  // order Postgres happened to return the join in.
  roleRows.sort((a, b) => {
    if (a.slug === profile.primary_role) return -1;
    if (b.slug === profile.primary_role) return 1;
    return a.sort_order - b.sort_order;
  });

  return {
    profile,
    isDraftPreview,
    styles: labelsOf(styles.data, "styles"),
    levels: labelsOf(levels.data, "levels"),
    focus: labelsOf(focus.data, "focus_areas"),
    roleLabels: roleRows.map((r) => r.label),
  };
}

// The professional's PUBLIC offerings for the "What I Offer" section (Slice 3).
// The admin client bypasses RLS, so we filter to status = 'active' EXPLICITLY —
// draft/hidden offerings must never leak onto the public profile. Ordered by the
// member's own sort_order. Only called when the feature flag is on.
async function loadPublicOfferings(profileId: string): Promise<PublicOffering[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("professional_offerings")
    .select(
      "id, type, title, short_description, image_url, pricing_type, price_display, location_mode, " +
        "cta_type, external_url, signature_work_id",
    )
    .eq("profile_id", profileId)
    .eq("status", "active")
    .order("sort_order", { ascending: true });
  return (data as PublicOffering[] | null) ?? [];
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

// Order here is the order the links render in.
const SOCIAL_LABELS: Record<string, string> = {
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
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

  const { profile, styles, levels, focus, roleLabels, isDraftPreview } = loaded;
  const roleText = roleLabels.join(" / ");
  const location = [profile.city, profile.state_province, profile.country]
    .filter(Boolean)
    .join(", ");
  // Every stored social value normalized to a safe external URL, keyed by its
  // original key; anything that can't be turned into one (a bare domain like
  // "toddshanks.com", a malformed value, garbage) is dropped here — once, not
  // re-derived in JSX — so it is never rendered as a broken or same-site href.
  const social = Object.fromEntries(
    Object.entries(profile.social_links ?? {})
      .map(([k, v]) => [k, normalizeSocialLink(k, v)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const gallery = (profile.gallery_urls ?? []).filter(Boolean);
  const honorifics = (profile.honorifics ?? []).filter(Boolean);
  const reel = toReelEmbed(profile.teaching_reel_url);
  const firstName = profile.display_name.split(/\s+/)[0] || profile.display_name;

  // Media / Work — additional reels (choreography, performance, work links)
  // beyond the single Featured Video above. Empty for everyone today (no
  // profile currently has any), but the column already exists and is
  // populated for an approved applicant who supplied one — this was captured
  // and then silently never rendered. Each entry needs a label and a URL that
  // resolves to SOMETHING (an embed, or at minimum a safe external link);
  // anything else is dropped rather than shown broken.
  const mediaReels = (profile.video_reels ?? [])
    .filter((r) => r && r.url && r.url.trim())
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      label: r.label || titleCase(r.kind),
      embed: toReelEmbed(r.url),
      href: normalizeExternalLink(r.url),
    }))
    .filter((r) => r.embed || r.href);

  // Professional Offerings (Slice 3) — only queried when the flag is on, so with
  // it OFF this page issues no extra query and renders exactly as before.
  const offerings = isProfessionalOfferingsEnabled()
    ? await loadPublicOfferings(profile.profile_id)
    : [];

  // ---- Viewer state: can this visitor save / request an intro? ------------
  // Any signed-in active member (not the owner) may connect (§5 + founder
  // decision). We also load whether they've already saved / requested, so the
  // buttons reflect state. Logged-out or non-members simply see no actions.
  let isOwner = false;
  let canAct = false;
  let initialSaved = false;
  let initialRequested = false;
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Server-side ownership check. `getUser()` validates the session against
      // Supabase's auth server, so `user.id` is trustworthy (not a client-supplied
      // value). The owner-only bar below is rendered only when this is true — a
      // logged-out visitor or any signed-in non-owner never enters this branch,
      // so that markup is never generated or sent to them.
      isOwner = user.id === profile.user_id;
      canAct = canConnect({
        viewerUserId: user.id,
        viewerHasActiveMembership: await hasAnyActiveMembership(supabase, user.id),
        profileOwnerUserId: profile.user_id,
      });
      if (canAct) {
        const { data: myConns } = await supabase
          .from("connections")
          .select("type")
          .eq("from_user_id", user.id)
          .eq("to_profile_id", profile.profile_id);
        const types = new Set(((myConns ?? []) as Array<{ type: string }>).map((c) => c.type));
        initialSaved = types.has("save");
        initialRequested = types.has("message-request");
      }
    }
  } catch {
    // Not signed in / auth unavailable → no actions shown.
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/roster" className="mb-8 inline-block text-sm text-neutral-500 underline">
        ← Back to the Roster
      </Link>

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

      {/* Owner-only bar — shown ONLY to the authenticated owner viewing their
          own LIVE profile (server-gated by `isOwner` above). It is pure
          navigation and carries NO calendar/schedule/private data. Public
          visitors and signed-in non-owners never receive this markup. */}
      {isOwner && !isDraftPreview && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
          <p className="text-sm text-neutral-700">
            <span className="font-medium text-neutral-900">Your profile is live.</span>{" "}
            Keep your professional information current and organize what comes next.
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/this-week"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Go to This Week
            </Link>
            <Link
              href="/profile/edit"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Edit Profile
            </Link>
          </div>
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
                title={`${profile.display_name} — featured video`}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        )}

        {/* Identity block */}
        <div className="flex-1">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="w-44 shrink-0 overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-neutral-200 sm:w-56">
              <div className="aspect-[3/4]">
                {profile.headshot_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.headshot_url}
                    alt={profile.display_name}
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-6xl text-neutral-300">
                    ☺
                  </div>
                )}
              </div>
            </div>
            <div className="text-center sm:pt-1 sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-3xl font-semibold text-neutral-900">{profile.display_name}</h1>
                {/* Founding Professional — the PROMINENT public distinction: a
                    founding member of the Relevé Professional Roster, conferred by
                    Relevé. Gold, first, and visually stronger than the Verified
                    mark. Identity only — carries nothing about billing. */}
                {profile.founder_distinction === "founding_professional" && (
                  <span
                    title="Founding Professional — a founding member of the Relevé Professional Roster, recognized by Relevé"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 ring-1 ring-amber-300"
                  >
                    ✦ Founding Professional
                  </span>
                )}
                {/* Verified Member — identity/standing mark (§13), SECONDARY to the
                    Founding Professional distinction above. Only when granted. */}
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
                {roleText}
                {roleText && location ? " · " : ""}
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
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
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

          {/* Hiring actions — only for signed-in active members (not the owner). */}
          {canAct && (
            <ConnectActions
              profileId={profile.profile_id}
              firstName={firstName}
              initialSaved={initialSaved}
              initialRequested={initialRequested}
            />
          )}
        </div>
      </section>

      {/* ===== BELOW THE HERO: text credentials ============================= */}

      {/* Bio */}
      {profile.bio && (
        <section className="mt-12">
          <p className="whitespace-pre-line leading-relaxed text-neutral-700">{profile.bio}</p>
        </section>
      )}

      {/* Tag rows. Availability ("Availability" / "Currently accepting") is
          removed (2026-08-26): a generic search-filter facet the Roster no
          longer exposes; Available This Week / Swing is the real, dated
          answer to "when can I book this person." UI-only removal — the
          availability_tags table and profile_availability join are untouched
          for reversibility, and this section is unrelated to The Swing. */}
      <TagRow title="Styles" items={styles} />
      <TagRow title="Teaching levels" items={levels} />
      <TagRow title="Focus" items={focus} />

      {/* The "Currently" line — where they are right now. Free text, so it
          renders as a sentence rather than a tag. "Touring with" was removed
          from here (2026-08-29, founder decision) as a since-superseded
          profile-builder field — UI-only removal, its column and any existing
          data are untouched for reversibility, same pattern as the generic
          Availability removal above. */}
      {profile.teaching_at && (
        <section className="mt-8 space-y-1 text-sm text-neutral-600">
          <p>
            <span className="font-medium text-neutral-800">Teaching at</span> ·{" "}
            {profile.teaching_at}
          </p>
        </section>
      )}

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

      {/* Media / Work — choreography / performance / other reels beyond the
          Featured Video. Embeds Vimeo/YouTube the same way the hero does;
          anything else that survived normalizeExternalLink renders as a plain
          link instead. Entirely absent (not an empty heading) when there is
          nothing to show — most profiles today, since there is no Profile
          Editor UI yet to add these after activation. */}
      {mediaReels.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-neutral-500">
            Media &amp; Work
          </h2>
          <div className="mt-3 grid gap-6 sm:grid-cols-2">
            {mediaReels.map((m, i) => (
              <div key={i}>
                {m.embed ? (
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-neutral-200">
                    <iframe
                      src={m.embed.src}
                      title={m.label}
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full"
                    />
                  </div>
                ) : (
                  m.href && (
                    <a
                      href={m.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex aspect-video items-center justify-center rounded-xl border border-neutral-300 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                    >
                      {m.label} ↗
                    </a>
                  )
                )}
                <p className="mt-2 text-sm font-medium text-neutral-700">{m.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== WHAT I OFFER (Professional Offerings — Slice 3) =============
          Flag-gated AND guarded by offerings.length (the section returns null
          when empty). CTA behavior is Slice 4 — these cards are read-only. */}
      {isProfessionalOfferingsEnabled() && (
        <OfferingsSection
          offerings={offerings}
          profileId={profile.profile_id}
          handle={handle}
          firstName={firstName}
          canAct={canAct}
          isOwner={isOwner}
        />
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
          {/* Ordered by SOCIAL_LABELS, not by whatever order the keys happen to
              sit in the JSON — otherwise the row reshuffles itself every time a
              member edits their links. Anything unrecognised still renders,
              last. `social` (above) is already normalized-and-filtered, so
              every href here is a safe, absolute external URL — never a
              same-site or broken link, fixing the exact bug that sent visitors
              to releveconnect.com/toddshanks.com. */}
          {Object.entries(social)
            .sort(([a], [b]) => {
              const keys = Object.keys(SOCIAL_LABELS);
              const ia = keys.indexOf(a);
              const ib = keys.indexOf(b);
              return (ia < 0 ? keys.length : ia) - (ib < 0 ? keys.length : ib);
            })
            .map(([k, href]) => (
            <a
              key={k}
              href={href}
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
