// "This Week" music — resolving the current track.
//
// ⚠️⚠️ LICENSING GUARDRAIL — the one rule that matters here ⚠️⚠️
// Only two kinds of audio may ever be served by this:
//   (a) royalty-free tracks Relevé has licensed, or
//   (b) a member musician's ORIGINAL work, with their permission.
// NEVER commercial/copyrighted music — not as a placeholder, not for a demo,
// not "just while we test". Serving audio from a real domain is publication, and
// it is exactly what a rights holder issues a takedown or an invoice for. There
// is no code that can enforce this; it is enforced by what gets uploaded, and
// uploads are admin-only for that reason.
//
// ── Why this is a "pipe", deliberately ──
// The track is addressed by ONE config value, never hardcoded. Today that points
// at a file Kathleen uploads to the `music` storage bucket. Later, the intended
// source is a member musician's original work — a `music_works` concept
// mirroring the choreographer works / Signature Experience model, so a musician
// can be credited and paid the way an artist is. When that arrives, only
// `getCurrentTrack()` changes; the player component does not.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Config keys, in one place so they can't drift between reader and writer. */
export const TRACK_KEY = "this_week_current_track";
export const TRACK_CREDIT_KEY = "this_week_current_track_credit";

/** The storage bucket holding licensed / original audio. Admin-write only. */
export const MUSIC_BUCKET = "music";

export interface CurrentTrack {
  /** Fully-qualified public URL of the audio file. */
  url: string;
  /** "Title — Artist", shown beside the player. Null when not set. */
  credit: string | null;
}

/**
 * The track to offer this week, or null if there isn't one.
 *
 * Null is a completely normal state — most weeks there may be no track, and the
 * player simply does not render. It is never an error.
 */
export async function getCurrentTrack(
  supabase: SupabaseClient,
): Promise<CurrentTrack | null> {
  const { data, error } = await supabase
    .from("app_config")
    .select("key, text_value")
    .in("key", [TRACK_KEY, TRACK_CREDIT_KEY]);

  if (error) {
    console.error("[this-week] current track read failed:", error.message);
    return null;
  }

  const rows = (data ?? []) as { key: string; text_value: string | null }[];
  const path = rows.find((r) => r.key === TRACK_KEY)?.text_value?.trim();
  if (!path) return null;

  const credit = rows.find((r) => r.key === TRACK_CREDIT_KEY)?.text_value?.trim() || null;

  // Already an absolute URL? Use it as-is — this is the seam that lets a future
  // `music_works` row (or a signed URL) drop in without changing the caller.
  if (/^https?:\/\//i.test(path)) return { url: path, credit };

  const { data: pub } = supabase.storage.from(MUSIC_BUCKET).getPublicUrl(path);
  if (!pub?.publicUrl) return null;

  return { url: pub.publicUrl, credit };
}
