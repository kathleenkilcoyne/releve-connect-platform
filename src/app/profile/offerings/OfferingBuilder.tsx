"use client";

// The guided "Add / Edit an Offering" experience — a single calm page with
// visually separated stages, not one giant technical form. Human language
// throughout; no "CTA type", no "listing title", no raw enum values. It writes
// through the saveOffering server action; a live preview shows the professional
// exactly what they're about to place on their Relevé profile.

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  OFFERING_TYPES,
  OFFERING_TYPE_LABEL,
  PRICING_TYPE_LABEL,
  LOCATION_MODE_LABEL,
  LOCATION_MODES,
  AMOUNT_PRICING_TYPES,
  pricingDisplay,
  type OfferingType,
  type PricingType,
  type LocationMode,
  type OfferingRow,
} from "@/lib/offerings";
import { saveOffering, type OfferingActionState } from "@/lib/offerings/actions";

const input =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const stepLabel = "text-xs font-medium uppercase tracking-[0.15em] text-neutral-400";

// One-line explanations for the type step (founder copy).
const TYPE_BLURB: Record<OfferingType, string> = {
  service: "A professional skill or service you provide.",
  session: "Coaching, lessons, consultations, or other time someone can book with you.",
  product: "Something you create and sell.",
  license: "Creative work available for licensing.",
  event: "A class, workshop, intensive, event, or other experience people can attend.",
  other: "Something entirely your own.",
};

// Pricing choices shown in the builder (a friendly subset/order of the model).
const PRICING_CHOICES: PricingType[] = [
  "fixed",
  "hourly",
  "daily",
  "project",
  "starting_at",
  "free",
  "contact",
  "hidden",
];

const NAME_HINTS =
  "e.g. Recital Stage Management · Private Audition Coaching · Dance Reel Editing · Contemporary Master Class";

// Which types collect an external link, and how the response reads to the member.
function responseCopy(type: OfferingType): { line: string; wantsUrl: boolean; urlLabel: string } {
  switch (type) {
    case "product":
      return {
        line: "People will see View Product.",
        wantsUrl: true,
        urlLabel: "Add a link to your shop or product page.",
      };
    case "event":
      return {
        line: "People will see Register.",
        wantsUrl: true,
        urlLabel: "Add a registration link.",
      };
    case "license":
      return { line: "People will see View Licensing on your public profile.", wantsUrl: false, urlLabel: "" };
    default:
      return {
        line: "People will see Inquire. You’ll receive their request through Relevé.",
        wantsUrl: false,
        urlLabel: "",
      };
  }
}

/** Best-effort extract of a numeric amount from a stored price_display. */
function amountFromDisplay(display: string | null): string {
  if (!display) return "";
  const m = display.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] : "";
}

