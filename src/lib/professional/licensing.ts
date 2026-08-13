// Licensing — a capability of the Professional Profile.
//
// A vetted professional flips "Available for Licensing" ON, then manages "Works
// Available to License." Each work moves through a reviewed lifecycle; only
// APPROVED work is ever public. Pure, testable rules live at the top; the thin
// DB loaders live below.
//
// Deliberately NOT here (parked): checkout, Stripe, splits/commission, payouts,
// Senior Spotlight, a rights/exclusivity engine. `license_type` is a freeform
// note this phase.

import type { SupabaseClient } from "@supabase/supabase-js";

/* ─────────────────────────────  Pure core  ───────────────────────────────── */

/** The six work statuses (matches the DB CHECK constraint). */
export type WorkStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "returned"
  | "approved"
  | "declined";

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In Review",
  returned: "Returned for Changes",
  approved: "Approved",
  declined: "Declined",
};

/** The ONLY status that renders on the public profile. */
export function isPubliclyVisible(status: WorkStatus): boolean {
  return status === "approved";
}

/** The artist may edit a work's fields only while it's a draft or was returned. */
export function canArtistEdit(status: WorkStatus): boolean {
  return status === "draft" || status === "returned";
}

/** "Submit for review" is available from draft or returned. */
export function canArtistSubmit(status: WorkStatus): boolean {
  return status === "draft" || status === "returned";
}

/** The artist may pull a work back only while it's still submitted (pre-review). */
export function canArtistWithdraw(status: WorkStatus): boolean {
  return status === "submitted";
}

/** Admin can act on works that are submitted or already in review. */
export function isAdminActionable(status: WorkStatus): boolean {
  return status === "submitted" || status === "in_review";
}

export type ArtistAction = "submit" | "withdraw";

/**
 * The artist-side status machine. Returns the next status, or null if the action
 * isn't legal from `current` (the server action rejects null — never guesses).
 */
export function artistTransition(
  current: WorkStatus,
  action: ArtistAction,
): WorkStatus | null {
  if (action === "submit" && canArtistSubmit(current)) return "submitted";
  if (action === "withdraw" && canArtistWithdraw(current)) return "draft";
  return null;
}

export type AdminAction = "start_review" | "approve" | "return" | "decline";

/**
 * The admin-side status machine: submitted → in_review → approved | returned |
 * declined (approve/return/decline may also act directly on a submitted work).
 * Returns null for an illegal transition.
 */
export function adminTransition(
  current: WorkStatus,
  action: AdminAction,
): WorkStatus | null {
  if (action === "start_review") {
    return current === "submitted" ? "in_review" : null;
  }
  if (!isAdminActionable(current)) return null;
  if (action === "approve") return "approved";
  if (action === "return") return "returned";
  if (action === "decline") return "declined";
  return null;
}

/* ───────────────────────────  Controlled vocab  ─────────────────────────── */

export const WORK_TYPE_OPTIONS = [
  "solo",
  "duet_trio",
  "group",
  "competition",
  "concert",
  "musical_theatre",
  "educational",
  "other",
] as const;
export type WorkType = (typeof WORK_TYPE_OPTIONS)[number];

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  solo: "Solo",
  duet_trio: "Duet / Trio",
  group: "Group",
  competition: "Competition",
  concert: "Concert / Stage",
  musical_theatre: "Musical Theatre",
  educational: "Educational",
  other: "Other",
};

export const WORK_ORIGIN_OPTIONS = ["repertory", "new"] as const;
export type WorkOrigin = (typeof WORK_ORIGIN_OPTIONS)[number];

export const WORK_ORIGIN_LABEL: Record<WorkOrigin, string> = {
  repertory: "Existing repertory",
  new: "New commission",
};

/** Humanize a stored token for display, falling back to the raw value. */
export function workTypeLabel(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return (WORK_TYPE_LABEL as Record<string, string>)[v] ?? v;
}

