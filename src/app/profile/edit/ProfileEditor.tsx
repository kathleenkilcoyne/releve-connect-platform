"use client";

// The interactive profile form. On submit it calls the saveProfile server
// action; React shows "Saving…", then a success or error message. Checkbox
// groups (certifications) submit their checked values as arrays. Roles /
// Dance styles / Teaching levels / Focus areas use EditableTagGroup instead
// (see below) — taxonomy quick-select PLUS free-text custom entries, both
// submitted the same way, as repeated hidden inputs under one field name.

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveProfile, type SaveState } from "./actions";
import { VISIBILITY_COPY } from "@/lib/profile/visibility";
import { shouldShowOnboardingOfferingsCta } from "@/lib/offerings";

type Option = { slug: string; label: string };

type Initial = {
  display_name: string;
  public_slug: string;
  city: string;
  state_province: string;
  country: string;
  bio: string;
  years_experience: string;
  credentials: string;
  headshot_url: string;
  teaching_reel_url: string;
  gallery_urls: string[];
  resume_url: string;
  social_links: Record<string, string>;
  profile_status: string;
  visibility: string;
  teaching_at: string;
  touring_with: string;
  swing_available: boolean;
} | null;

const YEARS = ["0-2", "3-5", "6-10", "11-20", "20+"];

const input =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const label = "block text-xs font-medium text-neutral-600 mb-1";

/**
 * A tag group that supports BOTH quick-select from a controlled taxonomy AND
 * free-text custom entries (redesign 2026-08-20, approved via scratch preview
 * over several review rounds). Selected items — taxonomy or custom — render
 * as removable chips and are submitted as repeated hidden inputs under one
 * field name (matching the existing gallery_existing pattern), so
 * `formData.getAll(name)` on the server sees exactly what's shown here.
 *
 * The server (actions.ts) is what decides which submitted values are
 * taxonomy matches (written to the join table) vs. custom text (written to
 * the matching `custom_*` array column) — this component doesn't need to
 * know the difference, it just tracks strings.
 */
