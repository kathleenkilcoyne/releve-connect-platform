"use client";

// The "Add / Edit a Professional Service" form — one calm page with visually
// separated stages, matching the Offerings builder so the two feel like one
// product. Human language throughout; no raw enum values on screen.
//
// It writes through the saveService server action. A live preview shows the
// member exactly the card they're about to place on their Relevé profile.
//
// The "Accompanist / Class Musician" category reveals its own optional fields
// (instrument, what they play for, rate, reel). That branch is the seam for the
// planned musicians expansion — nothing else about the form changes.

import { useActionState, useEffect, useState } from "react";
import {
  ACCOMPANIST,
  ACCOMPANIST_FOR,
  ACCOMPANIST_FOR_LABEL,
  ACCOMPANIST_SERVICE_TYPES,
  GENERAL_SERVICE_TYPES,
  INSTRUMENTS,
  INSTRUMENT_LABEL,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABEL,
  SERVICE_TYPE_LABEL,
  categoryLabel,
  deriveServiceCta,
  locationLine,
  rateLine,
  type Instrument,
  type ServiceCategory,
  type ServiceRow,
  type ServiceType,
} from "@/lib/services";
import { saveService, type ServiceActionState } from "@/lib/services/actions";

const input =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const label = "block text-xs font-medium text-neutral-600 mb-1";
const stepLabel = "text-xs font-medium uppercase tracking-[0.15em] text-neutral-400";

