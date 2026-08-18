// "PUBLIC" — the at-a-glance signal that THIS availability card currently has a
// live public window (2026-08-18). Styled off the Relevé gold accent used
// elsewhere in this-week/tokens.css, deliberately distinct from the category
// palette (PayBadge's note applies here too: status is conveyed by the word,
// never colour alone).

export function PublicBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: "var(--rc-gold)" }}
      />
      <span className="font-semibold uppercase tracking-[0.08em] text-[var(--rc-gold)]">
        Public
      </span>
    </span>
  );
}
