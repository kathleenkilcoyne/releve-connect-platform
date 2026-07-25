"use client";

// The studio (employer) profile — a STUDIO STORY, not a database form.
//
// Reframed 2026-07-24 (spec: STUDIO-PROFILE-FROM-KATHLEEN.md). The audience is a
// PROFESSIONAL deciding whether to teach here (and the Swing/Flex matching
// engine) — not parents, not SEO. So the story leads: Studio Name → Artistic
// Director → Culture / Unique / Mission → then the logistics (Location, Styles,
// Scale, Getting there, Certifications, and finally the plain details).
//
// TWO gates, everything else optional:
//   • Studio name (required)
//   • Location — CITY + STATE required (no location, no Swing/Flex match). The
//     story fields are warmly prompted but never required; only location gates.
//
// On submit it calls saveStudioProfile; React shows "Saving…", then a message.
// Checkbox groups (styles / concentration / certs) submit checked values as
// arrays.

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
  artistic_director: string; // comma-joined for the single free-text field
  unique_note: string;
  mission: string;
  culture_note: string;
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
  bio: string;
  directions_note: string;
} | null;

const input =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const label = "block text-xs font-medium text-neutral-600 mb-1";
const help = "mt-1 text-xs leading-relaxed text-neutral-500";

/** The gentle, non-interactive example chips under "What makes your studio unique?" */
const UNIQUE_EXAMPLES = [
  "Conservatory training",
  "College preparation",
  "Recreational dancers welcome",
  "Strong acrobatics program",
  "Performance company",
];

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
      {/* ── 1 · Studio name ─────────────────────────────────────────────── */}
      <section className="space-y-1">
        <label className={label}>Studio name *</label>
        <input name="name" required defaultValue={initial?.name ?? ""} className={input} />
      </section>

      {/* ── 2 · Artistic Director ───────────────────────────────────────── */}
      <section className="space-y-1">
        <label className={label}>Artistic Director</label>
        <input
          name="artistic_director"
          placeholder="e.g., Roberta Mathes"
          defaultValue={initial?.artistic_director ?? ""}
          className={input}
        />
        <p className={help}>
          The person behind the studio — teachers often know a name before they know a studio. Have
          co-directors? Separate them with commas.
        </p>
      </section>

      {/* ── 3 · The story: culture · unique · mission (all optional) ─────── */}
      <section className="space-y-6">
        <div>
          <label className={label}>What&apos;s it like to teach here?</label>
          <textarea
            name="culture_note"
            rows={3}
            placeholder="We value kindness, preparation, and professionalism — and dancers who lift each other up. Our faculty collaborate; they don't compete."
            defaultValue={initial?.culture_note ?? ""}
            className={input}
          />
          <p className={help}>
            A few honest words about your culture — what you value, how your dancers treat one
            another. This tells a teacher more than any statistic.
          </p>
        </div>

        <div>
          <label className={label}>What makes your studio unique?</label>
          <textarea
            name="unique_note"
            rows={3}
            placeholder="Conservatory-level training with a heart for college prep — and a place where recreational dancers are valued as much as our pre-professional company."
            defaultValue={initial?.unique_note ?? ""}
            className={input}
          />
          <p className={help}>
            One or two sentences. What would a dancer or teacher feel here that they wouldn&apos;t
            feel anywhere else?
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {UNIQUE_EXAMPLES.map((ex) => (
              <span
                key={ex}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-500"
              >
                {ex}
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>Your studio in one line.</label>
          <input
            name="mission"
            placeholder="Training the whole artist — technique, character, and courage."
            defaultValue={initial?.mission ?? ""}
            className={input}
          />
        </div>
      </section>

      {/* ── 4 · Location (REQUIRED: city + state) ───────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Location</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Required. Your city and state power Swing/Flex matching by distance — no location, no
            match. Your full address lets us place your map pin automatically; you don&apos;t need
            coordinates.
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
            <label className={label}>City *</label>
            <input
              name="city"
              required
              defaultValue={initial?.city ?? ""}
              className={input}
            />
          </div>
          <div>
            <label className={label}>State *</label>
            <input
              name="state_province"
              required
              defaultValue={initial?.state_province ?? ""}
              className={input}
            />
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

      {/* ── 5 · Styles / concentration ──────────────────────────────────── */}
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

      {/* ── 6 · Scale ───────────────────────────────────────────────────── */}
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

      {/* ── 7 · Getting there (transportation) ──────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Getting there</h2>
          <p className="mt-1 text-sm text-neutral-600">
            The practical details a sub needs to decide if they can reach you.
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

      {/* ── 8 · Certifications ──────────────────────────────────────────── */}
      <CheckGroup
        title="Certifications valued"
        name="certs"
        options={certOptions}
        selected={selectedCerts}
      />

      {/* ── 9 · Plain details (logistics, last) ─────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Studio details</h2>
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
        <div>
          <label className={label}>Anything else about the studio (optional)</label>
          <textarea name="bio" rows={4} defaultValue={initial?.bio ?? ""} className={input} />
        </div>
      </section>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
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
