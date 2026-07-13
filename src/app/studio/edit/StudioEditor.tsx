"use client";

// The interactive studio (employer) profile form. On submit it calls the
// saveStudioProfile server action; React shows "Saving…", then a success/error
// message. Checkbox groups (styles / concentration / certs) submit their checked
// values as arrays. Light onboarding — only the studio name is required.

import { useActionState } from "react";
import { saveStudioProfile, type SaveState } from "./actions";
import {
  STUDENT_COUNT_BANDS,
  STUDENT_COUNT_LABELS,
  PARKING_KINDS,
  PARKING_LABELS,
} from "@/lib/studio/profile";

type Option = { slug: string; label: string };

type Initial = {
  name: string;
  website: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  year_founded: string;
  student_count_band: string;
  staff_count: string;
  room_count: string;
  nearest_transit: string;
  car_required: string; // "", "yes", "no"
  parking: string;
  directions_note: string;
  culture_note: string;
  bio: string;
} | null;

const input =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const label = "block text-xs font-medium text-neutral-600 mb-1";

export default function StudioEditor({
  initial,
  styleOptions,
  concentrationOptions,
  certOptions,
  selectedStyles,
  selectedConcentrations,
  selectedCerts,
}: {
  initial: Initial;
  styleOptions: Option[];
  concentrationOptions: Option[];
  certOptions: Option[];
  selectedStyles: string[];
  selectedConcentrations: string[];
  selectedCerts: string[];
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveStudioProfile, {
    ok: false,
    message: "",
  });

  return (
    <form action={formAction} className="mt-8 space-y-10">
      {/* ---- Identity ---- */}
      <section className="space-y-4">
        <div>
          <label className={label}>Studio name *</label>
          <input name="name" required defaultValue={initial?.name ?? ""} className={input} />
        </div>
        <div>
          <label className={label}>Website</label>
          <input
            name="website"
            type="url"
            placeholder="https://"
            defaultValue={initial?.website ?? ""}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Year founded</label>
          <input
            name="year_founded"
            inputMode="numeric"
            placeholder="e.g. 2005"
            defaultValue={initial?.year_founded ?? ""}
            className={input}
          />
        </div>
      </section>

      {/* ---- Address + map pin ---- */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Location</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Your full address powers sub matching by distance. We&apos;ll place your map pin from
            this automatically — you don&apos;t need coordinates.
          </p>
        </div>
        <div>
          <label className={label}>Street address</label>
          <input name="address_line1" defaultValue={initial?.address_line1 ?? ""} className={input} />
        </div>
        <div>
          <label className={label}>Suite / unit (optional)</label>
          <input name="address_line2" defaultValue={initial?.address_line2 ?? ""} className={input} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>City</label>
            <input name="city" defaultValue={initial?.city ?? ""} className={input} />
          </div>
          <div>
            <label className={label}>State</label>
            <input name="state_province" defaultValue={initial?.state_province ?? ""} className={input} />
          </div>
          <div>
            <label className={label}>ZIP / postal</label>
            <input name="postal_code" defaultValue={initial?.postal_code ?? ""} className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Country</label>
          <input name="country" defaultValue={initial?.country ?? "USA"} className={input} />
        </div>
      </section>

      {/* ---- Getting there / accessibility (the differentiator, §7) ---- */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Getting there</h2>
          <p className="mt-1 text-sm text-neutral-600">
            The practical details a sub needs to decide if they can reach you. No other platform
            surfaces this.
          </p>
        </div>
        <div>
          <label className={label}>Nearest train / bus</label>
          <input
            name="nearest_transit"
            placeholder="e.g. Walnut St (Montclair-Boonton Line); NJT bus 28"
            defaultValue={initial?.nearest_transit ?? ""}
            className={input}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Car required?</label>
            <select name="car_required" defaultValue={initial?.car_required ?? ""} className={input}>
              <option value="">—</option>
              <option value="no">No — reachable by transit</option>
              <option value="yes">Yes — car recommended</option>
            </select>
          </div>
          <div>
            <label className={label}>Parking</label>
            <select name="parking" defaultValue={initial?.parking ?? ""} className={input}>
              <option value="">—</option>
              {PARKING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PARKING_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Directions note (optional)</label>
          <input
            name="directions_note"
            placeholder="e.g. Enter on Label St; studio is on the 2nd floor"
            defaultValue={initial?.directions_note ?? ""}
            className={input}
          />
        </div>
      </section>

      {/* ---- Scale ---- */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Studio scale</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Students</label>
            <select
              name="student_count_band"
              defaultValue={initial?.student_count_band ?? ""}
              className={input}
            >
              <option value="">—</option>
              {STUDENT_COUNT_BANDS.map((b) => (
                <option key={b} value={b}>
                  {STUDENT_COUNT_LABELS[b]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Staff (teachers)</label>
            <input
              name="staff_count"
              inputMode="numeric"
              defaultValue={initial?.staff_count ?? ""}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Studios / rooms</label>
            <input
              name="room_count"
              inputMode="numeric"
              defaultValue={initial?.room_count ?? ""}
              className={input}
            />
          </div>
        </div>
      </section>

      {/* ---- Styles / concentration / certs ---- */}
      <CheckGroup
        title="Styles offered"
        name="styles"
        options={styleOptions}
        selected={selectedStyles}
      />
      <CheckGroup
        title="Concentration / focus"
        name="concentrations"
        options={concentrationOptions}
        selected={selectedConcentrations}
      />
      <CheckGroup
        title="Certifications valued"
        name="certs"
        options={certOptions}
        selected={selectedCerts}
      />

      {/* ---- Culture + about ---- */}
      <section className="space-y-4">
        <div>
          <label className={label}>Studio culture note</label>
          <textarea
            name="culture_note"
            rows={3}
            placeholder="What's it like to teach here?"
            defaultValue={initial?.culture_note ?? ""}
            className={input}
          />
        </div>
        <div>
          <label className={label}>About the studio (optional)</label>
          <textarea name="bio" rows={4} defaultValue={initial?.bio ?? ""} className={input} />
        </div>
      </section>

      {/* ---- Submit ---- */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save studio profile"}
        </button>
        {state.message && (
          <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
        )}
      </div>
    </form>
  );
}

// Chip-style multi-select (same look as the talent editor's).
function CheckGroup({
  title,
  name,
  options,
  selected,
}: {
  title: string;
  name: string;
  options: Option[];
  selected: string[];
}) {
  const sel = new Set(selected);
  return (
    <section>
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.slug}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white"
          >
            <input
              type="checkbox"
              name={name}
              value={o.slug}
              defaultChecked={sel.has(o.slug)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </section>
  );
}
