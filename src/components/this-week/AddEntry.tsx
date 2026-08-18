"use client";

// "Add to my week" — the professional's write path into This Week.
//
// ── The model this expresses (ratified 2026-08-18) ──
//   My Services  = what I offer      → set once, elsewhere
//   Availability = where/how I work  → set once, elsewhere
//   This Week    = WHEN I'm available for the services I already offer
//
// So the service picker below is a list of the member's OWN My Services, read
// from the source of truth. It is not a text field and never asks anyone to
// name a service twice — that is the whole point of the sequence this closes.
//
// ── The publish control ──
// Publishing is an explicit, separate act, never a side effect of adding an
// entry. The checkbox appears ONLY on an availability entry, because that is the
// only category that may ever be published: a studio needs to know when someone
// is free, and has no business knowing that the reason they are busy is an
// audition or a hospital appointment. The rule is enforced in
// `lib/this-week/entry.ts`, not here — this UI simply doesn't offer what the
// server would refuse.

import { useState } from "react";
import { createEntry } from "@/app/this-week/actions";
import { canPublish, PERSONAL_EVENT_CATEGORIES } from "@/lib/this-week/entry";
import { CATEGORY_META } from "@/lib/this-week/categories";

export type MyService = { id: string; title: string };

const CATEGORY_HELP: Record<string, string> = {
  availability: "Free for work — the only kind you can make public.",
};

export function AddEntry({
  myServices,
  timezone = "America/New_York",
}: {
  myServices: MyService[];
  timezone?: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("availability");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);

  const publishable = canPublish(category);
  const canOfferPublish = publishable && myServices.length > 0;

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setErrors({});
    setDone(null);

    const result = await createEntry({
      category,
      title: String(formData.get("title") ?? ""),
      date: String(formData.get("date") ?? ""),
      startTime: String(formData.get("startTime") ?? ""),
      endTime: String(formData.get("endTime") ?? ""),
      timezone,
      location: String(formData.get("location") ?? ""),
      note: String(formData.get("note") ?? ""),
      publish: canOfferPublish && publish,
      offeringId: String(formData.get("offeringId") ?? "") || null,
    });

    setBusy(false);
    if (!result.ok) {
      setErrors(Object.fromEntries(result.errors.map((e) => [e.field, e.message])));
      return;
    }
    setDone(
      result.published
        ? "Added, and your window is public."
        : "Added to your week — private.",
    );
    setPublish(false);
  }

  const label = "block text-xs font-medium uppercase tracking-[0.12em] text-[var(--rc-muted)]";
  const field =
    "mt-1.5 w-full rounded-lg border border-[var(--rc-hairline)] bg-white px-3 py-2 text-sm text-[var(--rc-ink)] focus:border-[var(--rc-gold)] focus:outline-none";
  const err = (f: string) =>
    errors[f] ? <p className="mt-1 text-xs text-[#8f2f2f]">{errors[f]}</p> : null;

  if (!open) {
    // Findable, not dominant (founder direction, 2026-08-18): a quiet text
    // link rather than a bordered button sitting in its own row of chrome. The
    // form itself, once opened, keeps its full card treatment below — only
    // this collapsed trigger changed.
    return (
      <div className="mt-2">
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-[var(--rc-ink)] underline underline-offset-2 decoration-[var(--rc-hairline)] transition-colors hover:text-[var(--rc-gold)] hover:decoration-[var(--rc-gold)]"
        >
          + Add to my week
        </button>
        {done && <p className="mt-2 text-sm text-[var(--rc-muted)]">{done}</p>}
      </div>
    );
  }

  return (
    <form
      action={onSubmit}
      className="mt-7 rounded-xl border border-[var(--rc-hairline)] bg-[var(--rc-ivory)] p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="rc-serif text-lg font-semibold text-[var(--rc-ink)]">Add to my week</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--rc-muted)] underline"
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label} htmlFor="tw-category">
            What kind of entry
          </label>
          <select
            id="tw-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (!canPublish(e.target.value)) setPublish(false);
            }}
            className={field}
          >
            {PERSONAL_EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c]?.label ?? c}
              </option>
            ))}
          </select>
          {CATEGORY_HELP[category] && (
            <p className="mt-1.5 text-xs text-[var(--rc-muted)]">{CATEGORY_HELP[category]}</p>
          )}
          {err("category")}
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="tw-title">
            Name
          </label>
          <input id="tw-title" name="title" className={field} placeholder="e.g. Free for guest teaching" />
          {err("title")}
        </div>

        <div>
          <label className={label} htmlFor="tw-date">Date</label>
          <input id="tw-date" name="date" type="date" className={field} />
          {err("date")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="tw-start">Start</label>
            <input id="tw-start" name="startTime" type="time" className={field} />
            {err("startTime")}
          </div>
          <div>
            <label className={label} htmlFor="tw-end">End</label>
            <input id="tw-end" name="endTime" type="time" className={field} />
            {err("endTime")}
          </div>
        </div>

        <div>
          <label className={label} htmlFor="tw-location">Location (optional)</label>
          <input id="tw-location" name="location" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="tw-note">Note (optional)</label>
          <input id="tw-note" name="note" className={field} placeholder="Only you can see this" />
        </div>
      </div>

      {/* ── Publishing. Explicit, separate, and availability-only. ── */}
      {publishable && (
        <div className="mt-5 border-t border-[var(--rc-hairline)] pt-4">
          {myServices.length === 0 ? (
            <p className="text-sm text-[var(--rc-muted)]">
              Add a service in <strong className="text-[var(--rc-ink)]">My Services</strong> to be
              able to make a window public.
            </p>
          ) : (
            <>
              <label className="flex items-start gap-2.5 text-sm text-[var(--rc-ink)]">
                <input
                  type="checkbox"
                  checked={publish}
                  onChange={(e) => setPublish(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Make this window public so studios can find me.
                  <span className="mt-0.5 block text-xs text-[var(--rc-muted)]">
                    Only the hours and the service are shared. Never the name, the note, or
                    anything else on your calendar.
                  </span>
                </span>
              </label>

              {publish && (
                <div className="mt-3.5">
                  <label className={label} htmlFor="tw-offering">Available for</label>
                  <select id="tw-offering" name="offeringId" className={field} defaultValue="">
                    <option value="" disabled>
                      Choose one of your services…
                    </option>
                    {myServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                  {err("offeringId")}
                </div>
              )}
            </>
          )}
          {err("publish")}
        </div>
      )}

      {err("form")}

      <div className="mt-5 flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[var(--rc-ink)] px-5 py-2.5 text-sm font-medium text-[var(--rc-cream)] disabled:opacity-40"
        >
          {busy ? "Saving…" : publish ? "Add and publish" : "Add to my week"}
        </button>
        {done && <p className="text-sm text-[var(--rc-muted)]">{done}</p>}
      </div>
    </form>
  );
}
