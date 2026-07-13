// The studio (employer) profile editor. Server-side this page:
//   1. checks you're signed in (if not → /login?next=/studio/edit so the magic
//      link brings you back here),
//   2. loads the pick-lists (styles / concentration / certifications),
//   3. loads your existing studio profile + joins (if any) so the form pre-fills,
// then hands it to the interactive form.
//
// NO membership gate: studios sign up via light onboarding (founder decision
// 2026-07-13). The account is created on first save.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StudioEditor from "./StudioEditor";

export const dynamic = "force-dynamic";

type Option = { slug: string; label: string };

type EmployerFields = {
  employer_id: string;
  name: string | null;
  website: string | null;
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
  nearest_transit: string | null;
  car_required: boolean | null;
  parking: string | null;
  directions_note: string | null;
  culture_note: string | null;
  bio: string | null;
};

export default async function StudioEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/studio/edit&from=studio");

  // Pick-lists (world-readable).
  const [stylesRes, concRes, certsRes] = await Promise.all([
    supabase.from("styles").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase
      .from("studio_concentrations")
      .select("slug, label")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("certifications").select("slug, label").eq("is_active", true).order("sort_order"),
  ]);
  const styleOptions = (stylesRes.data ?? []) as Option[];
  const concentrationOptions = (concRes.data ?? []) as Option[];
  const certOptions = (certsRes.data ?? []) as Option[];

  // My existing studio profile (own-row only via RLS).
  const { data: profile } = await supabase
    .from("employer_profiles")
    .select(
      "employer_id, name, website, address_line1, address_line2, city, state_province, " +
        "postal_code, country, year_founded, student_count_band, staff_count, room_count, " +
        "nearest_transit, car_required, parking, directions_note, culture_note, bio",
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();
  const e = profile as unknown as EmployerFields | null;

  let selectedStyles: string[] = [];
  let selectedConcentrations: string[] = [];
  let selectedCerts: string[] = [];
  if (e) {
    const [es, ec, ce] = await Promise.all([
      supabase.from("employer_styles").select("styles(slug)").eq("employer_id", e.employer_id),
      supabase
        .from("employer_concentrations")
        .select("studio_concentrations(slug)")
        .eq("employer_id", e.employer_id),
      supabase
        .from("employer_certifications")
        .select("certifications(slug)")
        .eq("employer_id", e.employer_id),
    ]);
    const slugsOf = (rows: unknown, key: string): string[] =>
      ((rows as Array<Record<string, { slug: string } | { slug: string }[]>>) ?? [])
        .map((r) => {
          const v = r[key];
          return Array.isArray(v) ? v[0]?.slug : v?.slug;
        })
        .filter(Boolean) as string[];
    selectedStyles = slugsOf(es.data, "styles");
    selectedConcentrations = slugsOf(ec.data, "studio_concentrations");
    selectedCerts = slugsOf(ce.data, "certifications");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · My studio
        </p>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-neutral-500 underline" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
        {e ? "Edit your studio" : "Set up your studio"}
      </h1>
      <p className="mt-3 text-neutral-600">
        This is how teachers find you and decide whether they can cover a class. Fill in what you
        like now — you can always add more later.
      </p>

      <StudioEditor
        initial={
          e
            ? {
                name: e.name ?? "",
                website: e.website ?? "",
                address_line1: e.address_line1 ?? "",
                address_line2: e.address_line2 ?? "",
                city: e.city ?? "",
                state_province: e.state_province ?? "",
                postal_code: e.postal_code ?? "",
                country: e.country ?? "",
                year_founded: e.year_founded != null ? String(e.year_founded) : "",
                student_count_band: e.student_count_band ?? "",
                staff_count: e.staff_count != null ? String(e.staff_count) : "",
                room_count: e.room_count != null ? String(e.room_count) : "",
                nearest_transit: e.nearest_transit ?? "",
                car_required: e.car_required == null ? "" : e.car_required ? "yes" : "no",
                parking: e.parking ?? "",
                directions_note: e.directions_note ?? "",
                culture_note: e.culture_note ?? "",
                bio: e.bio ?? "",
              }
            : null
        }
        styleOptions={styleOptions}
        concentrationOptions={concentrationOptions}
        certOptions={certOptions}
        selectedStyles={selectedStyles}
        selectedConcentrations={selectedConcentrations}
        selectedCerts={selectedCerts}
      />

      <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
