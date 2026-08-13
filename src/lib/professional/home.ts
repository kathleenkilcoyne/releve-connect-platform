// "My Professional Home" — the data layer for the signed-in `/profile` home
// (Slice 1). Pure, testable shaping helpers live at the top; the DB loader that
// assembles the home view-model from the admin client lives below.
//
// Honest-numbers rule (PROFESSIONAL-HOME-AND-MESSAGES prompt §Slice 1): every
// figure maps to data that actually exists today —
//   * saves      → `shortlists` (studios who shortlisted this professional)
//   * inquiries  → `connections` of type 'message-request' (someone reached out)
//   * views      → `profile_views` (Slice 1's lightweight counter)
// Messages/Notifications unread counts are 0 until Slice 2/Slice 3 wire them; we
// show the links without a badge rather than a dead "0".

import type { SupabaseClient } from "@supabase/supabase-js";

/* ─────────────────────────────  Pure core  ───────────────────────────────── */

export interface ProfileActivity {
  /** Studios who saved/shortlisted this professional (`shortlists`). */
  saves: number;
  /** Inbound inquiries (`connections` type 'message-request'). */
  inquiries: number;
  /** Public profile views (`profile_views`). Count only in Slice 1. */
  views: number;
}

/** True iff there is any Profile Activity worth showing a number for. */
export function hasActivity(a: ProfileActivity): boolean {
  return a.saves > 0 || a.inquiries > 0 || a.views > 0;
}

/**
 * Should a public-profile render be recorded as a view? Pure so the rule is
 * provable: only LIVE (published/public) profiles count, and a member viewing
 * their OWN profile never inflates their own number.
 */
export function shouldLogProfileView(input: {
  isLive: boolean;
  isOwnerViewing: boolean;
}): boolean {
  return input.isLive && !input.isOwnerViewing;
}

/**
 * The unread badge value to render for a count. 0 (or negative) → null so the UI
 * shows the link with no badge instead of a discouraging "0". Anything over 99
 * caps at "99+".
 */
export function unreadBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

