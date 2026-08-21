// The PUBLIC profile page — the member's shareable "link in bio" at the ROOT
// of the domain: releveconnect.com/<handle> (build spec §6). Rendered on the
// server with the admin client so logged-out visitors can view it. Only
// PUBLISHED, public profiles are shown to the world — EXCEPT the owner, who may
// preview their own draft (marked with a banner).
//
// Presentation rebuilt 2026-08-21 (reconciled from the sibling branch
// `feature/this-week-ui-redesign`, commits f2c57cf + c41d26d — see
// RECONCILIATION-NOTE / the reconciliation plan in that conversation): the
// page reads as a curated storefront, not an intake form. Header (identity
// only — the Featured Reel no longer lives here) → Bio → My Services →
// Available This Week → Selected Work (reel + gallery) → Credentials → Links.
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
import { hasAnyActiveMembership } from "@/lib/membership/access";
import { canViewByDirectLink, shouldIndex } from "@/lib/profile/visibility";
import { canConnect } from "@/lib/connections/messages";
import { isProfessionalOfferingsEnabled } from "@/lib/offerings";
import { isUpcoming, type PublicAvailabilityWindow } from "@/lib/profile/public-availability";
import ConnectActions from "./ConnectActions";
import OfferingsSection, { type PublicOffering } from "./OfferingsSection";
import AvailabilityWindowsSection from "./AvailabilityWindowsSection";
import SelectedWorkSection from "./SelectedWorkSection";

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
  // Not rendered publicly any more (founder decision 2026-08-21) — the field
  // and its data are untouched; only the public display was removed. Still
  // fetched below so nothing here silently changes shape if that decision
  // is ever revisited.
  touring_with: string | null;
};

async function loadProfile(handle: string) {
  if (isReservedSlug(handle)) return null;

  const db = createAdminClient();
  const { data } = await db
    .from("talent_profiles")
    .select(
      "profile_id, user_id, display_name, public_slug, primary_role, city, state_province, country, " +
        "bio, years_experience, credentials, headshot_url, teaching_reel_url, gallery_urls, resume_url, " +
        "honorifics, verification_flag, founder_distinction, social_links, profile_status, visibility, " +
        "teaching_at, touring_with",
    )
    .eq("public_slug", handle)
    .maybeSingle();

  const profile = data as ProfileRow | null;
  if (!profile) return null;

  // PROFILE V2 (founder decision §7). This used to require visibility === 'public',
  // which meant an `unlisted` profile 404'd for everyone — the value was honoured
  // on read but achieved nothing. Link-only now means what it says: published is
  // what makes a page reachable; visibility decides only whether it is DISCOVERABLE
  // (Roster inclusion + search indexing), not whether it loads for someone holding
  // the URL.
  const isLive = canViewByDirectLink({
    profileStatus: profile.profile_status,
    visibility: profile.visibility,
  });
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

  // Styles/Levels/Focus/Availability are fetched exactly as before — nothing
  // here changed. They are structured intake data used by the Roster's search
  // (a wholly separate SQL view, `roster_profiles`) and the editor; they are
  // simply no longer rendered as standalone tag rows on this page (founder
  // decision 2026-08-21 — see the commented-out render calls below).
  const pid = profile.profile_id;
  const [styles, levels, focus, avail] = await Promise.all([
    db.from("profile_styles").select("styles(label)").eq("profile_id", pid),
    db.from("profile_levels").select("levels(label)").eq("profile_id", pid),
    db.from("profile_focus_areas").select("focus_areas(label)").eq("profile_id", pid),
    db
      .from("profile_availability")
      .select("availability_tags(label, kind, sort_order)")
      .eq("profile_id", pid),
  ]);
  const labelsOf = (rows: unknown, key: string): string[] =>
    ((rows as Array<Record<string, { label: string } | { label: string }[]>>) ?? [])
      .map((r) => {
        const v = r[key];
        return Array.isArray(v) ? v[0]?.label : v?.label;
      })
      .filter(Boolean) as string[];

  // Availability, split back into its two kinds. The embedded row comes back as
  // either an object or a one-element array depending on how the client infers
  // the relationship — same reason `labelsOf` above handles both. Cast through
  // `unknown` and normalize.
  type AvailTag = { label: string; kind: string; sort_order: number };
  const availRows = ((avail.data ?? []) as unknown as Array<{
    availability_tags: AvailTag | AvailTag[] | null;
  }>)
    .map((r) => (Array.isArray(r.availability_tags) ? r.availability_tags[0] : r.availability_tags))
    .filter((t): t is AvailTag => Boolean(t))
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    profile,
    isDraftPreview,
    styles: labelsOf(styles.data, "styles"),
    levels: labelsOf(levels.data, "levels"),
    focus: labelsOf(focus.data, "focus_areas"),
    availGeneral: availRows.filter((t) => t.kind === "general").map((t) => t.label),
    availCurrently: availRows.filter((t) => t.kind === "currently").map((t) => t.label),
  };
}

