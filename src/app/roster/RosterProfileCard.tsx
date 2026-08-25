// A single Roster result. Founder direction (2026-08-25): the desktop/tablet
// treatment below (a taller portrait card, tags in a light strip beneath the
// photo) stayed exactly as approved. This revision touches ONLY the mobile
// presentation — the photo container is a fixed, compact height there instead
// of a tall aspect-ratio portrait, and everything (name, verified mark, role,
// location, up to 2 tags) is overlaid directly on the scrim, so the whole
// card — not just the photo — is short enough that 2–3 professionals are
// visible in one phone viewport. The photo itself is still full-bleed and can
// still crop dramatically; only the CONTAINER around it is compressed. Same
// image, same crop rule (`object-cover object-top`) at every size.
//
// `mark` is sourced from `honorifics` (already selected by the Roster query,
// previously fetched but never rendered) — an editorial credit line like
// "Founding Artist" or "Master Teacher", conferred by an admin. This is
// DIFFERENT from `founder_distinction` ("Founding Professional"/"Founding
// 25"), which is not exposed by the `roster_profiles` view and is therefore
// NOT shown here — surfacing it would need a one-column addition to that
// view, a schema change outside this redesign's scope.

import Link from "next/link";

export type RosterProfileCardProps = {
  slug: string;
  displayName: string;
  headshotUrl: string | null;
  verified: boolean;
  roleText: string;
  location: string;
  tags: string[]; // already capped to 2 by the caller
  mark: string | null; // an honorific credit line, or null
};

export default function RosterProfileCard({
  slug,
  displayName,
  headshotUrl,
  verified,
  roleText,
  location,
  tags,
  mark,
}: RosterProfileCardProps) {
  const nameLine = (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <span className="truncate">{displayName}</span>
      {verified && (
        <span
          title="Verified Member"
          className="inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full border border-[color:var(--rc-gold-bright)] text-[7px] font-bold text-[color:var(--rc-gold-bright)] sm:h-[17px] sm:w-[17px] sm:text-[10px]"
        >
          ✓
        </span>
      )}
    </div>
  );

  const roleLine = (
    <p className="truncate tracking-[0.01em] text-[#e7d9ba]">
      {roleText}
      {roleText && location ? " · " : ""}
      {location}
    </p>
  );

  return (
    <Link
      href={`/${slug}`}
      className="group block overflow-hidden rounded-2xl border border-[color:var(--rc-line)] bg-[color:var(--rc-cream-2)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_18px_34px_-16px_rgba(14,11,10,0.32)]"
    >
      {/* Photo container — this is the entire refinement: a fixed, compact
          height on mobile (h-[152px]) instead of a tall aspect-ratio portrait,
          reverting to the original taller card at sm: and up. */}
      <div className="relative h-[152px] w-full bg-neutral-200 sm:aspect-[3/4] sm:h-auto">
        {headshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headshotUrl}
            alt={displayName}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-neutral-400 sm:text-6xl">
            ☺
          </div>
        )}

        {/* Bottom scrim — guarantees the overlaid text reads regardless of the photo. */}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(14,11,10,0.86)] from-0% via-transparent via-54% to-transparent" />

        {/* Editorial mark — a museum-placard credit line, not an app status
            chip: glass background, thin gold hairline, serif italic. Small
            and unobtrusive on mobile per founder direction ("should remain
            but be small and elegant"). */}
        {mark && (
          <div className="absolute left-2 top-2 sm:left-3.5 sm:top-3.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(217,184,95,0.55)] bg-[rgba(14,11,10,0.4)] px-2 py-0.5 font-[family-name:var(--font-rc-serif)] text-[9.5px] italic text-[color:var(--rc-gold-bright)] backdrop-blur-sm sm:gap-1.5 sm:px-3 sm:py-1 sm:text-[12px]">
              <span className="text-[9px] not-italic sm:text-[11px]">✦</span>
              {mark}
            </span>
          </div>
        )}

        {/* Mobile: name, role/location, AND tags all live here on the photo —
            there is no separate section below it, which is what makes the
            whole card compact, not just the image. */}
        <div className="absolute inset-x-3 bottom-2.5 text-white sm:hidden">
          <div className="font-[family-name:var(--font-rc-serif)] text-[15px] leading-tight">{nameLine}</div>
          <div className="mt-0.5 text-[10px]">{roleLine}</div>
          {tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[rgba(255,255,255,0.35)] bg-[rgba(14,11,10,0.35)] px-2 py-[1px] text-[9px] text-[#f1e9d8] backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tablet/desktop: unchanged from the approved design — name and
            role/location on the photo, tags in the strip below. */}
        <div className="absolute inset-x-4 bottom-4 hidden text-white sm:block">
          <div className="font-[family-name:var(--font-rc-serif)] text-[23px] leading-tight tracking-[0.01em]">{nameLine}</div>
          <div className="mt-1 text-[12.5px]">{roleLine}</div>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="hidden flex-wrap gap-1.5 px-4 py-3 sm:flex">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[rgba(30,26,23,0.06)] px-2.5 py-0.5 text-[11px] text-[color:var(--rc-ink-soft)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
