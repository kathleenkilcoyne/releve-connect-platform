// PUBLIC "PROFESSIONAL SERVICES" section on /[handle].
//
// Other professional services or businesses this member runs alongside their
// dance work. It sits BELOW the dance identity (spec §3) and is styled as part
// of the profile — the same cards, type scale, and buttons as the rest of the
// page. It is NOT advertising: nothing is sponsored, ranked, or boosted, and the
// words "Advertisement" and "Sponsored" appear nowhere by design.
//
// The section is flag-gated in page.tsx AND guarded by services.length, and this
// component returns null when there are none — so a profile with no services is
// byte-for-byte unchanged.
//
// Contact details arrive here already filtered by toPublicService(): anything
// the member did not explicitly choose to display is null before it reaches the
// browser, never merely hidden with CSS.

import {
  BOOKING_COMING_SOON,
  categoryLabel,
  cardImageHref,
  deriveServiceCta,
  locationLine,
  rateLine,
  ACCOMPANIST,
  ACCOMPANIST_FOR_LABEL,
  INSTRUMENT_LABEL,
  type PublicServiceRow,
} from "@/lib/services";

export type PublicService = PublicServiceRow;

export default function ServicesSection({ services }: { services: PublicService[] }) {
  if (services.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-neutral-500">
        Professional Services
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {services.map((s) => (
          <ServiceCard key={s.id} service={s} />
        ))}
      </div>
    </section>
  );
}

function ServiceCard({ service: s }: { service: PublicService }) {
  const cta = deriveServiceCta({
    ctaLabel: s.cta_label,
    websiteUrl: s.website_url,
    businessEmail: s.business_email,
    businessPhone: s.business_phone,
    // The row has already been through toPublicService, so a non-null contact
    // value IS a published one.
    showEmail: Boolean(s.business_email),
    showPhone: Boolean(s.business_phone),
  });
  const imageHref = cardImageHref({ websiteUrl: s.website_url });
  const where = locationLine(s.location, s.service_type);
  const rate = s.category === ACCOMPANIST ? rateLine({
    rateDisplay: s.rate_display,
    rateContact: s.rate_contact,
  }) : null;
  const playsFor = s.category === ACCOMPANIST ? (s.accompanist_for ?? []) : [];
  const instrument =
    s.category === ACCOMPANIST && s.instrument
      ? s.instrument === "other"
        ? s.instrument_other || INSTRUMENT_LABEL.other
        : INSTRUMENT_LABEL[s.instrument]
      : null;

  return (
    <article className="flex flex-col rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
      {/* 1 · Business name — the primary line. */}
      <h3 className="text-lg font-semibold leading-snug text-neutral-900">{s.business_name}</h3>

      {/* 2 · Category — secondary eyebrow beneath the name. */}
      <p className="mt-1.5 text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
        {categoryLabel(s.category, s.category_other_label)}
        {instrument ? <span className="text-neutral-400"> · {instrument}</span> : null}
      </p>

      {/* 3 · Description. */}
      {s.short_description && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
          {s.short_description}
        </p>
      )}

      {/* Class-musician detail — only ever rendered for that category. */}
      {playsFor.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {playsFor.map((a) => (
            <span
              key={a}
              className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs text-neutral-600"
            >
              {ACCOMPANIST_FOR_LABEL[a]}
            </span>
          ))}
        </div>
      )}
      {rate && <p className="mt-3 text-sm text-neutral-600">{rate}</p>}

      {/* 4 · Business card / logo — clickable when there's somewhere to go. */}
      {s.image_url && (
        <div className="mt-4 overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
          {imageHref ? (
            <a
              href={imageHref}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label={`${s.business_name} — visit website`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.image_url}
                alt={`${s.business_name} business card`}
                className="aspect-[16/9] w-full object-contain"
              />
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.image_url}
              alt={`${s.business_name} business card`}
              className="aspect-[16/9] w-full object-contain"
            />
          )}
        </div>
      )}

      {/* 5 · Location / delivery — quiet, just above the action. */}
      {where && <p className="mt-4 text-sm text-neutral-500">{where}</p>}

      {/* Published contact details, when the member chose to show them. */}
      {(s.business_email || s.business_phone) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
          {s.business_email && (
            <a href={`mailto:${s.business_email}`} className="underline">
              {s.business_email}
            </a>
          )}
          {s.business_phone && (
            <a href={`tel:${s.business_phone.replace(/[^\d+]/g, "")}`} className="underline">
              {s.business_phone}
            </a>
          )}
        </div>
      )}

      {/* 6 · The action.
          "Book on Relevé" is the intended PRIMARY action — booking, payment and
          the record of the work all stay on the platform. Until that rail ships
          it renders as a disabled coming-soon button rather than a link that
          quietly takes the visitor (and the transaction) somewhere else.
          The website button is identity, not a booking pathway. */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {cta.action === "releve_booking" &&
          (cta.enabled ? (
            <a
              href={`/book/${s.id}`}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              {cta.label}
            </a>
          ) : (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span
                aria-disabled="true"
                className="cursor-default rounded-lg bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-500"
              >
                {cta.label}
              </span>
              <span className="text-xs text-neutral-400">{BOOKING_COMING_SOON}</span>
            </span>
          ))}
        {(cta.action === "link" || cta.action === "contact") && (
          <a
            href={cta.href}
            {...(cta.action === "link"
              ? { target: "_blank", rel: "noopener noreferrer nofollow" }
              : {})}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {cta.label}
            {cta.action === "link" ? " ↗" : ""}
          </a>
        )}
        {s.social_url && (
          <a
            href={s.social_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-sm font-medium text-neutral-600 underline"
          >
            Instagram ↗
          </a>
        )}
        {s.media_url && (
          <a
            href={s.media_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-sm font-medium text-neutral-600 underline"
          >
            Listen / watch ↗
          </a>
        )}
      </div>
    </article>
  );
}
