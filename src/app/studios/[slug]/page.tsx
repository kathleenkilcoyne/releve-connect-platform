// /studios/<slug> — a studio's PUBLIC profile.
//
// Shows a LIVE studio only (status = 'live' + matching public_slug); anything
// else 404s, so nothing unpublished is ever reachable here. Loaded with the
// service-role client so the vocab joins render, then filtered to status='live'.
//
// PUBLIC surface: we render only public-facing fields, and only when they have a
// value — blank fields are omitted entirely (not shown as "—"). We never render
// the owner email, status, submission/lifecycle timestamps, map coordinates, or
// any other internal field.
//
// Editorial visual treatment (2026-09-02): BLACK · CREAM · GOLD, the same
// values already established in components/home/tokens.css and
// components/roster/tokens.css — see studio-profile/tokens.css. This is a
// presentation-only pass: the query, ProfileRow shape, and every field read
// here are unchanged: same data, same org-aware copy from org-copy.ts, just
// regrouped and restyled into one editorial column instead of a stack of
// database-record-style sections.

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { orgCopy } from "@/lib/studio/org-copy";
import { memberLabelOf } from "@/lib/studio/team-types";
import { STUDENT_COUNT_LABELS, type StudentCountBand } from "@/lib/studio/profile";
import "@/components/studio-profile/tokens.css";

export const dynamic = "force-dynamic";

type ProfileRow = {
  employer_id: string;
  name: string | null;
  org_type: string | null;
  member_label: string | null;
  artistic_director: string[] | null;
  culture_note: string | null;
  unique_note: string | null;
  mission: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  year_founded: number | null;
  student_count_band: string | null;
  staff_count: number | null;
  room_count: number | null;
  accessible_by_train: boolean | null;
  accessible_by_bus: boolean | null;
  car_required: boolean | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  promo_video_url: string | null;
  bio: string | null;
  hero_url: string | null;
  gallery_urls: string[] | null;
};

/** "Under 50 dancers" / "50–99 students" — the shared, org-neutral count
 *  labels (`STUDENT_COUNT_LABELS`) plus the right noun for this org type, so
 *  a Dance Team's public page never says "students". */
function scaleLabel(band: string | null, isTeam: boolean, memberLabel: string | null): string | null {
  const base = band ? STUDENT_COUNT_LABELS[band as StudentCountBand] ?? null : null;
  if (!base) return null;
  const noun = isTeam ? memberLabelOf(memberLabel).toLowerCase() : "students";
  return `${base} ${noun}`;
}

const SELECT =
  "employer_id, name, org_type, member_label, artistic_director, culture_note, unique_note, mission, address_line1, " +
  "address_line2, city, state_province, postal_code, country, year_founded, student_count_band, " +
  "staff_count, room_count, accessible_by_train, accessible_by_bus, car_required, website, " +
  "instagram, tiktok, facebook, promo_video_url, bio, hero_url, gallery_urls";

async function loadLiveStudio(slug: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("employer_profiles")
    .select(SELECT)
    .eq("public_slug", slug)
    .eq("status", "live")
    .maybeSingle();
  const p = data as ProfileRow | null;
  if (!p) return null;

  const [styleRes, concRes, certRes] = await Promise.all([
    db.from("employer_styles").select("styles(label)").eq("employer_id", p.employer_id),
    db.from("employer_concentrations").select("studio_concentrations(label)").eq("employer_id", p.employer_id),
    db.from("employer_certifications").select("certifications(label)").eq("employer_id", p.employer_id),
  ]);
  const labelsOf = (rows: unknown, key: string): string[] =>
    ((rows as Array<Record<string, { label: string } | { label: string }[]>>) ?? [])
      .map((r) => {
        const v = r[key];
        return Array.isArray(v) ? v[0]?.label : v?.label;
      })
      .filter(Boolean) as string[];

  return {
    p,
    styles: labelsOf(styleRes.data, "styles"),
    concentrations: labelsOf(concRes.data, "studio_concentrations"),
    certs: labelsOf(certRes.data, "certifications"),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadLiveStudio(slug);
  if (!loaded) return { title: "Relevé Connect" };
  const copy = orgCopy(loaded.p.org_type);
  return {
    title: `${loaded.p.name ?? copy.Noun} · Relevé Connect`,
    description: loaded.p.mission?.slice(0, 160) ?? undefined,
  };
}

/** Absolute URL from a stored handle-or-URL, per platform. */
function toUrl(kind: "website" | "instagram" | "tiktok" | "facebook" | "video", raw: string): string {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  switch (kind) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "facebook":
      return `https://facebook.com/${handle}`;
    default:
      return `https://${v}`;
  }
}