export default function OfferingBuilder({
  initial,
  onDone,
}: {
  initial: OfferingRow | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<OfferingActionState, FormData>(saveOffering, {
    ok: false,
    message: "",
  });

  const [type, setType] = useState<OfferingType | "">(initial?.type ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [desc, setDesc] = useState(initial?.short_description ?? "");
  const [pricingType, setPricingType] = useState<PricingType | "">(initial?.pricing_type ?? "");
  const [amount, setAmount] = useState(amountFromDisplay(initial?.price_display ?? null));
  const [location, setLocation] = useState<LocationMode | "">(initial?.location_mode ?? "");
  const [externalUrl, setExternalUrl] = useState(initial?.external_url ?? "");
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.image_url ?? null);
  const [imageRemoved, setImageRemoved] = useState(false);

  // Return to the list once the server confirms the save.
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  const wantsAmount = pricingType !== "" && (AMOUNT_PRICING_TYPES as string[]).includes(pricingType);
  const resp = type ? responseCopy(type) : null;
  const err = state.errors ?? {};

  const previewPrice = useMemo(() => {
    if (!pricingType) return null;
    if (wantsAmount && amount) {
      // Mirror formatPriceDisplay for the live preview (approximate formatting).
      const n = Number.parseFloat(amount.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(n) || n <= 0) return null;
      const money = `$${Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(2)}`;
      const suffix: Record<string, string> = {
        hourly: " / hour",
        daily: " / day",
        project: " / project",
        starting_at: "",
        fixed: "",
      };
      return pricingType === "starting_at" ? `Starting at ${money}` : `${money}${suffix[pricingType] ?? ""}`;
    }
    return pricingDisplay({ pricingType });
  }, [pricingType, amount, wantsAmount]);

  return (
    <form action={formAction} className="mt-8 space-y-10">
      {initial && <input type="hidden" name="offering_id" value={initial.id} />}

      {/* Stage 1 — Type ------------------------------------------------- */}
      <section>
        <p className={stepLabel}>Step 1</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">What are you offering?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {OFFERING_TYPES.map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                type === t
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 hover:border-neutral-400"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="sr-only"
              />
              <span className="block font-medium">{OFFERING_TYPE_LABEL[t]}</span>
              <span className={`mt-1 block text-sm ${type === t ? "text-neutral-300" : "text-neutral-500"}`}>
                {TYPE_BLURB[t]}
              </span>
            </label>
          ))}
        </div>
        {err.type && <p className="mt-2 text-sm text-red-600">{err.type}</p>}
      </section>

      {/* Stage 2 — Name ------------------------------------------------- */}
      <section>
        <p className={stepLabel}>Step 2</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">Give it a name</h2>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name your offering"
          className={`${input} mt-3`}
        />
        <p className="mt-1.5 text-xs text-neutral-400">{NAME_HINTS}</p>
        {err.title && <p className="mt-2 text-sm text-red-600">{err.title}</p>}
      </section>

      {/* Stage 3 — Description ----------------------------------------- */}
      <section>
        <p className={stepLabel}>Step 3</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">Tell people what you offer</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Describe what someone can expect, who it is for, and what makes your offering valuable.
        </p>
        <textarea
          name="short_description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={5}
          className={`${input} mt-3`}
        />
        {err.shortDescription && <p className="mt-2 text-sm text-red-600">{err.shortDescription}</p>}
      </section>

      {/* Stage 4 — Pricing --------------------------------------------- */}
      <section>
        <p className={stepLabel}>Step 4</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">How do you price it?</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Choose the pricing structure that fits the value of your work.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <select
            name="pricing_type"
            value={pricingType}
            onChange={(e) => setPricingType(e.target.value as PricingType | "")}
            className={input}
          >
            <option value="">Choose…</option>
            {PRICING_CHOICES.map((p) => (
              <option key={p} value={p}>
                {PRICING_TYPE_LABEL[p]}
              </option>
            ))}
          </select>
          {wantsAmount && (
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">$</span>
              <input
                name="price_amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="Amount"
                className={input}
              />
            </div>
          )}
        </div>
        {err.pricing && <p className="mt-2 text-sm text-red-600">{err.pricing}</p>}
      </section>

      {/* Stage 5 — How / where (optional) ------------------------------ */}
      <section>
        <p className={stepLabel}>Step 5 · optional</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">How is it available?</h2>
        <input type="hidden" name="location_mode" value={location} />
        <div className="mt-3 flex flex-wrap gap-2">
          {LOCATION_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setLocation(location === m ? "" : m)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                location === m
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
              }`}
            >
              {LOCATION_MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </section>

      {/* Stage 6 — Media (one image) ----------------------------------- */}
      <section>
        <p className={stepLabel}>Step 6 · optional</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">Add something visual</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Add one image that represents this offering. It stays with this offering and won’t change
          your profile gallery.
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

      {/* Stage 7 — Response -------------------------------------------- */}
      {resp && (
        <section>
          <p className={stepLabel}>Step 7</p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-900">How can someone respond?</h2>
          <p className="mt-2 text-sm text-neutral-600">{resp.line}</p>
          {resp.wantsUrl && (
            <div className="mt-3">
              <input
                name="external_url"
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://…"
                className={input}
              />
              <p className="mt-1 text-xs text-neutral-400">{resp.urlLabel}</p>
              {err.externalUrl && <p className="mt-2 text-sm text-red-600">{err.externalUrl}</p>}
            </div>
          )}
        </section>
      )}

      {/* Preview + Save ------------------------------------------------ */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <p className={stepLabel}>Preview</p>
        <div className="mt-3 flex gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-neutral-200">
            {imagePreview && !imageRemoved ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-neutral-300">✦</div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-neutral-900">{title || "Your offering"}</h3>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">
              {type ? OFFERING_TYPE_LABEL[type] : "Type"}
              {previewPrice ? <span className="text-neutral-400"> · {previewPrice}</span> : null}
            </p>
            {desc && <p className="mt-1.5 line-clamp-2 text-sm text-neutral-600">{desc}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="publish"
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "Saving…" : "Publish Offering"}
          </button>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending}
            className="rounded-lg border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-800 disabled:opacity-40"
          >
            Save as draft
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

        {!state.ok && state.message && (
          <p className="mt-4 text-sm text-red-600">{state.message}</p>
        )}
      </section>
    </form>
  );
}
