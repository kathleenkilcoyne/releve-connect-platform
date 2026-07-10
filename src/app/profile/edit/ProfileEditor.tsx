"use client";

// The interactive profile form. On submit it calls the saveProfile server
// action; React shows "Saving…", then a success or error message. Checkbox
// groups (styles / levels / focus) submit their checked values as arrays.

import { useActionState, useState } from "react";
import { saveProfile, type SaveState } from "./actions";

type Option = { slug: string; label: string };

type Initial = {
  display_name: string;
  public_slug: string;
  primary_role: string;
  city: string;
  state_province: string;
  country: string;
  bio: string;
  years_experience: string;
  credentials: string;
  age_range: string;
  headshot_url: string;
  social_links: Record<string, string>;
  profile_status: string;
} | null;

const YEARS = ["0-2", "3-5", "6-10", "11-20", "20+"];
const AGES = ["18-24", "25-34", "35-50", "50+"];

const input =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const label = "block text-xs font-medium text-neutral-600 mb-1";

export default function ProfileEditor({
  initial,
  styleOptions,
  levelOptions,
  focusOptions,
  roleOptions,
  selectedStyles,
  selectedLevels,
  selectedFocus,
}: {
  initial: Initial;
  styleOptions: Option[];
  levelOptions: Option[];
  focusOptions: Option[];
  roleOptions: Option[];
  selectedStyles: string[];
  selectedLevels: string[];
  selectedFocus: string[];
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveProfile, {
    ok: false,
    message: "",
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial?.headshot_url || null);

  // Live bio counter (a gauge, not a hard limit — you can write more if you want).
  const [bio, setBio] = useState(initial?.bio ?? "");
  const bioWords = bio.trim() ? bio.trim().split(/\s+/).length : 0;
  const bioLong = bioWords > 350;

  const social = initial?.social_links ?? {};

  return (
    <form action={formAction} className="mt-8 space-y-10">
      {/* Photo ---------------------------------------------------------- */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">Photo</h2>
        <div className="mt-3 flex items-center gap-5">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Your headshot" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-neutral-300">
                ☺
              </div>
            )}
          </div>
          <label className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
            {photoPreview ? "Change photo" : "Upload photo"}
            <input
              type="file"
              name="headshot"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPhotoPreview(URL.createObjectURL(f));
              }}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-neutral-400">JPG, PNG, or WebP · up to 5MB.</p>
      </section>

      {/* Basics --------------------------------------------------------- */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Name *</label>
          <input name="display_name" defaultValue={initial?.display_name} required className={input} />
        </div>

        <div className="sm:col-span-2">
          <label className={label}>Profile handle (your web address)</label>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-neutral-400">/talent/</span>
            <input
              name="public_slug"
              defaultValue={initial?.public_slug}
              placeholder="your-name"
              className={input}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Leave blank and we&apos;ll make one from your name. Letters, numbers, and dashes.
          </p>
        </div>

        <div>
          <label className={label}>Primary role</label>
          <select name="primary_role" defaultValue={initial?.primary_role} className={input}>
            <option value="">Choose…</option>
            {roleOptions.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Years of experience</label>
          <select name="years_experience" defaultValue={initial?.years_experience} className={input}>
            <option value="">Choose…</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y} years
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label}>City</label>
          <input name="city" defaultValue={initial?.city} className={input} />
        </div>
        <div>
          <label className={label}>State / Province</label>
          <input name="state_province" defaultValue={initial?.state_province} className={input} />
        </div>
        <div>
          <label className={label}>Country</label>
          <input name="country" defaultValue={initial?.country} className={input} />
        </div>
        <div>
          <label className={label}>Age range</label>
          <select name="age_range" defaultValue={initial?.age_range} className={input}>
            <option value="">Prefer not to say</option>
            {AGES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Bio ------------------------------------------------------------ */}
      <section>
        <label className={label}>Bio — your story</label>
        <textarea
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          placeholder="Who you are, how you got here, what you're known for…"
          className={input}
        />
        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
          <span className="text-neutral-400">
            Keep it to the highlights — a few short paragraphs (aim for ~100–300 words). Save the
            full history for your CV / résumé.
          </span>
          <span className={`shrink-0 tabular-nums ${bioLong ? "text-amber-600" : "text-neutral-400"}`}>
            {bioWords} {bioWords === 1 ? "word" : "words"}
            {bioLong ? " · a bit long" : ""}
          </span>
        </div>
      </section>

      {/* Styles --------------------------------------------------------- */}
      <CheckGroup
        title="Dance styles"
        name="styles"
        options={styleOptions}
        selected={selectedStyles}
      />
      {/* Levels --------------------------------------------------------- */}
      <CheckGroup
        title="Levels you teach / dance"
        name="levels"
        options={levelOptions}
        selected={selectedLevels}
      />
      {/* Focus areas ---------------------------------------------------- */}
      <CheckGroup
        title="Focus areas"
        name="focus"
        options={focusOptions}
        selected={selectedFocus}
      />

      {/* Credentials ---------------------------------------------------- */}
      <section>
        <label className={label}>Credentials & training</label>
        <textarea
          name="credentials"
          defaultValue={initial?.credentials}
          rows={3}
          placeholder="Degrees, certifications, notable training or companies…"
          className={input}
        />
      </section>

      {/* Links ---------------------------------------------------------- */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="text-lg font-semibold text-neutral-900">Links</h2>
        </div>
        <div>
          <label className={label}>Website</label>
          <input name="website" defaultValue={social.website} placeholder="https://…" className={input} />
        </div>
        <div>
          <label className={label}>Instagram</label>
          <input name="instagram" defaultValue={social.instagram} placeholder="https://instagram.com/…" className={input} />
        </div>
        <div>
          <label className={label}>Vimeo</label>
          <input name="vimeo" defaultValue={social.vimeo} placeholder="https://vimeo.com/…" className={input} />
        </div>
        <div>
          <label className={label}>YouTube</label>
          <input name="youtube" defaultValue={social.youtube} placeholder="https://youtube.com/…" className={input} />
        </div>
      </section>

      {/* Publish + save ------------------------------------------------- */}
      <section className="rounded-xl border border-neutral-200 p-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="publish"
            defaultChecked={initial?.profile_status === "published"}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium text-neutral-800">
            Publish — make my page visible to everyone
          </span>
        </label>
        <p className="mt-1 pl-7 text-xs text-neutral-400">
          Leave unchecked to keep it a private draft while you work on it.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save profile"}
          </button>
          {state.ok && state.slug && (
            <a
              href={`/talent/${state.slug}`}
              target="_blank"
              className="text-sm font-medium text-neutral-700 underline"
            >
              View my public page ↗
            </a>
          )}
        </div>

        {state.message && (
          <p className={`mt-4 text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>
            {state.message}
          </p>
        )}
      </section>
    </form>
  );
}

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