/** An eyebrow-labelled block with a hairline rule above it — the one reusable
 *  section shape left after Team Culture / At a Glance / Connect got their
 *  own dedicated (but still plain, boxless) treatments. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-[color:var(--rc-line)] pt-8">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--rc-gold)]">
        {title}
      </h2>
      <div className="mt-3 text-[color:var(--rc-ink-soft)]">{children}</div>
    </section>
  );
}

/** The public photo grid — 2 columns on mobile, 3 from tablet up. */
function PhotoGallery({ urls }: { urls: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {urls.map((url) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          className="aspect-square w-full rounded-lg object-cover"
        />
      ))}
    </div>
  );
}

export default async function PublicStudioProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loaded = await loadLiveStudio(slug);
  if (!loaded) notFound();
  const { p, styles, concentrations, certs } = loaded;
  const copy = orgCopy(p.org_type);

  const has = (v: string | null | undefined) => Boolean(v && v.trim());
  const directors = (p.artistic_director ?? []).filter(Boolean);
  const location = [p.city, p.state_province].filter(Boolean).join(", ");
  const address = [
    p.address_line1,
    p.address_line2,
    [p.city, p.state_province, p.postal_code].filter(Boolean).join(", "),
    p.country,
  ]
    .filter((line) => line && String(line).trim())
    .join("\n");

  const accessibleBy = [
    p.accessible_by_train ? "Train" : null,
    p.accessible_by_bus ? "Bus" : null,
    p.car_required ? "Car / parking" : null,
  ].filter(Boolean) as string[];

  // "At a Glance" — Styles / Focus / Certifications / Team size / Coaching
  // staff / Founded, consolidated into one fact list. Room count stays
  // Studio-only (a Dance Team has no rooms of its own — mirrors the same
  // rule already applied in the editor's "Studios / rooms" field). Every
  // value here is exactly what the old, separate Sections used to show —
  // only the grouping and styling changed.
  const teamSizeLabel = scaleLabel(p.student_count_band, copy.isTeam, p.member_label);
  const roomsLabel = !copy.isTeam && p.room_count != null ? `${p.room_count} studios` : null;

  // Public display only — the bare generic "Other" carries no descriptive
  // detail to show a visitor. The stored `employer_styles` row is untouched;
  // this just skips it when building THIS page's text.
  const displayStyles = styles.filter((s) => s.trim().toLowerCase() !== "other");

  const glance: { label: string; value: string }[] = [
    displayStyles.length > 0 ? { label: "Styles", value: displayStyles.join(" · ") } : null,
    concentrations.length > 0
      ? { label: copy.isTeam ? "Team focus" : "Concentration", value: concentrations.join(" · ") }
      : null,
    certs.length > 0 ? { label: "Certifications", value: certs.join(" · ") } : null,
    teamSizeLabel ? { label: copy.isTeam ? "Team size" : "Student count", value: teamSizeLabel } : null,
    // Plain count instead of copy.staffCountLabel's "N coaches/staff" —
    // cleaner as a glance fact; the underlying staff_count is unchanged.
    p.staff_count != null
      ? { label: copy.isTeam ? "Coaching Staff" : "Teaching Staff", value: String(p.staff_count) }
      : null,
    roomsLabel ? { label: "Studios", value: roomsLabel } : null,
    p.year_founded != null ? { label: "Founded", value: String(p.year_founded) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const gallery = (p.gallery_urls ?? []).filter(Boolean);

  // Connect — Video + Website + Instagram + TikTok + Facebook, unified into
  // one set of links (was two separate "Video" / "Find us online" sections).
  const connectLinks = [
    has(p.promo_video_url) ? { label: "Watch video", href: toUrl("video", p.promo_video_url!) } : null,
    has(p.website) ? { label: "Website", href: toUrl("website", p.website!) } : null,
    has(p.instagram) ? { label: "Instagram", href: toUrl("instagram", p.instagram!) } : null,
    has(p.tiktok) ? { label: "TikTok", href: toUrl("tiktok", p.tiktok!) } : null,
    has(p.facebook) ? { label: "Facebook", href: toUrl("facebook", p.facebook!) } : null,
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <main className="studio-profile-scope">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
        <Link
          href="/studios"
          className="text-[11px] font-medium uppercase tracking-[0.15em] text-[color:var(--rc-muted)] hover:text-[color:var(--rc-gold)]"
        >
          ← Back to directory
        </Link>

        {has(p.hero_url) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.hero_url!}
            alt=""
            className="mt-5 aspect-[4/3] w-full rounded-2xl object-cover sm:aspect-[2/1]"
          />
        )}

        {/* ── Identity: name, location, mission — the opening hierarchy ── */}
        <div className="mt-8">
          <h1 className="font-[family-name:var(--font-rc-serif)] text-[40px] leading-[1.1] tracking-[-0.01em] text-[color:var(--rc-ink)] sm:text-[44px]">
            {p.name}
          </h1>
          {location && (
            <p className="mt-2 text-[13px] font-medium uppercase tracking-[0.14em] text-[color:var(--rc-muted)]">
              {location}
            </p>
          )}
          {has(p.mission) && (
            <p className="mt-6 max-w-[52ch] border-t border-[color:var(--rc-line)] pt-5 font-[family-name:var(--font-rc-serif)] text-[19px] italic leading-[1.6] text-[color:var(--rc-ink-soft)]">
              {p.mission}
            </p>
          )}
        </div>

        {/* ── Coach / Director — kept prominent, right after identity, before About ── */}
        {directors.length > 0 && (
          <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-[color:var(--rc-line)] pt-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--rc-gold)]">
              {copy.directorTitle}
            </span>
            <span className="font-[family-name:var(--font-rc-serif)] text-[19px] text-[color:var(--rc-ink)]">
              {directors.join(", ")}
            </span>
          </div>
        )}

        {/* ── About — moved up, right after identity/director ── */}
        {has(p.bio) && (
          <section
            className={
              directors.length > 0
                ? "mt-8"
                : "mt-8 border-t border-[color:var(--rc-line)] pt-6"
            }
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--rc-gold)]">
              {copy.aboutSectionTitle}
            </h2>
            <p className="mt-3 max-w-[60ch] whitespace-pre-line text-[17px] leading-[1.75] text-[color:var(--rc-ink-soft)]">
              {p.bio}
            </p>
          </section>
        )}

        {/* ── Team/Studio Culture — culture_note + unique_note, one cohesive
            section; both texts preserved verbatim under their existing
            (org-aware) labels, just grouped instead of stacked separately ── */}
        {(has(p.culture_note) || has(p.unique_note)) && (
          <section className="mt-8 border-t border-[color:var(--rc-line)] pt-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--rc-gold)]">
              {copy.isTeam ? "Team Culture" : "Studio Culture"}
            </h2>
            {/* The original questionnaire prompts (cultureSectionTitle /
                uniqueSectionTitle) lead each answer in — same text as
                before, just an inline italic lead-in now instead of an
                uppercase form-style label, so it reads as editorial copy. */}
            <div className="mt-4 max-w-[60ch] space-y-5">
              {has(p.culture_note) && (
                <p className="whitespace-pre-line text-[16px] leading-[1.75] text-[color:var(--rc-ink-soft)]">
                  <span className="italic text-[color:var(--rc-muted)]">{copy.cultureSectionTitle}. </span>
                  {p.culture_note}
                </p>
              )}
              {has(p.unique_note) && (
                <p className="whitespace-pre-line text-[16px] leading-[1.75] text-[color:var(--rc-ink-soft)]">
                  <span className="italic text-[color:var(--rc-muted)]">{copy.uniqueSectionTitle}. </span>
                  {p.unique_note}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ── At a Glance — Styles / Focus / Certifications / Team size /
            Coaching staff / Founded, consolidated into one fact list ── */}
        {glance.length > 0 && (
          <section className="mt-8 border-t border-[color:var(--rc-line)] pt-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--rc-gold)]">
              At a Glance
            </h2>
            <dl className="mt-3">
              {glance.map((g) => (
                <div
                  key={g.label}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 border-b border-[color:var(--rc-line)] py-2.5 last:border-b-0"
                >
                  <dt className="text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--rc-muted)]">
                    {g.label}
                  </dt>
                  <dd className="text-[15px] text-[color:var(--rc-ink)]">{g.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* ── Location ── */}
        {address && (
          <Section title="Location">
            <p className="whitespace-pre-line text-[15px] leading-[1.7]">{address}</p>
            {accessibleBy.length > 0 && (
              <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--rc-muted)]">
                Accessible by {accessibleBy.join(" · ")}
              </p>
            )}
          </Section>
        )}

        {/* ── Photos ── */}
        {gallery.length > 0 && (
          <Section title="Photos">
            <PhotoGallery urls={gallery} />
          </Section>
        )}

        {/* ── Connect — Video + Website + Instagram + TikTok + Facebook,
            one consistent set of links (was two separate sections) ── */}
        {connectLinks.length > 0 && (
          <Section title="Connect">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {connectLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-medium uppercase tracking-[0.08em] text-[color:var(--rc-ink-soft)] underline decoration-[color:var(--rc-gold)] decoration-1 underline-offset-4 hover:text-[color:var(--rc-gold)]"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* ── Footer endcap — small and restrained, not a heavy black band ── */}
        <div className="mt-14 flex flex-col items-center gap-3 border-t border-[color:var(--rc-line)] pt-8 text-center">
          <span aria-hidden="true" className="h-px w-10 bg-[color:var(--rc-gold)]" />
          <Link
            href="/"
            className="font-[family-name:var(--font-rc-serif)] text-[13px] italic text-[color:var(--rc-muted)] hover:text-[color:var(--rc-gold)]"
          >
            together we rise · relevé
          </Link>
        </div>
      </div>
    </main>
  );
}
