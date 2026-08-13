// PUBLIC "WHAT I OFFER" section on /[handle] (Professional Offerings — Slice 3).
//
// Presentational + server-only: it renders a professional's ACTIVE offerings as
// read-only cards. It deliberately does NOT wire any call-to-action — the
// Inquire / View Product / Register / View Licensing behavior is Slice 4. Cards
// show the offering's type, price, title, description, and (if set) how it's
// available; nothing here is clickable yet.
//
// The whole section is flag-gated in page.tsx AND guarded by offerings.length,
// and this component returns null when there are none — so a profile with no
// active offerings is byte-for-byte unchanged.

import {
  OFFERING_TYPE_LABEL,
  LOCATION_MODE_LABEL,
  pricingDisplay,
  type OfferingType,
  type PricingType,
  type LocationMode,
} from "@/lib/offerings";

/** The subset of an offering row the public card renders. */
export type PublicOffering = {
  id: string;
  type: OfferingType;
  title: string;
  short_description: string | null;
  image_url: string | null;
  pricing_type: PricingType | null;
  price_display: string | null;
  location_mode: LocationMode | null;
};

export default function OfferingsSection({ offerings }: { offerings: PublicOffering[] }) {
  if (offerings.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-neutral-500">
        What I Offer
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {offerings.map((o) => (
          <OfferingCard key={o.id} offering={o} />
        ))}
      </div>
    </section>
  );
}

function OfferingCard({ offering: o }: { offering: PublicOffering }) {
  const price = pricingDisplay({ priceDisplay: o.price_display, pricingType: o.pricing_type });

  // Reading order is deliberate: the TITLE leads (the offering, not its
  // category), then a quiet eyebrow of type + price, then the description, then
  // an optional image last. Restrained card treatment — editorial, not retail:
  // the price is small and muted, never a sales badge.
  return (
    <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
      {/* 1 · Title — the primary line. */}
      <h3 className="text-lg font-semibold leading-snug text-neutral-900">{o.title}</h3>

      {/* 2 · Type + price — secondary eyebrow beneath the title. */}
      <p className="mt-1.5 text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
        {OFFERING_TYPE_LABEL[o.type]}
        {price ? <span className="text-neutral-400"> · {price}</span> : null}
      </p>

      {/* 3 · Description. */}
      {o.short_description && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
          {o.short_description}
        </p>
      )}

      {o.location_mode && (
        <p className="mt-3 inline-block rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs text-neutral-600">
          {LOCATION_MODE_LABEL[o.location_mode]}
        </p>
      )}

      {/* 4 · Optional image — last, when present. */}
      {o.image_url && (
        <div className="mt-4 overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={o.image_url} alt="" className="aspect-[16/9] w-full object-cover" />
        </div>
      )}
    </article>
  );
}
