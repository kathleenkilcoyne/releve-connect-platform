import { describe, it, expect } from "vitest";
import { toReelEmbed } from "./reel";

// The Teaching Reel is the highest-value item in the visual-first hero (§6). It
// must autoplay muted, and we must never render an un-embeddable URL.
describe("toReelEmbed", () => {
  it("embeds a plain Vimeo URL, autoplay + muted", () => {
    const e = toReelEmbed("https://vimeo.com/123456789");
    expect(e?.provider).toBe("vimeo");
    expect(e?.src).toContain("player.vimeo.com/video/123456789");
    expect(e?.src).toContain("autoplay=1");
    expect(e?.src).toContain("muted=1");
  });

  it("embeds a Vimeo player URL", () => {
    expect(toReelEmbed("https://player.vimeo.com/video/987654321")?.src).toContain(
      "player.vimeo.com/video/987654321",
    );
  });

  it("embeds a YouTube watch URL, autoplay + muted + looping", () => {
    const e = toReelEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(e?.provider).toBe("youtube");
    expect(e?.src).toContain("youtube.com/embed/dQw4w9WgXcQ");
    expect(e?.src).toContain("autoplay=1");
    expect(e?.src).toContain("mute=1");
    // loop requires playlist=<id> on YouTube
    expect(e?.src).toContain("playlist=dQw4w9WgXcQ");
  });

  it("embeds youtu.be and /shorts/ forms", () => {
    expect(toReelEmbed("https://youtu.be/dQw4w9WgXcQ")?.src).toContain("embed/dQw4w9WgXcQ");
    expect(toReelEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.src).toContain(
      "embed/dQw4w9WgXcQ",
    );
  });

  it("returns null for empty, missing, or non-video URLs", () => {
    expect(toReelEmbed(null)).toBeNull();
    expect(toReelEmbed(undefined)).toBeNull();
    expect(toReelEmbed("")).toBeNull();
    expect(toReelEmbed("   ")).toBeNull();
    expect(toReelEmbed("https://instagram.com/someone")).toBeNull();
  });
});
