"use client";

// Static prototype affordance: switch between the professional view (Kathleen)
// and the parent/student "child's week" (Ava). In production there is no toggle
// — the viewer comes from the authenticated session — so this is clearly labelled
// as a preview control and is the ONE piece of pass-one-only chrome.

export type ViewKey = "professional" | "student";

export function ViewSwitch({
  value,
  onChange,
  professionalLabel,
  studentLabel,
}: {
  value: ViewKey;
  onChange: (next: ViewKey) => void;
  professionalLabel: string;
  studentLabel: string;
}) {
  const options: Array<{ key: ViewKey; label: string }> = [
    { key: "professional", label: professionalLabel },
    { key: "student", label: studentLabel },
  ];
  return (
    <div className="rounded-xl border border-dashed border-[var(--rc-hairline)] bg-[var(--rc-ivory)] p-2">
      <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--rc-muted)]">
        Preview · whose week
      </p>
      <div role="radiogroup" aria-label="Preview which week" className="flex gap-1">
        {options.map((opt) => {
          const selected = opt.key === value;
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.key)}
              className={[
                "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)]",
                selected
                  ? "bg-[var(--rc-ink)] text-[var(--rc-cream)]"
                  : "text-[var(--rc-ink)] hover:bg-[var(--rc-gold-soft)]",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
