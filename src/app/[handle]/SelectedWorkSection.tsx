// PUBLIC "Selected Work" section on /[handle] — the proof-of-work section
// (2026-08-18 presentation pass).
//
// ── Why this exists ──
// The Featured Reel used to be a fixed hero concept, hardcoded as "Teaching
// Reel" both in label and in permanent above-the-fold placement — wrong for a
// choreographer, adjudicator, rehearsal director, or performer, for whom the
// reel is choreography, a résumé tape, or a performance clip, not a lesson.
// Founder, 2026-08-18: "Make this a generic Featured Work / Featured Reel
// media position so each professional can feature the work that best
// represents them... the component must not be teacher-specific."
//
// So the reel moved out of the hero into this section, generically labelled,
// alongside the photo gallery — "Selected Work," not "Gallery": reels and
// photos together read as proof of the work, not an attachment dump. The
// underlying data is unchanged (still `talent_profiles.teaching_reel_url` —
// no schema touched in this pass); only the label and position are generic now.
//
// Returns null when there is neither a reel nor any gallery photos, so a
// profile with none renders exactly as before.

import type { ReelEmbed } from "@/lib/profile/reel";

export default function SelectedWorkSection({
  reel,
  reelTitle,
  gallery,
}: {
  reel: ReelEmbed | null;
  /** Accessible iframe title, e.g. "Kathleen McAree — featured work". */
  reelTitle: string;
  gallery: string[];
}) {
  if (!reel && gallery.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-neutral-500">
        Selected Work
      </h2>
      <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Featured Reel — generic: whatever best represents THIS professional's
            work (choreography, a performance clip, a résumé tape), not
            specifically a teaching reel. Same vertical embed treatment as
            before; only its label and position changed. */}
        {reel && (
          <div className="mx-auto w-full max-w-[300px] shrink-0 sm:mx-0">
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-neutral-200">
              <iframe
                src={reel.src}
                title={reelTitle}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        )}

        {gallery.length > 0 && (
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
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
        )}
      </div>
    </section>
  );
}
