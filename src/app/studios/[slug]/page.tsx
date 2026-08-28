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

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ProfileRow = {
  employer_id: string;
  name: string | null;
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

const STUDENT_BAND_LABEL: Record<string, string> = {
  under_50: "Under 50 students",
  "50_99": "50–99 students",
  "100_199": "100–199 students",
  "200_plus": "200+ students",
};

const SELECT =
  "employer_id, name, artistic_director, culture_note, unique_note, mission, address_line1, " +
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
  if (!loaded) return { title: "Studio · Relevé Connect" };
  return {
    title: `${loaded.p.name ?? "Studio"} · Relevé Connect`,
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">{title}</h2>
      <div className="mt-2 text-neutral-700">{children}</div>
    </section>
  );
}

function TagRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <span key={it} className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700">
          {it}
        </span>
      ))}
    </div>
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

  const scale = [
    p.student_count_band ? STUDENT_BAND_LABEL[p.student_count_band] ?? p.student_count_band : null,
    p.staff_count != null ? `${p.staff_count} teachers` : null,
    p.room_count != null ? `${p.room_count} studios` : null,
  ].filter(Boolean) as string[];

  const accessibleBy = [
    p.accessible_by_train ? "Train" : null,
    p.accessible_by_bus ? "Bus" : null,
    p.car_required ? "Car / parking" : null,
  ].filter(Boolean) as string[];

  const socials: { label: string; kind: "website" | "instagram" | "tiktok" | "facebook"; raw: string | null }[] = [
    { label: "Website", kind: "website", raw: p.website },
    { label: "Instagram", kind: "instagram", raw: p.instagram },
    { label: "TikTok", kind: "tiktok", raw: p.tiktok },
    { label: "Facebook", kind: "facebook", raw: p.facebook },
  ].filter((s) => has(s.raw)) as typeof socials;

  const gallery = (p.gallery_urls ?? []).filter(Boolean);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/studios" className="text-sm text-neutral-500 underline">
        ← All studios
      </Link>

      {has(p.hero_url) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.hero_url!}
          alt=""
          className="mt-4 aspect-[21/9] w-full rounded-2xl object-cover sm:aspect-[3/1]"
        />
      )}

      <h1 className="mt-4 text-4xl font-semibold leading-tight text-neutral-900">{p.name}</h1>
      {location && <p className="mt-1 text-neutral-600">{location}</p>}
      {has(p.mission) && (
        <p className="mt-4 text-lg italic leading-relaxed text-neutral-700">{p.mission}</p>
      )}

      {directors.length > 0 && (
        <Section title="Artistic Director">{directors.join(", ")}</Section>
      )}

      {has(p.culture_note) && (
        <Section title="What is special about teaching here">
          <p className="whitespace-pre-line leading-relaxed">{p.culture_note}</p>
        </Section>
      )}

      {has(p.unique_note) && (
        <Section title="What makes this studio unique">
          <p className="whitespace-pre-line leading-relaxed">{p.unique_note}</p>
        </Section>
      )}

      {styles.length > 0 && (
        <Section title="Styles offered">
          <TagRow items={styles} />
        </Section>
      )}
      {concentrations.length > 0 && (
        <Section title="Concentration">
          <TagRow items={concentrations} />
        </Section>
      )}
      {certs.length > 0 && (
        <Section title="Certifications">
          <TagRow items={certs} />
        </Section>
      )}

      {scale.length > 0 && <Section title="Teaching staff">{scale.join(" · ")}</Section>}
      {p.year_founded != null && <Section title="Founded">{p.year_founded}</Section>}
      {accessibleBy.length > 0 && <Section title="Accessible by">{accessibleBy.join(" · ")}</Section>}

      {address && (
        <Section title="Location">
          <p className="whitespace-pre-line">{address}</p>
        </Section>
      )}

      {has(p.bio) && (
        <Section title="More about the studio">
          <p className="whitespace-pre-line leading-relaxed">{p.bio}</p>
        </Section>
      )}

      {has(p.promo_video_url) && (
        <Section title="Video">
          <a
            href={toUrl("video", p.promo_video_url!)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-700 underline"
          >
            Watch our video →
          </a>
        </Section>
      )}

      {socials.length > 0 && (
        <Section title="Find us online">
          <div className="flex flex-wrap gap-3">
            {socials.map((s) => (
              <a
                key={s.label}
                href={toUrl(s.kind, s.raw!)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
              >
                {s.label} ↗
              </a>
            ))}
          </div>
        </Section>
      )}

      {gallery.length > 0 && (
        <Section title="Photos">
          <PhotoGallery urls={gallery} />
        </Section>
      )}

      <Link href="/" className="mt-14 inline-block text-sm text-neutral-400 underline">
        together we rise · relevé
      </Link>
    </main>
  );
}
