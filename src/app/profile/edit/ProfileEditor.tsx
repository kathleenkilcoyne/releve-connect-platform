"use client";

// The interactive profile form. On submit it calls the saveProfile server
// action; React shows "Saving…", then a success or error message. Checkbox
// groups (styles / levels / focus) submit their checked values as arrays.

import { useActionState, useState } from "react";
import { saveProfile, type SaveState } from "./actions";

type Option = { slug: string; label: string };
type AvailOption = Option & { kind: "general" | "currently" };

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
  teaching_reel_url: string;
  gallery_urls: string[];
  resume_url: string;
  social_links: Record<string, string>;
  profile_status: string;
  teaching_at: string;
  touring_with: string;
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
  certOptions,
  availOptions,
  selectedStyles,
  selectedLevels,
  selectedFocus,
  selectedCerts,
  selectedAvailability,
}: {
  initial: Initial;
  styleOptions: Option[];
  levelOptions: Option[];
  focusOptions: Option[];
  roleOptions: Option[];
  certOptions: Option[];
  availOptions: AvailOption[];
  selectedStyles: string[];
  selectedLevels: string[];
  selectedFocus: string[];
  selectedCerts: string[];
  selectedAvailability: string[];
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

  // Photo gallery (up to 8). `kept` = existing URLs the member keeps; `newPreviews`
  // = object URLs for freshly-picked files (the file input carries the real files).
  const [kept, setKept] = useState<string[]>(initial?.gallery_urls ?? []);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const galleryCount = kept.length + newPreviews.length;

  // Résumé / CV state: whether a file exists, and whether the member cleared it.
  const [resumeUrl] = useState<string>(initial?.resume_url ?? "");
  const [resumeRemoved, setResumeRemoved] = useState(false);
  const [resumePicked, setResumePicked] = useState<string>("");

  const social = initial?.social_links ?? {};

  // Availability comes from one table in two flavours: when you can work, and
  // what you're taking on right now. Rendered as two groups, saved as one facet.
  const generalAvail = availOptions.filter((a) => a.kind === "general");
  const currentlyAvail = availOptions.filter((a) => a.kind === "currently");

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

      {/* Featured Video — the highest-value item, above the fold (spec §6).
          Renamed from "Teaching Reel" on 2026-07-24: not everyone on the Roster
          teaches, and a choreographer or working dancer shouldn't have to read
          past a label that isn't for them. The DB column keeps its old name. */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">Featured Video</h2>
        <p className="mt-1 text-sm text-neutral-500">
          A teaching clip, choreography, class footage, or performance. This plays at the top of
          your profile — paste a Vimeo or YouTube link. A{" "}
          <span className="font-medium">vertical</span> clip (like a Reel) fills the hero best.
        </p>
        <input
          name="teaching_reel_url"
          type="url"
          defaultValue={initial?.teaching_reel_url}
          placeholder="https://vimeo.com/…  or  https://youtube.com/watch?v=…"
          className={`${input} mt-3`}
        />
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
            <span className="text-neutral-400">releveconnect.com/</span>
            <input
              name="public_slug"
              defaultValue={initial?.public_slug}
              placeholder="your-name"
              className={input}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            This is your shareable link — put it in your Instagram bio. Leave blank and we&apos;ll
            make one from your name. Letters, numbers, and dashes.
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
        <p className="mb-2 text-sm text-neutral-500">
          Tell us what makes you unique. Share your background, experience, and what dancers can
          expect working with you.
        </p>
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
      {/* Teaching levels — the five seeded rungs, multi-select. Check only the
          levels you'll teach (no age-group filter; age is demographic-only). */}
      <CheckGroup
        title="Teaching levels"
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
      {/* Certifications — structured, searchable tags (spec §6). Self-reported,
          searchable, NOT endorsed (§13) — studios can filter the Roster by these. */}
      {certOptions.length > 0 && (
        <div>
          <CheckGroup
            title="Certifications"
            name="certs"
            options={certOptions}
            selected={selectedCerts}
          />
          <p className="mt-2 text-xs text-neutral-400">
            Self-reported and searchable — check the certifications you hold. Studios can filter the
            Roster by these.
          </p>
        </div>
      )}

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

      {/* Photo gallery (up to 8, shown as a grid — spec §6) ------------- */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">Photo gallery</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Up to 8 photos, shown as a grid on your profile.{" "}
          <span className="tabular-nums">{galleryCount}/8</span> used.
        </p>
        {galleryCount > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {kept.map((url) => (
              <div
                key={url}
                className="relative aspect-square overflow-hidden rounded-lg ring-1 ring-neutral-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <input type="hidden" name="gallery_existing" value={url} />
                <button
                  type="button"
                  onClick={() => setKept(kept.filter((u) => u !== url))}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80"
                >
                  ×
                </button>
              </div>
            ))}
            {newPreviews.map((url, i) => (
              <div
                key={i}
                className="relative aspect-square overflow-hidden rounded-lg ring-1 ring-neutral-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-neutral-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  new
                </span>
              </div>
            ))}
          </div>
        )}
        <label className="mt-3 inline-block cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
          {galleryCount > 0 ? "Choose photos to add" : "Add photos"}
          <input
            type="file"
            name="gallery_new"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setNewPreviews(files.map((f) => URL.createObjectURL(f)));
            }}
          />
        </label>
        <p className="mt-2 text-xs text-neutral-400">
          Pick all the photos you want to add at once. Newest selection replaces the last.
        </p>
      </section>

      {/* Résumé / CV (PDF) ---------------------------------------------- */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-900">Résumé / CV</h2>
        <p className="mt-1 text-sm text-neutral-500">
          A PDF visitors can download from your profile.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {resumeUrl && !resumeRemoved && !resumePicked && (
            <a
              href={resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-neutral-700 underline"
            >
              Current résumé ↗
            </a>
          )}
          <label className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
            {resumeUrl && !resumeRemoved ? "Replace PDF" : "Upload PDF"}
            <input
              type="file"
              name="resume"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setResumePicked(f ? f.name : "");
                if (f) setResumeRemoved(false);
              }}
            />
          </label>
          {resumePicked && (
            <span className="text-xs text-neutral-500">Selected: {resumePicked}</span>
          )}
        </div>
        {resumeUrl && !resumePicked && (
          <label className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
            <input
              type="checkbox"
              name="resume_remove"
              checked={resumeRemoved}
              onChange={(e) => setResumeRemoved(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Remove my current résumé
          </label>
        )}
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

      {/* Availability (revisions 2026-07-24 §9) --------------------------
          Every checkbox here is a structured tag, not prose, because these are
          exactly the things a studio searches on: "available weekends",
          "accepting commissions". The two free-text lines are the exceptions —
          where you teach is a fact about you, not a facet anyone filters by. */}
      <section className="rounded-xl border border-neutral-200 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Availability</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Optional — but this is how studios find you. Each of these is a search filter on the
          Roster.
        </p>

        <div className="mt-5">
          <AvailChipRow
            title="General availability"
            name="availability"
            options={generalAvail}
            selected={selectedAvailability}
          />
        </div>

        <div className="mt-7 border-t border-neutral-200 pt-6">
          <p className="text-sm font-medium text-neutral-800">Currently</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Teaching at</label>
              <input
                name="teaching_at"
                defaultValue={initial?.teaching_at}
                placeholder="e.g. Broadway Dance Center"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Touring with</label>
              <input
                name="touring_with"
                defaultValue={initial?.touring_with}
                placeholder="e.g. Hamilton — National Tour"
                className={input}
              />
            </div>
          </div>

          <div className="mt-5">
            <AvailChipRow
              title="I'm currently accepting"
              name="availability"
              options={currentlyAvail}
              selected={selectedAvailability}
            />
          </div>
        </div>
      </section>

      {/* The Swing (revisions 2026-07-24 §7) -----------------------------
          The opt-in form used to live here — toggle, home base, travel radius,
          styles/levels you'd sub. It's gone, replaced by one honest line.
          A teacher could opt in, but the studio side (find / match / book) is
          not built, so nobody could be booked; The Swing is the paid studio
          product and is deliberately not being given away during the free
          period (DECISIONS.md 2026-07-22). Asking for availability that nothing
          consumes is a chore with no payoff. Anyone who already filled it in
          keeps their answers — the swing_availability rows are untouched. */}
      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">The Swing</h2>
        <p className="mt-1 text-sm text-neutral-600">
          You will receive opportunities when Swing launches.
        </p>
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
            Ready to Join the Relevé Roster
          </span>
        </label>
        <p className="mt-1 pl-7 text-xs text-neutral-500">
          Turn this on when you&apos;re ready for studios and fellow professionals to discover you.
          Off means your profile stays a private draft.
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
              href={`/${state.slug}`}
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

// A lighter chip group (smaller heading) for fields nested inside a section —
// used by the Availability groups, which sit under one shared heading.
function AvailChipRow({
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
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">{title}</p>
      <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
