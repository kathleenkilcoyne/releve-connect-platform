// The co-branded header shown ABOVE the calendar on This Week, for both self-
// managed members and studio/family members. It carries the member's OWN org
// identity — logo (or monogram) + name + motto — sourced from their affiliation,
// so it renders even with zero events this week.
//
// The accent is used only on a SAFE surface (the tile) with a COMPUTED accessible
// foreground, so any accent a Team Director picks stays legible. This personalizes
// the view; the Relevé platform mark stays in the top chrome — it is not replaced.

import { brandHeaderModel, type OrgBrand } from "@/lib/studio/branding";

export function TeamBrandHeader({ brand }: { brand: OrgBrand | null }) {
  if (!brand) return null;
  const m = brandHeaderModel(brand);

  const tileStyle = m.accent
    ? { backgroundColor: m.accent, color: m.foreground }
    : { backgroundColor: "var(--rc-gold-soft)", color: "var(--rc-ink)" };
  const ruleStyle = m.accent ? { backgroundColor: m.accent } : { backgroundColor: "var(--rc-hairline)" };

  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-base font-semibold"
        style={tileStyle}
        aria-hidden={m.logoUrl ? undefined : true}
      >
        {m.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.logoUrl} alt={`${m.name} logo`} className="h-full w-full object-cover" />
        ) : (
          m.monogram
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--rc-ink)]">{m.name}</p>
        {m.motto && <p className="truncate text-xs italic text-[var(--rc-muted)]">{m.motto}</p>}
        <div className="mt-1 h-0.5 w-10 rounded-full" style={ruleStyle} />
      </div>
    </div>
  );
}
