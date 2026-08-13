"use client";

// Share-your-profile control for the professional home (Slice 1). Copies the
// member's PUBLIC link (releveconnect.com/<handle>) to the clipboard — the
// "never hunt for your own URL" principle, one tap to hand it out. Uses the Web
// Share sheet on devices that support it, otherwise falls back to copy.

import { useState } from "react";

export default function ShareProfileButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/${slug}` : `/${slug}`;
    const nav: Navigator | undefined =
      typeof navigator !== "undefined" ? navigator : undefined;
    try {
      if (nav && typeof nav.share === "function") {
        await nav.share({ url, title: "My Relevé profile" });
        return;
      }
      if (nav && nav.clipboard) {
        await nav.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // user dismissed the share sheet, or clipboard unavailable — no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className="rounded-full px-6 py-3 text-center text-sm font-medium text-[var(--rc-taupe)] transition-colors hover:bg-[var(--rc-cream-soft)] hover:text-[var(--rc-ink)]"
    >
      {copied ? (
        <span className="text-[var(--rc-gold-deep)]">Link copied ✦</span>
      ) : (
        "Share profile"
      )}
    </button>
  );
}
