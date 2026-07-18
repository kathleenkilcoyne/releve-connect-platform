// An attachment chip — a small rounded pill with a leading glyph + short label
// (class music, lesson notes, prescreen video, run order…). In pass one these
// are non-functional seams: focusable buttons that don't navigate yet. Pass two
// wires them to open the asset.

import { ATTACHMENT_GLYPH } from "@/lib/this-week/categories";
import type { Attachment } from "@/lib/this-week/types";

export function AttachmentChip({ attachment }: { attachment: Attachment }) {
  return (
    <button
      type="button"
      // Non-functional in pass one; kept focusable so the seam is real.
      title="Preview coming in pass two"
      aria-label={`${attachment.label} (attachment — preview coming soon)`}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rc-hairline)] bg-[var(--rc-cream)] px-2.5 py-1 text-xs text-[var(--rc-ink)] transition-colors hover:bg-[var(--rc-gold-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)]"
    >
      <span aria-hidden="true" className="text-[var(--rc-muted)]">
        {ATTACHMENT_GLYPH[attachment.kind]}
      </span>
      {attachment.label}
    </button>
  );
}
