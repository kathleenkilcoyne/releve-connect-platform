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

import { useActionState, useState } from "react";
import { saveStudioProfile, type SaveState } from "./actions";
import { STUDENT_COUNT_BANDS, STUDENT_COUNT_LABELS } from "@/lib/studio/profile";
import { orgCopy } from "@/lib/studio/org-copy";
import {
  MOTTO_MAX,
  accentIsWashedOut,
  monogramFrom,
  normalizeHex,
  readableTextColor,
} from "@/lib/studio/branding";

type Option = { slug: string; label: string };

type Initial = {
  name: string;
  artistic_director: string; // comma-joined for the single free-text field
  unique_note: string;
  mission: string;
  culture_note: string;
  website: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  promo_video_url: string;
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
  // "Getting there" — Accessible-by checkboxes (car_required reused for Car).
  accessible_by_train: boolean;
  accessible_by_bus: boolean;
  car_required: boolean;
  bio: string;
  logo_url: string;
  brand_accent: string;
  brand_accent_2: string;
  team_motto: string;
  hero_url: string;
  gallery_urls: string[];
} | null;

const input =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const label = "block text-xs font-medium text-neutral-600 mb-1";
const help = "mt-1 text-xs leading-relaxed text-neutral-500";

export default function StudioEditor({
  initial,
  styleOptions,
  concentrationOptions,
  certOptions,
  selectedStyles,
  selectedConcentrations,
  selectedCerts,
  isTeam = false,
}: {
  initial: Initial;
  styleOptions: Option[];
  concentrationOptions: Option[];
  certOptions: Option[];
  selectedStyles: string[];
  selectedConcentrations: string[];
  selectedCerts: string[];
  /** A dance team relabels "studio" → "team" throughout; default is a studio. */
  isTeam?: boolean;
}) {
  const copy = orgCopy(isTeam ? "dance_team" : "studio");
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveStudioProfile, {
    ok: false,
    message: "",
  });

  return (
    <form action={formAction} className="mt-8 space-y-10">
      {/* ── 1 · Studio name ─────────────────────────────────────────────── */}
      <section className="space-y-1">
        <label className={label}>{copy.nameLabel} *</label>
        <input name="name" required defaultValue={initial?.name ?? ""} className={input} />
      </section>

      {/* ── 2 · Artistic Director / Coach · Team Director ───────────────── */}
      <section className="space-y-1">
        <label className={label}>{copy.isTeam ? "Coach / Team Director" : "Artistic Director"}</label>
        <input
          name="artistic_director"
          placeholder={copy.isTeam ? "e.g., Jordan Blake" : "e.g., Roberta Mathes"}
          defaultValue={initial?.artistic_director ?? ""}
          className={input}
        />
        <p className={help}>
          {copy.isTeam
            ? "The person who leads your team. Have co-coaches or assistant directors? Separate them with commas."
            : "The person behind the studio — teachers often know a name before they know a studio. Have co-directors? Separate them with commas."}
        </p>
      </section>

      {/* ── 3 · The story: culture · unique · mission (all optional) ─────── */}
      <section className="space-y-6">
        <div>
          <label className={label}>
            {copy.isTeam ? "What is special about being on your team?" : "What is special about teaching at your school?"}
          </label>
          <textarea
            name="culture_note"
            rows={3}
            defaultValue={initial?.culture_note ?? ""}
            className={input}
          />
          <p className={help}>
            {copy.isTeam
              ? "A few honest words about your culture — what you value, how your dancers treat one another. This tells a prospective dancer more than any statistic."
              : "A few honest words about your culture — what you value, how your dancers treat one another. This tells a teacher more than any statistic."}
          </p>
        </div>

        <div>
          <label className={label}>What makes your {copy.noun} unique?</label>
          <textarea
            name="unique_note"
            rows={3}
            defaultValue={initial?.unique_note ?? ""}
            className={input}
          />
          <p className={help}>
            {copy.isTeam
              ? "One or two sentences. What would a dancer or coach feel here that they wouldn't feel anywhere else?"
              : "One or two sentences. What would a dancer or teacher feel here that they wouldn't feel anywhere else?"}
          </p>
        </div>

        <div>
          <label className={label}>Your {copy.noun} in one line.</label>
          <input
            name="mission"
            defaultValue={initial?.mission ?? ""}
            className={input}
          />
        </div>
      </section>

      {/* ── 3b · Branding (logo/mascot · accents · motto) ───────────────── */}
      <BrandingSection initial={initial} />

      {/* ── 3c · Photos (Hero/Cover image · up to 6 Additional Photos) ──── */}
      <PhotosSection initial={initial} copy={copy} />

      {/* ── 4 · Location (REQUIRED: city + state) ───────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Location</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Required. Your city and state power Swing/Flex matching by distance — no location, no
            match. Your full address lets us place your map pin automatically; you don&apos;t need
            coordinates.{" "}
            {copy.isTeam && "Use where your team is based."}
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
        title={copy.isTeam ? "Dance styles" : "Styles offered"}
        name="styles"
        options={styleOptions}
        selected={selectedStyles}
      />
      <CheckGroup
        title={copy.isTeam ? "Team focus" : "Concentration / focus"}
        name="concentrations"
        options={concentrationOptions}
        selected={selectedConcentrations}
      />

      {/* ── 6 · Scale ───────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">{copy.Noun} scale</h2>
        <div className={`grid grid-cols-1 gap-4 ${copy.isTeam ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          <div>
            <label className={label}>{copy.isTeam ? "Dancers" : "Students"}</label>
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
            <label className={label}>{copy.isTeam ? "Coaches / Staff" : "Staff (teachers)"}</label>
            <input
              name="staff_count"
              inputMode="numeric"
              defaultValue={initial?.staff_count ?? ""}
              className={input}
            />
          </div>
          {!copy.isTeam && (
            <div>
              <label className={label}>Studios / rooms</label>
              <input
                name="room_count"
                inputMode="numeric"
                defaultValue={initial?.room_count ?? ""}
                className={input}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── 7 · Getting there — simple "Accessible by" checkboxes ───────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-neutral-900">Getting there</h2>
        <fieldset>
          <legend className={label}>Accessible by:</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <AccessChip name="accessible_by_train" label="Train" checked={initial?.accessible_by_train ?? false} />
            <AccessChip name="accessible_by_bus" label="Bus" checked={initial?.accessible_by_bus ?? false} />
            <AccessChip name="car_required" label="Car / parking" checked={initial?.car_required ?? false} />
          </div>
        </fieldset>
      </section>

      {/* ── 8 · Certifications (studio only — not a fit for Dance Teams) ─── */}
      {!copy.isTeam && (
        <CheckGroup
          title="Certifications valued"
          name="certs"
          options={certOptions}
          selected={selectedCerts}
        />
      )}

      {/* ── 9 · Online & social ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Online &amp; social</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {copy.isTeam ? "Where dancers and coaches can find you. All optional." : "Where dancers and teachers can find you. All optional."}
          </p>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Instagram</label>
            <input
              name="instagram"
              placeholder={copy.isTeam ? "@yourteam" : "@yourstudio"}
              defaultValue={initial?.instagram ?? ""}
              className={input}
            />
          </div>
          <div>
            <label className={label}>TikTok</label>
            <input
              name="tiktok"
              placeholder={copy.isTeam ? "@yourteam" : "@yourstudio"}
              defaultValue={initial?.tiktok ?? ""}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Facebook</label>
            <input
              name="facebook"
              placeholder={copy.isTeam ? "facebook.com/yourteam" : "facebook.com/yourstudio"}
              defaultValue={initial?.facebook ?? ""}
              className={input}
            />
          </div>
        </div>
        <div>
          <label className={label}>Promotional video</label>
          <input
            name="promo_video_url"
            type="url"
            placeholder="YouTube or Vimeo link"
            defaultValue={initial?.promo_video_url ?? ""}
            className={input}
          />
          <p className={help}>
            {copy.isTeam
              ? "Paste a YouTube or Vimeo link — a performance reel, competition footage, game-day highlights, or a team introduction, whatever shows you best."
              : "Paste a YouTube or Vimeo link — a studio tour, a recital reel, whatever shows you best."}
          </p>
        </div>
      </section>

      {/* ── 10 · Plain details (logistics, last) ────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">{copy.Noun} details</h2>
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
          <label className={label}>Anything else about the {copy.noun} (optional)</label>
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
          {pending ? "Saving…" : copy.saveLabel}
        </button>
        {state.message && (
          <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
        )}
      </div>
    </form>
  );
}

// Branding — logo/mascot upload (sets logo_url via a gated route), up to two
// accent colors, and a short motto. A live preview shows the co-branded tile as
// a member will see it, with a COMPUTED accessible foreground so any accent stays
// legible; the accent-washed-out warning is a soft nudge, never a block.
function BrandingSection({ initial }: { initial: Initial }) {
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? "");
  const [accent, setAccent] = useState(initial?.brand_accent ?? "");
  const [accent2, setAccent2] = useState(initial?.brand_accent_2 ?? "");
  const [motto, setMotto] = useState(initial?.team_motto ?? "");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const normAccent = normalizeHex(accent);
  const tileBg = normAccent ?? "#f4f1ea";
  const tileFg = readableTextColor(normAccent ?? "#f4f1ea");
  const previewName = initial?.name?.trim() || "Your Team";
  const washed = accentIsWashedOut(accent);

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/studio/branding/logo", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNotice({ ok: false, text: data.error ?? "Upload failed." });
      else {
        setLogoUrl(data.url);
        setNotice({ ok: true, text: "Logo uploaded." });
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong uploading your logo." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Branding</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Your logo, colors, and motto appear above your members&apos; calendar in Relevé — this
          personalizes their view, it never replaces Relevé. All optional.
        </p>
      </div>

      {/* Live preview of the co-branded tile. */}
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg font-semibold"
          style={{ backgroundColor: tileBg, color: tileFg }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            monogramFrom(previewName)
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-neutral-900">{previewName}</p>
          {motto.trim() && <p className="truncate text-sm italic text-neutral-500">{motto.trim()}</p>}
        </div>
      </div>

      <div>
        <label className={label}>Logo or mascot</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={onLogoChange}
          disabled={uploading}
          className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
        />
        <p className={help}>PNG, JPG, or SVG, up to 2 MB. {uploading ? "Uploading…" : ""}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Primary accent (optional)</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={normAccent ?? "#111111"}
              onChange={(ev) => setAccent(ev.target.value)}
              className="h-9 w-10 shrink-0 cursor-pointer rounded border border-neutral-300"
              aria-label="Primary accent color picker"
            />
            <input
              name="brand_accent"
              value={accent}
              onChange={(ev) => setAccent(ev.target.value)}
              placeholder="#1a1a2e"
              className={input}
            />
          </div>
          {washed && (
            <p className="mt-1 text-xs text-amber-700">
              This accent is very light and may look washed out — a deeper color reads better.
            </p>
          )}
        </div>
        <div>
          <label className={label}>Secondary accent (optional)</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={normalizeHex(accent2) ?? "#111111"}
              onChange={(ev) => setAccent2(ev.target.value)}
              className="h-9 w-10 shrink-0 cursor-pointer rounded border border-neutral-300"
              aria-label="Secondary accent color picker"
            />
            <input
              name="brand_accent_2"
              value={accent2}
              onChange={(ev) => setAccent2(ev.target.value)}
              placeholder="#c9a24b"
              className={input}
            />
          </div>
        </div>
      </div>

      <div>
        <label className={label}>Motto (optional)</label>
        <input
          name="team_motto"
          value={motto}
          maxLength={MOTTO_MAX}
          onChange={(ev) => setMotto(ev.target.value)}
          placeholder="e.g. Together we rise"
          className={input}
        />
        <p className={help}>
          {motto.trim().length}/{MOTTO_MAX} characters.
        </p>
      </div>

      {notice && (
        <p className={`text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>
      )}
    </section>
  );
}

const MAX_GALLERY_IMAGES = 6;

// Hero/Cover image (one slot, replace-in-place) + Additional Photos gallery
// (up to 6, add/remove individually). Separate from BrandingSection (which
// keeps the pre-existing logo/accents/motto UI exactly as it was) — these are
// real photographs, not the small mark used for the logo. Same org-branding
// storage the logo already uses; each upload/remove hits its own dedicated
// route (hero or gallery) rather than the main profile-save form action.
function PhotosSection({ initial, copy }: { initial: Initial; copy: ReturnType<typeof orgCopy> }) {
  const [heroUrl, setHeroUrl] = useState(initial?.hero_url ?? "");
  const [gallery, setGallery] = useState<string[]>(initial?.gallery_urls ?? []);
  const [heroBusy, setHeroBusy] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function onHeroChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroBusy(true);
    setNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/studio/branding/hero", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNotice({ ok: false, text: data.error ?? "Upload failed." });
      else {
        setHeroUrl(data.url);
        setNotice({ ok: true, text: "Hero image uploaded." });
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong uploading your hero image." });
    } finally {
      setHeroBusy(false);
      e.target.value = "";
    }
  }

  async function removeHero() {
    setHeroBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/studio/branding/hero", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice({ ok: false, text: data.error ?? "Couldn't remove the hero image." });
      } else {
        setHeroUrl("");
        setNotice({ ok: true, text: "Hero image removed." });
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong removing the hero image." });
    } finally {
      setHeroBusy(false);
    }
  }

  async function onGalleryAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setGalleryBusy(true);
    setNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/studio/branding/gallery", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNotice({ ok: false, text: data.error ?? "Upload failed." });
      else {
        setGallery(data.gallery_urls ?? []);
        setNotice({ ok: true, text: "Photo added." });
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong uploading that photo." });
    } finally {
      setGalleryBusy(false);
      e.target.value = "";
    }
  }

  async function removeGalleryPhoto(url: string) {
    setGalleryBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/studio/branding/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNotice({ ok: false, text: data.error ?? "Couldn't remove that photo." });
      else {
        setGallery(data.gallery_urls ?? []);
        setNotice({ ok: true, text: "Photo removed." });
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong removing that photo." });
    } finally {
      setGalleryBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Photos</h2>
        <p className="mt-1 text-sm text-neutral-600">
          A Hero image for the top of your public {copy.noun} page, and up to {MAX_GALLERY_IMAGES} additional
          photos below it. All optional — real photos, PNG or JPEG.
        </p>
      </div>

      <div>
        <label className={label}>Hero / cover image</label>
        {heroUrl && (
          <div className="mb-2 overflow-hidden rounded-xl border border-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroUrl} alt="" className="aspect-[21/9] w-full object-cover" />
          </div>
        )}
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={onHeroChange}
            disabled={heroBusy}
            className="block flex-1 text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
          />
          {heroUrl && (
            <button
              type="button"
              onClick={removeHero}
              disabled={heroBusy}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        <p className={help}>PNG or JPEG, up to 5 MB. Wide photos (landscape) work best.</p>
      </div>

      <div>
        <label className={label}>
          Additional photos ({gallery.length}/{MAX_GALLERY_IMAGES})
        </label>
        {gallery.length > 0 && (
          <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {gallery.map((url) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeGalleryPhoto(url)}
                  disabled={galleryBusy}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-medium text-white disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {gallery.length < MAX_GALLERY_IMAGES ? (
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={onGalleryAdd}
            disabled={galleryBusy}
            className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
          />
        ) : (
          <p className={help}>You&apos;ve added the maximum of {MAX_GALLERY_IMAGES} photos. Remove one to add another.</p>
        )}
        <p className={help}>PNG or JPEG, up to 5 MB each.</p>
      </div>

      {notice && (
        <p className={`text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>
      )}
    </section>
  );
}

// A single named boolean checkbox, styled as a chip (same look as CheckGroup's
// items). A checked box posts "on" → parseCheckbox → true; unchecked posts
// nothing → false.
function AccessChip({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white">
      <input type="checkbox" name={name} defaultChecked={checked} className="sr-only" />
      {label}
    </label>
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
