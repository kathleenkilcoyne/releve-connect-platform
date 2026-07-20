"use client";

// "You Matter Here" — the greeting band at the top of This Week.
//
// One quiet moment before the week itself: the line that rotates daily, and
// (when there is one) an optional track to play while you look at your week.
//
// ── Palette ──
// BLACK · CREAM · GOLD, like everything else. The original mockup for this was
// deep plum-and-gold; the plum is deliberately NOT carried over — Relevé's
// palette is these three colours and nothing else. This band uses the black
// ground as its "moment" and the existing `.this-week-scope` gold for accent.

import { useEffect, useRef, useState } from "react";

export interface GreetingTrack {
  url: string;
  credit: string | null;
}

export function GreetingBand({
  message,
  track,
}: {
  /** Today's line. Resolved on the server so it can't flicker or hydrate late. */
  message: string;
  /** This week's track, or null when none is set — then no player renders. */
  track?: GreetingTrack | null;
}) {
  return (
    <section
      aria-label="You matter here"
      className="relative overflow-hidden rounded-2xl bg-[var(--rc-ink)] px-6 py-8 text-center sm:px-10 sm:py-10"
    >
      {/* A soft gold bloom, purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, rgba(230,198,132,0.16), rgba(0,0,0,0) 60%)",
        }}
      />

      <div className="relative">
        <p className="text-[0.68rem] uppercase tracking-[0.32em] text-[var(--rc-gold)] opacity-90">
          Welcome home
        </p>

        <h2 className="rc-serif mt-3 text-[clamp(1.6rem,4.2vw,2.4rem)] font-medium leading-tight text-[var(--rc-cream)]">
          You Matter <span className="italic text-[var(--rc-gold)]">Here.</span>
        </h2>

        {/* Hairline rule, mirroring the mockup's gold divider. */}
        <div
          aria-hidden="true"
          className="mx-auto my-5 h-px w-16"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--rc-gold), transparent)",
          }}
        />

        <p className="rc-serif mx-auto max-w-[38rem] text-[clamp(1rem,2.2vw,1.2rem)] italic leading-relaxed text-[var(--rc-cream)] opacity-95">
          {message}
        </p>

        {track && <TrackPlayer track={track} />}
      </div>
    </section>
  );
}

/**
 * Tap-to-play, never autoplay.
 *
 * Browsers block audio that starts on its own, and rightly so — a calendar that
 * makes noise the moment it opens is hostile, especially to someone checking
 * their week in a quiet room or a studio. So playback is always user-initiated.
 */
function TrackPlayer({ track }: { track: GreetingTrack }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  // Keep our state honest if playback ends or is stopped by the browser/OS.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const sync = () => setPlaying(!el.paused && !el.ended);
    el.addEventListener("play", sync);
    el.addEventListener("pause", sync);
    el.addEventListener("ended", sync);
    return () => {
      el.removeEventListener("play", sync);
      el.removeEventListener("pause", sync);
      el.removeEventListener("ended", sync);
    };
  }, []);

  async function toggle() {
    const el = audioRef.current;
    if (!el) return;
    try {
      if (el.paused) await el.play();
      else el.pause();
    } catch {
      // A rejected play() is usually an autoplay-policy or decode failure. Say
      // so rather than leaving a button that silently does nothing.
      setFailed(true);
    }
  }

  return (
    <div className="mt-7 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        className="inline-flex items-center gap-2.5 rounded-full border border-[var(--rc-gold)] px-5 py-2 text-[0.75rem] uppercase tracking-[0.16em] text-[var(--rc-gold)] transition-colors hover:bg-[color:rgba(230,198,132,0.12)]"
      >
        <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
        {playing ? "Pause today's track" : "Tap to play today's track"}
      </button>

      {track.credit && (
        <p className="text-[0.72rem] tracking-wide text-[var(--rc-cream)] opacity-60">
          {track.credit}
        </p>
      )}

      {failed && (
        <p role="status" className="text-[0.72rem] text-[var(--rc-gold)] opacity-80">
          Couldn&apos;t play that track just now.
        </p>
      )}

      {/* preload="none" — never pull down audio a member hasn't asked for. */}
      <audio ref={audioRef} src={track.url} preload="none" />
    </div>
  );
}