// The professional's PUBLIC offerings for the "My Services" section. The admin
// client bypasses RLS, so we filter to status = 'active' EXPLICITLY —
// draft/hidden offerings must never leak onto the public profile. Ordered by
// the member's own sort_order. Only called when the feature flag is on.
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

// The professional's PUBLIC availability — "Available This Week". Reads
// `service_availability`, joined to My Services (`professional_offerings`).
//
// ── The column list below IS the privacy firewall ──
// The admin client bypasses RLS and column grants entirely, so what keeps this
// safe is that the query below NEVER SELECTS `source_personal_event_id` or
// `internal_note` — the two columns REVOKEd from anon/authenticated at the
// database level. This function simply never asks for them, the same
// discipline the write path applies. If a future edit adds `select("*")`
// here, that discipline is what breaks — so don't.
//
// Filters:
//   status = 'open'                       — only an explicitly published window
//   offering_id is not null                — only My Services windows (not the
//                                             separate Professional Services /
//                                             other-businesses booking path,
//                                             which this branch does not build)
//   professional_offerings.status = active — a since-deactivated service's old
//                                             windows do not linger publicly
//   ends_at >= now (isUpcoming)            — nothing already in the past
//
// No feature flag — this is the public read half of an existing write path,
// not a new gated feature. Guarded instead by `windows.length` inside
// AvailabilityWindowsSection, so a profile with no published windows renders
// exactly as before.
async function loadPublicAvailability(profileId: string): Promise<PublicAvailabilityWindow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("service_availability")
    .select("id, starts_at, ends_at, timezone, professional_offerings!inner(id, title, status)")
    .eq("profile_id", profileId)
    .eq("status", "open")
    .not("offering_id", "is", null)
    .eq("professional_offerings.status", "active")
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("[public profile] availability read failed:", error.message);
    return [];
  }

  type OfferingJoin = { id: string; title: string; status: string };
  type Row = {
    id: string;
    starts_at: string;
    ends_at: string;
    timezone: string;
    professional_offerings: OfferingJoin | OfferingJoin[] | null;
  };

  return ((data ?? []) as unknown as Row[])
    .map((r) => {
      const offering = Array.isArray(r.professional_offerings)
        ? r.professional_offerings[0]
        : r.professional_offerings;
      if (!offering) return null;
      const window: PublicAvailabilityWindow = {
        id: r.id,
        offeringId: offering.id,
        offeringTitle: offering.title,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        timezone: r.timezone,
      };
      return window;
    })
    .filter((w): w is PublicAvailabilityWindow => w !== null && isUpcoming(w));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const loaded = await loadProfile(handle);
  if (!loaded) return { title: "Profile · Relevé Connect" };

  // An unlisted profile asks search engines not to index it — without this,
  // "link-only" survives exactly until the first crawl of a shared link. A draft
  // being previewed by its owner is likewise never indexable.
  const indexable = shouldIndex({
    profileStatus: loaded.profile.profile_status,
    visibility: loaded.profile.visibility,
  });

  return {
    title: `${loaded.profile.display_name} · Relevé Connect`,
    description: loaded.profile.bio?.slice(0, 160) ?? undefined,
    robots: indexable ? undefined : { index: false, follow: false },
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

  const { profile, isDraftPreview } = loaded;
  const location = [profile.city, profile.state_province, profile.country]
    .filter(Boolean)
    .join(", ");
  const social = profile.social_links ?? {};
  const gallery = (profile.gallery_urls ?? []).filter(Boolean);
  const honorifics = (profile.honorifics ?? []).filter(Boolean);
  const reel = toReelEmbed(profile.teaching_reel_url);
  const firstName = profile.display_name.split(/\s+/)[0] || profile.display_name;

  // My Services — only queried when the flag is on, so with it OFF this page
  // issues no extra query and renders exactly as before.
  const offerings = isProfessionalOfferingsEnabled()
    ? await loadPublicOfferings(profile.profile_id)
    : [];

  // "Available This Week" — no feature flag; see loadPublicAvailability above.
  const availabilityWindows = await loadPublicAvailability(profile.profile_id);

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

      {/* ===== PROFESSIONAL HEADER (above the fold) =========================
          Identity only: photo, name, standing marks, title, location,
          experience. The Featured Reel no longer lives here — it renders
          generically, further down, in Selected Work (founder direction,
          2026-08-21 reconciliation) — right for a choreographer or
          adjudicator, not just a teacher. Portrait framing (3:4, rounded-2xl,
          object-top) is this branch's own headshot fix — preserved as-is. */}
      <section>
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
              {profile.primary_role ? titleCase(profile.primary_role) : ""}
              {profile.primary_role && location ? " · " : ""}
              {location}
            </p>
            {profile.years_experience && (
              <p className="mt-1 text-sm text-neutral-500">
                {profile.years_experience} years experience
              </p>
            )}
            {/* "Teaching at" — kept ONLY as an optional, understated line
                (founder decision 2026-08-21). Same muted caption style as the
                years-experience line above it; no bold label, no separate
                "Currently" section for one field. "Touring with" is
                deliberately NOT rendered anywhere on this page any more —
                the field and its data are untouched (see ProfileRow above),
                only the public display was removed. */}
            {profile.teaching_at && (
              <p className="mt-1 text-sm text-neutral-500">Teaching at {profile.teaching_at}</p>
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
      </section>

      {/* ===== YOUR STORY / BIO =============================================
          No section label on purpose — this introduces the person, not
          another form field. Set larger and more open than body copy
          elsewhere on the page (founder direction, 2026-08-18/21: "strong,
          readable, visually important"). */}
      {profile.bio && (
        <section className="mt-10 max-w-2xl">
          <p className="whitespace-pre-line text-lg leading-relaxed text-neutral-800">
            {profile.bio}
          </p>
        </section>
      )}

      {/* ===== MY SERVICES ===================================================
          Moved up to directly follow the story — immediately obvious what
          someone can hire this professional to do. Flag-gated AND guarded by
          offerings.length. */}
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

      {/* ===== AVAILABLE THIS WEEK ===========================================
          Follows My Services directly. Renders only when a genuinely valid
          published window exists — see loadPublicAvailability's filters
          (status='open', a real My Service, not yet ended); the component
          adds no filtering of its own. */}
      <AvailabilityWindowsSection
        windows={availabilityWindows}
        profileId={profile.profile_id}
        handle={handle}
        firstName={firstName}
        canAct={canAct}
        isOwner={isOwner}
      />

      {/* ===== SELECTED WORK =================================================
          Featured Reel (generic — whatever best represents this professional's
          work, not assumed to be teaching) + the photo gallery, together, as
          proof of the work rather than an attachment dump. Renders null when
          there is neither. */}
      <SelectedWorkSection
        reel={reel}
        reelTitle={`${profile.display_name} — featured work`}
        gallery={gallery}
      />

      {/* ===== INTAKE / STRUCTURED DATA — kept off the public presentation ===
          Styles, Teaching Levels, Focus, general Availability, and the
          already-retired "Currently accepting" made the page read like an
          application (founder direction, 2026-08-21). NONE of the underlying
          data, editor behavior, admin behavior, or Roster search/filter
          capability is touched by this — `loadProfile` still fetches all of
          it, byte-for-byte, for exactly that future use (the Roster's search
          reads a wholly separate SQL view, `roster_profiles`, independent of
          this page). Only the render calls below are commented out.

          <TagRow title="Styles" items={loaded.styles} />
          <TagRow title="Teaching levels" items={loaded.levels} />
          <TagRow title="Focus" items={loaded.focus} />
          <TagRow title="Availability" items={loaded.availGeneral} />
          <TagRow title="Currently accepting" items={loaded.availCurrently} />
      */}

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
              member edits their links. Anything unrecognised still renders, last. */}
          {Object.entries(social)
            .sort(([a], [b]) => {
              const keys = Object.keys(SOCIAL_LABELS);
              const ia = keys.indexOf(a);
              const ib = keys.indexOf(b);
              return (ia < 0 ? keys.length : ia) - (ib < 0 ? keys.length : ib);
            })
            .map(([k, v]) => (
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