export default function ServiceBuilder({
  initial,
  onDone,
}: {
  initial: ServiceRow | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ServiceActionState, FormData>(saveService, {
    ok: false,
    message: "",
  });

  const [category, setCategory] = useState<ServiceCategory | "">(initial?.category ?? "");
  const [otherLabel, setOtherLabel] = useState(initial?.category_other_label ?? "");
  const [name, setName] = useState(initial?.business_name ?? "");
  const [desc, setDesc] = useState(initial?.short_description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [serviceType, setServiceType] = useState<ServiceType | "">(initial?.service_type ?? "");
  const [website, setWebsite] = useState(initial?.website_url ?? "");
  const [email, setEmail] = useState(initial?.business_email ?? "");
  const [phone, setPhone] = useState(initial?.business_phone ?? "");
  const [showEmail, setShowEmail] = useState(initial?.show_email ?? false);
  const [showPhone, setShowPhone] = useState(initial?.show_phone ?? false);
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.image_url ?? null);
  const [imageRemoved, setImageRemoved] = useState(false);
  // New services default to being shown — the member came here to add one.
  const [displayPublicly, setDisplayPublicly] = useState(
    initial ? initial.status === "active" : true,
  );

  // Accompanist branch.
  const [instrument, setInstrument] = useState<Instrument | "">(initial?.instrument ?? "");
  const [instrumentOther, setInstrumentOther] = useState(initial?.instrument_other ?? "");
  const [playsFor, setPlaysFor] = useState<string[]>(initial?.accompanist_for ?? []);
  const [rate, setRate] = useState(initial?.rate_display ?? "");
  const [rateContact, setRateContact] = useState(initial?.rate_contact ?? false);

  // Return to the list once the server confirms the save.
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  const err = state.errors ?? {};
  const isAccompanist = category === ACCOMPANIST;
  const typeChoices = isAccompanist ? ACCOMPANIST_SERVICE_TYPES : GENERAL_SERVICE_TYPES;

  // The live preview mirrors what the public card will do.
  const previewCta = deriveServiceCta({
    websiteUrl: website,
    businessEmail: email,
    businessPhone: phone,
    showEmail,
    showPhone,
  });
  const previewWhere = locationLine(location, serviceType || null);

  function togglePlaysFor(slug: string) {
    setPlaysFor((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-10">
      {initial && <input type="hidden" name="service_id" value={initial.id} />}

      {/* Stage 1 — Category -------------------------------------------- */}
      <section>
        <p className={stepLabel}>Step 1</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">
          What kind of service is it?
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Choosing a category means people will be able to find this on Relevé later.
        </p>
        <select
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ServiceCategory | "")}
          className={`${input} mt-3`}
        >
          <option value="">Choose…</option>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SERVICE_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        {category === "other" && (
          <div className="mt-3">
            <label className={label}>What would you call it?</label>
            <input
              name="category_other_label"
              value={otherLabel}
              onChange={(e) => setOtherLabel(e.target.value)}
              placeholder="e.g. Dance Medicine Consulting"
              className={input}
            />
          </div>
        )}
        {err.category && <p className="mt-2 text-sm text-red-600">{err.category}</p>}
      </section>

      {/* Stage 2 — Identity -------------------------------------------- */}
      <section>
        <p className={stepLabel}>Step 2</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">
          Service or business name
        </h2>
        <input
          name="business_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. McAree Bodywork"
          className={`${input} mt-3`}
        />
        {err.businessName && <p className="mt-2 text-sm text-red-600">{err.businessName}</p>}

        <div className="mt-5">
          <label className={label}>Short description</label>
          <textarea
            name="short_description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            placeholder="Sports Massage · Recovery · Dancer Wellness"
            className={input}
          />
          {err.shortDescription && (
            <p className="mt-2 text-sm text-red-600">{err.shortDescription}</p>
          )}
        </div>
      </section>

      {/* Stage 3 — Where / how ----------------------------------------- */}
      <section>
        <p className={stepLabel}>Step 3</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">Where do you offer it?</h2>
        <div className="mt-3">
          <label className={label}>Location</label>
          <input
            name="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. New York, NY"
            className={input}
          />
        </div>
        <input type="hidden" name="service_type" value={serviceType} />
        <div className="mt-4 flex flex-wrap gap-2">
          {typeChoices.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setServiceType(serviceType === t ? "" : t)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                serviceType === t
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
              }`}
            >
              {SERVICE_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </section>

      {/* Stage 3b — Accompanist / class musician (only for that category) */}
      {isAccompanist && (
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <p className={stepLabel}>Class musician</p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-900">
            A little more about your playing
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            All optional — it helps studios find the right musician for the right room.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Instrument</label>
              <select
                name="instrument"
                value={instrument}
                onChange={(e) => setInstrument(e.target.value as Instrument | "")}
                className={input}
              >
                <option value="">Choose…</option>
                {INSTRUMENTS.map((i) => (
                  <option key={i} value={i}>
                    {INSTRUMENT_LABEL[i]}
                  </option>
                ))}
              </select>
            </div>
            {instrument === "other" && (
              <div>
                <label className={label}>Which instrument?</label>
                <input
                  name="instrument_other"
                  value={instrumentOther}
                  onChange={(e) => setInstrumentOther(e.target.value)}
                  className={input}
                />
              </div>
            )}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
              Available for
            </p>
            <div className="flex flex-wrap gap-2">
              {ACCOMPANIST_FOR.map((a) => (
                <label
                  key={a}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white"
                >
                  <input
                    type="checkbox"
                    name="accompanist_for"
                    value={a}
                    checked={playsFor.includes(a)}
                    onChange={() => togglePlaysFor(a)}
                    className="sr-only"
                  />
                  {ACCOMPANIST_FOR_LABEL[a]}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Rate</label>
              <input
                name="rate_display"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                disabled={rateContact}
                placeholder="e.g. $60 / class"
                className={`${input} disabled:bg-neutral-100 disabled:text-neutral-400`}
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  name="rate_contact"
                  checked={rateContact}
                  onChange={(e) => setRateContact(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Contact for rate
              </label>
              {err.rateDisplay && <p className="mt-2 text-sm text-red-600">{err.rateDisplay}</p>}
            </div>
            <div>
              <label className={label}>Audio / video / reel link</label>
              <input
                name="media_url"
                defaultValue={initial?.media_url ?? ""}
                placeholder="https://…"
                className={input}
              />
              {err.mediaUrl && <p className="mt-2 text-sm text-red-600">{err.mediaUrl}</p>}
            </div>
          </div>
        </section>
      )}

      {/* Stage 4 — Links (identity, NOT a booking pathway) --------------
          The external Booking Link was removed on 2026-08-15: bookings are
          intended to happen ON Relevé, and a link to an outside booking page is
          exactly what made that impossible. Website and social stay — they're
          how someone checks you're real. */}
      <section>
        <p className={stepLabel}>Step 4</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">Where can people find you?</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Your own pages, so people can see your work and know you’re the real thing.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Website</label>
            <input
              name="website_url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className={input}
            />
            {err.websiteUrl && <p className="mt-2 text-sm text-red-600">{err.websiteUrl}</p>}
          </div>
          <div>
            <label className={label}>Instagram / social (optional)</label>
            <input
              name="social_url"
              defaultValue={initial?.social_url ?? ""}
              placeholder="https://instagram.com/…"
              className={input}
            />
            {err.socialUrl && <p className="mt-2 text-sm text-red-600">{err.socialUrl}</p>}
          </div>
        </div>
      </section>

      {/* Stage 4b — Booking on Relevé (the intended pathway) ------------ */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <p className={stepLabel}>Booking</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">
          Bookings happen on Relevé
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          When booking opens, people will be able to see your availability and book this service
          directly on Relevé — with payment handled here, and the record of the work kept on your
          profile. You won’t need to send anyone to an outside booking page.
        </p>
        <p className="mt-3 text-xs text-neutral-400">
          Nothing to set up yet. Pricing, duration, and availability arrive with booking.
        </p>
      </section>

      {/* Stage 5 — Contact (private unless they say otherwise) ---------- */}
      <section className="rounded-2xl border border-neutral-200 p-5">
        <p className={stepLabel}>Step 5 · optional</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">Business contact</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Kept private unless you tick the box beneath it. Nothing here is shown on your profile by
          default.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <label className={label}>Business email</label>
            <input
              name="business_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
              <input
                type="checkbox"
                name="show_email"
                checked={showEmail}
                onChange={(e) => setShowEmail(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Show this email on my public profile
            </label>
            {err.businessEmail && <p className="mt-2 text-sm text-red-600">{err.businessEmail}</p>}
          </div>
          <div>
            <label className={label}>Business phone</label>
            <input
              name="business_phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={input}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
              <input
                type="checkbox"
                name="show_phone"
                checked={showPhone}
                onChange={(e) => setShowPhone(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Show this number on my public profile
            </label>
          </div>
        </div>
      </section>

      {/* Stage 6 — Business card / logo --------------------------------- */}
      <section>
        <p className={stepLabel}>Step 6 · optional</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">
          Add your business card or logo
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          One image. It stays with this service and won’t change your profile gallery.
        </p>
        <div className="mt-3 flex items-center gap-5">
          <div className="h-24 w-24 overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-neutral-200">
            {imagePreview && !imageRemoved ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-neutral-300">
                ✦
              </div>
            )}
          </div>
          <label className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
            {imagePreview && !imageRemoved ? "Change image" : "Add image"}
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setImagePreview(URL.createObjectURL(f));
                  setImageRemoved(false);
                }
              }}
            />
          </label>
        </div>
        {initial?.image_url && !imageRemoved && (
          <label className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
            <input
              type="checkbox"
              name="image_remove"
              checked={imageRemoved}
              onChange={(e) => setImageRemoved(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Remove the current image
          </label>
        )}
      </section>

      {/* Preview + save ------------------------------------------------- */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <p className={stepLabel}>How it will look</p>
        <article className="mt-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <h3 className="text-lg font-semibold leading-snug text-neutral-900">
            {name || "Your service"}
          </h3>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
            {category ? categoryLabel(category, otherLabel) : "Category"}
          </p>
          {desc && <p className="mt-3 text-sm leading-relaxed text-neutral-600">{desc}</p>}
          {isAccompanist && rateLine({ rateDisplay: rate, rateContact }) && (
            <p className="mt-2 text-sm text-neutral-600">
              {rateLine({ rateDisplay: rate, rateContact })}
            </p>
          )}
          {previewWhere && <p className="mt-3 text-sm text-neutral-500">{previewWhere}</p>}
          {previewCta.action !== "none" && (
            <span className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
              {previewCta.label}
            </span>
          )}
        </article>

        <label className="mt-5 flex items-center gap-3">
          <input
            type="checkbox"
            name="display_publicly"
            checked={displayPublicly}
            onChange={(e) => setDisplayPublicly(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium text-neutral-800">
            Display this service on my public profile
          </span>
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "Saving…" : initial ? "Save changes" : "Add service"}
          </button>
          <button
            type="button"
            onClick={onDone}
            disabled={pending}
            className="text-sm text-neutral-500 underline disabled:opacity-40"
          >
            Cancel
          </button>
        </div>

        {!state.ok && state.message && <p className="mt-4 text-sm text-red-600">{state.message}</p>}
      </section>
    </form>
  );
}
