// Turns a pasted Vimeo/YouTube link into an embeddable player URL for the
// Teaching Reel hero (build spec §6: autoplay-muted). Pure + dependency-free so
// it can be unit-tested. Returns null for anything we can't confidently embed
// (the profile then just falls back to the headshot hero).

export type ReelEmbed = { provider: "vimeo" | "youtube"; src: string };

/**
 * Parse a Vimeo or YouTube URL and return an autoplay-muted (looping) embed URL.
 * Autoplay + muted only — controls stay on, so a visitor can unmute and scrub.
 */
export function toReelEmbed(raw: string | null | undefined): ReelEmbed | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;

  // --- Vimeo: vimeo.com/123, player.vimeo.com/video/123, with optional hash ---
  const vimeo = url.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) {
    const id = vimeo[1];
    return {
      provider: "vimeo",
      src: `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&title=0&byline=0&portrait=0`,
    };
  }

  // --- YouTube: watch?v=, youtu.be/, /embed/, /shorts/ (11-char id) ---
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i,
  );
  if (yt) {
    const id = yt[1];
    // loop on YouTube requires playlist=<id>; playsinline keeps it inline on iOS.
    return {
      provider: "youtube",
      src: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&playsinline=1&rel=0`,
    };
  }

  return null;
}