/** First name for the greeting, resilient to empty/whitespace display names. */
export function firstNameOf(displayName: string | null | undefined): string | null {
  const trimmed = (displayName ?? "").trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

/** "City, State, Country" from parts, skipping blanks. Empty → null. */
export function locationLabel(
  parts: Array<string | null | undefined>,
): string | null {
  const label = parts.map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
  return label || null;
}

/** Title-case a controlled-vocabulary token like a primary role ("working_dancer"). */
export function titleCaseRole(role: string | null | undefined): string | null {
  const t = (role ?? "").trim();
  if (!t) return null;
  return t
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The public-facing "Available for" services vocabulary. Slice 1 renders this as
 * the visual placeholder under the member's identity — it establishes the
 * information architecture. Per-profile selection (each pro picks their subset)
 * is the future "Professional Offerings · Manage" flow; no per-profile services
 * field exists yet, so we show the canonical set for now.
 */
export const AVAILABLE_FOR_SERVICES: readonly string[] = [
  "Master Classes",
  "Guest Teaching",
  "Private Coaching",
  "Choreography",
  "Competition Choreography",
  "College Audition Coaching",
  "Convention / Intensive Faculty",
  "Adjudication",
  "Workshops",
];

/**
 * Is this member a hand-selected Senior Spotlight artist? Senior Spotlight is a
 * CURATED, invitation-only annual catalog — not every professional's licensing
 * area. Slice 1 gates the honor card on an existing founder distinction as a
 * placeholder proxy; a later slice replaces this with explicit catalog
 * membership. Returns false for ordinary members, so the card simply doesn't show.
 */
export function isSeniorSpotlightArtist(
  founderDistinction: string | null | undefined,
): boolean {
  // Minimal safe fix (handoff §6): `'none'` is the DB's "no distinction"
  // sentinel and must NOT light up the honor card. Treat empty/whitespace and
  // 'none' as false; any real distinction remains truthy.
  const v = (founderDistinction ?? "").trim().toLowerCase();
  return v !== "" && v !== "none";
}

/* ────────────────────────────  DB assembly  ─────────────────────────────── */

export interface ProfessionalHome {
  displayName: string | null;
  firstName: string | null;
  verified: boolean;
  publicSlug: string | null;
  /** Visual identity for the centerpiece hero. */
  headshotUrl: string | null;
  primaryRole: string | null;
  location: string | null;
  honorifics: string[];
  /** Hand-selected Senior Spotlight artist → show the honor card. */
  isSeniorSpotlight: boolean;
  activity: ProfileActivity;
  /** 0 until Slice 2 (Messages) / Slice 3 (Notifications). */
  unreadMessages: number;
  unreadNotifications: number;
  /** Show the Swing entry point only when the member is actively available. */
  swingActive: boolean;
}

/**
 * Assemble the professional home for a talent profile. `db` is the service-role
 * admin client (the home page already resolves the actor with it), so these
 * reads are consistent regardless of RLS elsewhere. Counts use head+exact so we
 * get a COUNT without hauling rows back.
 */
export async function loadProfessionalHome(
  db: SupabaseClient,
  input: { talentProfileId: string; publicSlug: string | null },
): Promise<ProfessionalHome> {
  const pid = input.talentProfileId;

  const [{ data: profile }, savesRes, inquiriesRes, viewsRes, { data: swing }] = await Promise.all([
    db
      .from("talent_profiles")
      .select(
        "display_name, verification_flag, headshot_url, primary_role, city, state_province, country, honorifics, founder_distinction",
      )
      .eq("profile_id", pid)
      .maybeSingle(),
    db.from("shortlists").select("*", { count: "exact", head: true }).eq("profile_id", pid),
    db
      .from("connections")
      .select("*", { count: "exact", head: true })
      .eq("to_profile_id", pid)
      .eq("type", "message-request"),
    db.from("profile_views").select("*", { count: "exact", head: true }).eq("profile_id", pid),
    db.from("swing_availability").select("is_available").eq("profile_id", pid).maybeSingle(),
  ]);

  const p = profile as {
    display_name: string | null;
    verification_flag: boolean | null;
    headshot_url: string | null;
    primary_role: string | null;
    city: string | null;
    state_province: string | null;
    country: string | null;
    honorifics: string[] | null;
    founder_distinction: string | null;
  } | null;
  const s = swing as { is_available: boolean | null } | null;

  return {
    displayName: p?.display_name ?? null,
    firstName: firstNameOf(p?.display_name),
    verified: Boolean(p?.verification_flag),
    publicSlug: input.publicSlug,
    headshotUrl: p?.headshot_url ?? null,
    primaryRole: titleCaseRole(p?.primary_role),
    location: locationLabel([p?.city, p?.state_province, p?.country]),
    honorifics: (p?.honorifics ?? []).filter(Boolean),
    isSeniorSpotlight: isSeniorSpotlightArtist(p?.founder_distinction),
    activity: {
      saves: savesRes.count ?? 0,
      inquiries: inquiriesRes.count ?? 0,
      views: viewsRes.count ?? 0,
    },
    unreadMessages: 0,
    unreadNotifications: 0,
    swingActive: Boolean(s?.is_available),
  };
}

/**
 * Fire-and-forget: record a public-profile view. Never throws — a view counter
 * must never break the page it counts. Caller decides eligibility with
 * `shouldLogProfileView`.
 */
export async function logProfileView(
  db: SupabaseClient,
  input: { profileId: string; viewerId: string | null },
): Promise<void> {
  try {
    await db.from("profile_views").insert({
      profile_id: input.profileId,
      viewer_id: input.viewerId,
    });
  } catch {
    // swallow — analytics is never allowed to break rendering.
  }
}