/* ─────────────────────────────  Record shape  ────────────────────────────── */

export interface WorkRecord {
  work_id: string;
  profile_id: string;
  title: string;
  work_type: string | null;
  style: string | null;
  cast_size: string | null;
  duration: string | null;
  level_audience: string | null;
  year_created: number | null;
  description: string | null;
  preview_video_url: string | null;
  origin: string | null;
  license_type: string | null;
  status: WorkStatus;
  review_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The editable fields of a work (everything the artist sets on the form). */
export interface WorkInput {
  title: string;
  work_type: string | null;
  style: string | null;
  cast_size: string | null;
  duration: string | null;
  level_audience: string | null;
  year_created: number | null;
  description: string | null;
  preview_video_url: string | null;
  origin: string | null;
  license_type: string | null;
}

/** Column list for full owner/admin reads (kept in one place). */
export const WORK_SELECT =
  "work_id, profile_id, title, work_type, style, cast_size, duration, " +
  "level_audience, year_created, description, preview_video_url, origin, " +
  "license_type, status, review_notes, submitted_at, reviewed_at, created_at, updated_at";

/** The public-safe subset shown on the public profile (approved works only). */
export interface PublicWork {
  work_id: string;
  title: string;
  work_type: string | null;
  style: string | null;
  cast_size: string | null;
  duration: string | null;
  level_audience: string | null;
  year_created: number | null;
  description: string | null;
  preview_video_url: string | null;
  license_type: string | null;
}

const PUBLIC_WORK_SELECT =
  "work_id, title, work_type, style, cast_size, duration, level_audience, " +
  "year_created, description, preview_video_url, license_type";

/* ────────────────────────────  DB assembly  ─────────────────────────────── */

export interface ArtistLicensing {
  availableForLicensing: boolean;
  works: WorkRecord[];
}

/**
 * Load the signed-in artist's licensing state: the ON/OFF flag + all their works
 * (any status), newest first. Tolerant by design — if the migration hasn't been
 * applied yet the reads fail softly to "off / no works" so the rest of the
 * professional home keeps rendering.
 */
export async function loadArtistLicensing(
  db: SupabaseClient,
  profileId: string,
): Promise<ArtistLicensing> {
  try {
    const [{ data: prof }, { data: works }] = await Promise.all([
      db
        .from("talent_profiles")
        .select("available_for_licensing")
        .eq("profile_id", profileId)
        .maybeSingle(),
      db
        .from("works")
        .select(WORK_SELECT)
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false }),
    ]);
    return {
      availableForLicensing: Boolean(
        (prof as { available_for_licensing?: boolean } | null)?.available_for_licensing,
      ),
      works: (works ?? []) as unknown as WorkRecord[],
    };
  } catch {
    return { availableForLicensing: false, works: [] };
  }
}

export interface PublicLicensing {
  availableForLicensing: boolean;
  works: PublicWork[];
}

/**
 * Load the APPROVED works to show on a public profile. Returns nothing unless the
 * profile has licensing switched on. Reads via whatever client is passed (the
 * public page uses the admin client and this filters in app code); also tolerant
 * of a not-yet-applied migration.
 */
export async function loadPublicApprovedWorks(
  db: SupabaseClient,
  profileId: string,
): Promise<PublicLicensing> {
  try {
    const { data: prof } = await db
      .from("talent_profiles")
      .select("available_for_licensing")
      .eq("profile_id", profileId)
      .maybeSingle();
    const availableForLicensing = Boolean(
      (prof as { available_for_licensing?: boolean } | null)?.available_for_licensing,
    );
    if (!availableForLicensing) return { availableForLicensing: false, works: [] };

    const { data: works } = await db
      .from("works")
      .select(PUBLIC_WORK_SELECT)
      .eq("profile_id", profileId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    return { availableForLicensing, works: (works ?? []) as unknown as PublicWork[] };
  } catch {
    return { availableForLicensing: false, works: [] };
  }
}
