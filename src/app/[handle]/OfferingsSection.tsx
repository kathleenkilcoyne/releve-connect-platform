// PUBLIC "WHAT I OFFER" section on /[handle] (Professional Offerings).
//
// Slice 3 built the read-only cards; Slice 4 adds a call-to-action per Offering
// type via <OfferingCta> — reusing existing Relevé rails (the Request-an-Intro
// / connections flow for Inquire, the professional's external URL for products
// and events, the /experiences seam for licensing). The approved visual
// hierarchy is unchanged: title → type + price → description → optional image;
// the action sits at the foot of the card.
//
// The whole section is flag-gated in page.tsx AND guarded by offerings.length,
// and this component returns null when there are none — so a profile with no
// active offerings is byte-for-byte unchanged.

import {
  OFFERING_TYPE_LABEL,
  LOCATION_MODE_LABEL,
  pricingDisplay,
  deriveCta,
  isOfferingBookable,
  type OfferingType,
  type PricingType,
  type LocationMode,
  type CtaType,
} from "@/lib/offerings";
import OfferingCta from "./OfferingCta";
import BookOffering, { type BookableWindow } from "./BookOffering";

/** The subset of an offering row the public card renders (+ CTA derivation). */
export type PublicOffering = {
  id: string;
  type: OfferingType;
  title: string;
  short_description: string | null;
  image_url: string | null;
  pricing_type: PricingType | null;
  price_display: string | null;
  location_mode: LocationMode | null;
  cta_type: CtaType | null;
  external_url: string | null;
  signature_work_id: string | null;
  /** Canonical price (2026-09-01, Services transaction rail Phase 1) — drives
   *  bookability together with `open_windows`. Independent of `price_display`,
   *  which stays purely cosmetic. */
  price_cents: number | null;
  /** This offering's currently open, bookable windows — empty for every
   *  offering type except service/session, and empty until the professional
   *  both connects Stripe payouts and publishes a window (see page.tsx's
   *  loadOpenWindowsByOffering). Booking is offered ONLY when this is
   *  non-empty; otherwise the card falls back to the existing Inquire CTA. */
  open_windows: BookableWindow[];
};

type ViewerContext = {
  profileId: string;
  handle: string;
  firstName: string;
  canAct: boolean;
  isOwner: boolean;
};

export default function OfferingsSection({
  offerings,
  ...viewer
}: { offerings: PublicOffering[] } & ViewerContext) {
  if (offerings.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-neutral-500">
        What I Offer
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {offerings.map((o) => (
          <OfferingCard key={o.id} offering={o} viewer={viewer} />
        ))}
      </div>
    </section>
  );
}

function OfferingCard({ offering: o, viewer }: { offering: PublicOffering; viewer: ViewerContext }) {
  const price = pricingDisplay({ priceDisplay: o.price_display, pricingType: o.pricing_type });
  const cta = deriveCta({
    type: o.type,
    ctaType: o.cta_type,
    externalUrl: o.external_url,
    signatureWorkId: o.signature_work_id,
  });

  // Bookable on Relevé (Services transaction rail, Phase 1, 2026-09-01): a
  // service/session offering with a real price AND at least one open window.
  // This REPLACES the Inquire CTA for exactly this case — every other offering
  // (product/license/event/other, or a service/session not yet priced or with
  // no published time) renders <OfferingCta> exactly as it did before this
  // rail existed.
  const bookable =
    isOfferingBookable({ type: o.type, priceCents: o.price_cents }) && o.open_windows.length > 0;

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

      {/* Action — reuses existing Relevé rails (Slice 4); read-only content above
          is unchanged from the approved Slice 3 design. Bookable service/session
          offerings (Phase 1, 2026-09-01) get real on-Relevé checkout instead of
          Inquire; every other offering is completely unaffected. */}
      <div className="mt-5">
        {bookable ? (
          <BookOffering
            offeringTitle={o.title}
            priceCents={o.price_cents as number}
            windows={o.open_windows}
            handle={viewer.handle}
            canAct={viewer.canAct}
            isOwner={viewer.isOwner}
          />
        ) : (
          <OfferingCta
            cta={cta}
            offeringTitle={o.title}
            profileId={viewer.profileId}
            firstName={viewer.firstName}
            handle={viewer.handle}
            canAct={viewer.canAct}
            isOwner={viewer.isOwner}
          />
        )}
      </div>
    </article>
  );
}