function EditableTagGroup({
  title,
  name,
  options,
  selected,
  onChange,
  addLabel,
  addPlaceholder,
  helperText,
}: {
  title: string;
  name: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  addPlaceholder: string;
  helperText?: string;
}) {
  const [customInput, setCustomInput] = useState("");
  const labelFor = (value: string) => options.find((o) => o.slug === value)?.label ?? value;
  const suggestions = options.filter((o) => !selected.includes(o.slug));

  function add(value: string) {
    const v = value.trim();
    if (!v || selected.includes(v)) return;
    onChange([...selected, v]);
  }
  function remove(value: string) {
    onChange(selected.filter((s) => s !== value));
  }
  function addCustom() {
    add(customInput);
    setCustomInput("");
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      {helperText && <p className="mt-1 text-sm text-neutral-500">{helperText}</p>}

      {selected.map((s) => (
        <input key={s} type="hidden" name={name} value={s} />
      ))}

      {/* Selected — removable chips, taxonomy and custom look identical */}
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
            >
              {labelFor(s)}
              <button
                type="button"
                onClick={() => remove(s)}
                aria-label={`Remove ${labelFor(s)}`}
                className="text-neutral-300 hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Quick-select suggestions from the controlled taxonomy */}
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((o) => (
            <button
              key={o.slug}
              type="button"
              onClick={() => add(o.slug)}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500"
            >
              + {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Custom entry */}
      <div className="mt-3 flex gap-2">
        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={addPlaceholder}
          className={`${input} max-w-xs`}
        />
        <button
          type="button"
          onClick={addCustom}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          {addLabel}
        </button>
      </div>
    </section>
  );
}

export default function ProfileEditor({
  initial,
  styleOptions,
  levelOptions,
  focusOptions,
  roleOptions,
  certOptions,
  expOptions,
  selectedStyles,
  selectedLevels,
  selectedFocus,
  selectedCerts,
  selectedRoles,
  selectedExperience,
  customRoles,
  customStyles,
  customLevels,
  customFocus,
}: {
  initial: Initial;
  styleOptions: Option[];
  levelOptions: Option[];
  focusOptions: Option[];
  roleOptions: Option[];
  certOptions: Option[];
  expOptions: Option[];
  selectedStyles: string[];
  selectedLevels: string[];
  selectedFocus: string[];
  selectedCerts: string[];
  selectedRoles: string[];
  selectedExperience: string[];
  customRoles: string[];
  customStyles: string[];
  customLevels: string[];
  customFocus: string[];
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveProfile, {
    ok: false,
    message: "",
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial?.headshot_url || null);

  // Live bio counter (a gauge, not a hard limit — you can write more if you want).
  const [bio, setBio] = useState(initial?.bio ?? "");
  const bioWords = bio.trim() ? bio.trim().split(/\s+/).length : 0;
  const bioLong = bioWords > 125;

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

  // Swing ON/OFF — live-updates the card's visual treatment as it's toggled,
  // not just after save (redesign 2026-08-19 §8).
  const [swingOn, setSwingOn] = useState(initial?.swing_available ?? false);

  // Roles / Styles / Levels / Focus — each combines its taxonomy selections
  // with any custom (free-text) entries into one list, since EditableTagGroup
  // treats them identically (redesign 2026-08-20).
  const [roles, setRoles] = useState<string[]>([...selectedRoles, ...customRoles]);
  const [styles, setStyles] = useState<string[]>([...selectedStyles, ...customStyles]);
  const [levels, setLevels] = useState<string[]>([...selectedLevels, ...customLevels]);
  const [focus, setFocus] = useState<string[]>([...selectedFocus, ...customFocus]);

  // Role-aware sections (redesign 2026-08-20). Teaching Levels and Swing only
  // appear when "Teacher / Educator" (slug "teacher") is one of the selected
  // roles — Choreographer, Performer, Adjudicator, Coach, and Director don't
  // force either just for holding a professional profile. Dance Styles and
  // Focus Areas stay universal. This is a UNION, not per-role duplication:
  // each section renders at most once no matter how many roles are checked.
  // Hiding a section never clears its state — `levels` and `swingOn` live in
  // this same component, untouched by conditional rendering, so unchecking
  // Teacher and rechecking it later restores exactly what was there before.
  const isTeacher = roles.includes("teacher");

  return (
    <form action={formAction} className="mt-8 space-y-10">
      {/* Identity — portrait + Bio as one block (redesign 2026-08-19 §1).
          Desktop: portrait LEFT, Bio RIGHT, top-aligned. Mobile: portrait
          centered, Bio directly underneath, then the rest of the form. */}
      <section className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        {/* Portrait + Change Photo control — sized ~33% larger than before on
            desktop (was w-36/144px, now w-48/192px), same 3:4 portrait frame,
            never circular. */}
        <div className="w-40 shrink-0 sm:w-48">
          <div className="overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-neutral-200">
            <div className="aspect-[3/4]">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt="Your headshot"
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl text-neutral-300">
                  ☺
                </div>
              )}
            </div>
          </div>
          <label className="mt-3 block cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-center text-sm font-medium text-neutral-800 hover:bg-neutral-50">
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
          <p className="mt-2 text-center text-xs text-neutral-400 sm:text-left">
            JPG, PNG, or WebP · up to 5MB.
          </p>
        </div>

        {/* Bio — your story. */}
        <div className="w-full">
          <label className={label}>Bio — your story</label>
          <p className="mb-2 text-sm text-neutral-500">
            Tell us what makes you unique. Share your background, experience, and what dancers can
            expect working with you.
          </p>
          <textarea
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={8}
            placeholder="Who you are, how you got here, what you're known for…"
            className={input}
          />
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
            <span className="text-neutral-400">
              Keep it to the highlights — about 75–100 words. Save your full history for your CV /
              résumé.
            </span>
            <span className={`shrink-0 tabular-nums ${bioLong ? "text-amber-600" : "text-neutral-400"}`}>
              {bioWords} {bioWords === 1 ? "word" : "words"}
              {bioLong ? " · a bit long" : ""}
            </span>
          </div>
        </div>
      </section>

      {/* Professional roles — multi-select + custom entry (redesign
          2026-08-20). Replaces the old single "Primary role" select, which
          couldn't represent a multi-hyphenate professional. */}
      <EditableTagGroup
        title="Professional roles — choose all that apply"
        name="roles"
        options={roleOptions}
        selected={roles}
        onChange={setRoles}
        addLabel="Add another role"
        addPlaceholder="Don't see your role? Type your own…"
      />
      <p className="-mt-6 text-xs text-neutral-400">
        Teaching Levels and Swing appear below only when Teacher / Educator is selected.
      </p>

      {/* Name / handle / location / years (redesign 2026-08-20: reordered
          right after Roles; Age Range removed — this is a professional
          identity, not a casting application. The age_range column is NOT
          dropped from the database; it simply isn't read, written, or shown
          by this form any more.) */}
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
      </section>

      {/* Featured Video — the highest-value item, above the fold (spec §6). */}
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

      {/* The Swing — moved up front as a core professional status, role-gated
          on Teacher / Educator (redesign 2026-08-19 §8, 2026-08-20 role-aware
          pass). Wired to the real swing_availability.is_available column.
          This simplified toggle does not collect home_location / travel_radius
          / notes — the save action reads and carries forward whatever values
          already exist there so real historical data is never nulled out by a
          save this form doesn't ask about.

          Studio-side dispatch (find / match / book) still isn't built, so
          this deliberately does NOT promise an immediate match — it states
          eligibility, not a live marketplace. Swing eligibility/permission
          rules and pay ($50/hr, platform-enforced) are entirely unchanged;
          this is presentation and the save path only. */}
      {isTeacher && (
        <section
          className={`rounded-xl border p-5 transition-colors ${
            swingOn
              ? "border-neutral-900 bg-neutral-900 ring-1 ring-amber-400/60"
              : "border-neutral-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className={`text-lg font-semibold ${swingOn ? "text-amber-400" : "text-neutral-900"}`}>
                The Swing
              </h2>
              {swingOn ? (
                <>
                  <p className="mt-1 text-sm font-medium text-white">Swing is ON</p>
                  <p className="mt-1 text-sm text-neutral-300">
                    You&apos;re available to receive Swing teaching opportunities.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm font-medium text-neutral-700">Swing is OFF</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Turn it on when you want to receive eligible Swing teaching opportunities.
                  </p>
                </>
              )}
            </div>
            <label className="relative inline-flex shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                name="swing_available"
                checked={swingOn}
                onChange={(e) => setSwingOn(e.target.checked)}
                className="sr-only"
              />
              <div className={`h-7 w-12 rounded-full transition-colors ${swingOn ? "bg-amber-400" : "bg-neutral-300"}`}>
                <div
                  className={`mt-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    swingOn ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>
          </div>
        </section>
      )}

      {/* Dance styles / Teaching levels / Focus areas — quick-select + custom
          entry (redesign 2026-08-20). Teaching levels is role-gated the same
          way Swing is; Dance styles and Focus areas are universal. */}
      <EditableTagGroup
        title="Dance styles"
        name="styles"
        options={styleOptions}
        selected={styles}
        onChange={setStyles}
        addLabel="Add"
        addPlaceholder="Add your own style…"
      />
      {isTeacher && (
        <EditableTagGroup
          title="Teaching levels"
          name="levels"
          options={levelOptions}
          selected={levels}
          onChange={setLevels}
          addLabel="Add"
          addPlaceholder="Add your own level…"
        />
      )}
      <EditableTagGroup
        title="Focus areas"
        name="focus"
        options={focusOptions}
        selected={focus}
        onChange={setFocus}
        addLabel="Add"
        addPlaceholder="Add your own focus…"
      />

      {/* Certifications — structured, searchable tags (spec §6). Self-reported,
          searchable, NOT endorsed (§13) — studios can filter the Roster by
          these. Unchanged: closed list, no custom entry (not requested). */}
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

      {/* Professional experience — Phase 1 rebuild (founder-approved
          2026-08-21). Structured metadata, not a résumé listing — this is
          what lets a search like "Vocal Coach + Broadway" resolve to an
          exact chip combination instead of a hopeful keyword match against a
          bio. Closed list, no custom entry, same treatment as Certifications. */}
      {expOptions.length > 0 && (
        <div>
          <CheckGroup
            title="Professional experience"
            name="experience"
            options={expOptions}
            selected={selectedExperience}
          />
          <p className="mt-2 text-xs text-neutral-400">
            Self-reported and searchable — check what applies. Studios can filter the Roster by
            these.
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
        <div>
          <label className={label}>Facebook</label>
          <input name="facebook" defaultValue={social.facebook} placeholder="https://facebook.com/…" className={input} />
        </div>
        <div>
          <label className={label}>TikTok</label>
          <input name="tiktok" defaultValue={social.tiktok} placeholder="https://tiktok.com/@…" className={input} />
        </div>
        <div>
          <label className={label}>LinkedIn</label>
          <input name="linkedin" defaultValue={social.linkedin} placeholder="https://linkedin.com/in/…" className={input} />
        </div>
      </section>

      {/* Currently — profession-neutral (redesign 2026-08-20). "Teaching at" /
          "Touring with" assumed everyone was a touring teacher; these two read
          naturally for an educator, choreographer, performer, adjudicator,
          coach, or director alike. The underlying columns are unchanged
          (teaching_at / touring_with) — only the labels and placeholders. */}
      <section className="rounded-xl border border-neutral-200 p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Currently</h2>
        <p className="mt-1 text-sm text-neutral-500">Optional — what you&apos;re part of right now.</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Current affiliation / organization</label>
            <input
              name="teaching_at"
              defaultValue={initial?.teaching_at}
              placeholder="e.g. Broadway Dance Center, Alvin Ailey, a studio or company name"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Current project / production / engagement</label>
            <input
              name="touring_with"
              defaultValue={initial?.touring_with}
              placeholder="e.g. Hamilton — National Tour, a residency, a fall showcase"
              className={input}
            />
          </div>
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
            Ready to Join the Relevé Roster
          </span>
        </label>
        <p className="mt-1 pl-7 text-xs text-neutral-500">
          Turn this on when you&apos;re ready for studios and fellow professionals to discover you.
          Off means your profile stays a private draft that only you can see.
        </p>

        {/* Visibility — the SECOND axis (founder decision §7). Publishing decides
            whether the page is live at all; this decides how discoverable it is
            once it is. */}
        <fieldset className="mt-6 border-t border-neutral-200 pt-5">
          <legend className="text-sm font-medium text-neutral-800">
            Once published, who can find it?
          </legend>
          <div className="mt-3 space-y-3">
            {(["public", "unlisted"] as const).map((v) => (
              <label key={v} className="flex items-start gap-3">
                <input
                  type="radio"
                  name="visibility"
                  value={v}
                  defaultChecked={(initial?.visibility ?? "public") === v}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="block text-sm font-medium text-neutral-800">
                    {VISIBILITY_COPY[v].label}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {VISIBILITY_COPY[v].help}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            You can change this at any time, and switching to unlisted takes you off the Roster
            immediately.
          </p>
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save profile"}
          </button>
          {/* Discoverability fix (2026-08-21): while What I Offer is still
              empty, this is the more obvious next step than viewing the
              public page — it's what "Choose Option B" means: keep gently
              showing this until they've added at least one offering, not
              just on the very first save. Disappears the moment
              hasOfferings is true. */}
          {shouldShowOnboardingOfferingsCta(state) && (
            <Link
              href="/profile/offerings"
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
            >
              Next: Add What You Offer →
            </Link>
          )}
          {state.ok && state.slug && (
            <a
              href={`/${state.slug}`}
              target="_blank"
              className={
                shouldShowOnboardingOfferingsCta(state)
                  ? "text-sm text-neutral-500 underline"
                  : "text-sm font-medium text-neutral-700 underline"
              }
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
