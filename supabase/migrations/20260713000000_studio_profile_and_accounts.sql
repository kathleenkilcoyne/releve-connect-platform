-- ============================================================================
-- Relevé Connect — Migration: The Swing, Slice B(0) — real studio accounts +
-- the light §7 studio profile (the shared blocker for Swing dispatch, the Beat,
-- studios-in-the-Roster, and map-pin radius search).
-- ----------------------------------------------------------------------------
-- WHY: until now there was NO way for a studio (an `employer`) to exist. The
-- teacher side of The Swing shipped in Slice A; the dispatch loop needs a studio
-- on the other end to post a slot and pick from responders. This migration gives
-- studios a real, self-managed account + the practical §7 profile a sub needs to
-- decide "can I take this, and can I get there?".
--
-- FOUNDER DECISION (2026-07-13, Kathleen): studios sign up via LIGHT ONBOARDING —
-- they are the buyer/customer side, not vetted talent, so there is NO $30 fee and
-- NO admin approval queue. A studio signs in (magic link), fills this profile, and
-- is live. (Talent stays vetted; this is deliberately different — §2, §7.)
--
-- MAP PIN (2026-07-13 decision): store the full address now; `lat`/`lng` are
-- nullable and stay empty until a geocoding provider is wired in a later slice.
-- Same "build the column, fill it later" approach as the profile earned-proof
-- slot. Radius search (§8) and Swing geo-matching light up once lat/lng exist.
--
-- WHAT THIS ADDS
--   1. employer_profiles — fleshed out to §7: website, full address, map pin
--      (lat/lng, nullable), year founded, student-count band, staff/room counts,
--      the accessibility block (nearest transit, car required, parking,
--      directions note), and the studio culture note.
--   2. studio_concentrations — a SMALL controlled vocab for §7 concentration/
--      focus (Competition · Technique/Recreational · Conservatory/Pre-Prof).
--      Deliberately separate from choreographer `focus_areas` (different meaning).
--   3. employer_styles / employer_concentrations / employer_certifications —
--      join tables (styles offered, concentration, certs valued) reusing the
--      existing `styles` + `certifications` vocab. Own-row RLS via owns_employer().
--
-- Idempotent (add-column-if-not-exists, create-if-not-exists, drop-then-create
-- policies). PREREQUISITES: employer_profiles, styles, certifications, and
-- public.owns_employer() all already exist.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) employer_profiles — the §7 practical fields
-- ----------------------------------------------------------------------------
alter table public.employer_profiles
  add column if not exists website          text,
  -- Full address (city/state_province/country already exist on the table).
  add column if not exists address_line1     text,
  add column if not exists address_line2     text,
  add column if not exists postal_code       text,
  -- Map pin — NULLABLE. Geocoded from the address in a later slice; drives the
  -- deferred radius search (§8) + Swing geo-matching (§10). `geocoded_at` records
  -- when it was filled so a backfill sweep can find un-geocoded studios.
  add column if not exists lat               double precision,
  add column if not exists lng               double precision,
  add column if not exists geocoded_at       timestamptz,
  add column if not exists year_founded      int,
  -- Student-count band (§7): Under 100 / 100–299 / 300+. Stored as a text band
  -- (like talent years_experience) with a check so it stays a controlled value.
  add column if not exists student_count_band text,
  add column if not exists staff_count       int,
  add column if not exists room_count        int,
  -- Accessibility / "getting there" block (§7) — the genuine differentiator.
  add column if not exists nearest_transit   text,   -- nearest train line(s)/station, bus route(s) — free text
  add column if not exists car_required      boolean,
  add column if not exists parking           text,   -- On-site / Street / None
  add column if not exists directions_note   text,
  add column if not exists culture_note      text;

-- Controlled-value + sanity checks (added separately so re-runs don't error).
do $$ begin
  alter table public.employer_profiles
    add constraint employer_year_founded_chk
    check (year_founded is null or (year_founded between 1800 and (extract(year from now())::int + 1)));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.employer_profiles
    add constraint employer_student_band_chk
    check (student_count_band is null or student_count_band in ('under_100','100_299','300_plus'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.employer_profiles
    add constraint employer_staff_count_chk
    check (staff_count is null or staff_count >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.employer_profiles
    add constraint employer_room_count_chk
    check (room_count is null or room_count >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.employer_profiles
    add constraint employer_parking_chk
    check (parking is null or parking in ('onsite','street','none'));
exception when duplicate_object then null; end $$;

-- Fast lookup of studios that already have a map pin (for the future dispatch /
-- radius query, which only considers geocoded studios).
create index if not exists employer_profiles_geo_idx
  on public.employer_profiles (lat, lng) where lat is not null and lng is not null;

-- ----------------------------------------------------------------------------
-- 2) studio_concentrations — the §7 concentration/focus vocab (studio-specific)
-- ----------------------------------------------------------------------------
create table if not exists public.studio_concentrations (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  label      text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.studio_concentrations (slug, label, sort_order) values
  ('competition',                 'Competition',                  1),
  ('technique-recreational',      'Technique / Recreational',     2),
  ('conservatory-pre-professional','Conservatory / Pre-Professional', 3)
on conflict (slug) do nothing;

-- Public READ, no client writes (mirrors styles/levels/certifications).
alter table public.studio_concentrations enable row level security;
drop policy if exists studio_concentrations_read_all on public.studio_concentrations;
create policy studio_concentrations_read_all on public.studio_concentrations for select using (true);

-- ----------------------------------------------------------------------------
-- 3) Join tables — styles offered / concentration / certs valued (own-row RLS)
-- ----------------------------------------------------------------------------
create table if not exists public.employer_styles (
  employer_id uuid not null references public.employer_profiles(employer_id) on delete cascade,
  style_id    uuid not null references public.styles(id),
  primary key (employer_id, style_id)
);
create index if not exists employer_styles_style_idx on public.employer_styles (style_id);

create table if not exists public.employer_concentrations (
  employer_id      uuid not null references public.employer_profiles(employer_id) on delete cascade,
  concentration_id uuid not null references public.studio_concentrations(id),
  primary key (employer_id, concentration_id)
);
create index if not exists employer_concentrations_conc_idx on public.employer_concentrations (concentration_id);

create table if not exists public.employer_certifications (
  employer_id      uuid not null references public.employer_profiles(employer_id) on delete cascade,
  certification_id uuid not null references public.certifications(id),
  primary key (employer_id, certification_id)
);
create index if not exists employer_certifications_cert_idx on public.employer_certifications (certification_id);

-- Own-row RLS on all three joins — a studio manages only its own rows. The
-- dispatch/matching loop (later slice) reads these server-side via service role.
alter table public.employer_styles enable row level security;
drop policy if exists employer_styles_select_own on public.employer_styles;
create policy employer_styles_select_own on public.employer_styles
  for select to authenticated using (public.owns_employer(employer_id));
drop policy if exists employer_styles_insert_own on public.employer_styles;
create policy employer_styles_insert_own on public.employer_styles
  for insert to authenticated with check (public.owns_employer(employer_id));
drop policy if exists employer_styles_update_own on public.employer_styles;
create policy employer_styles_update_own on public.employer_styles
  for update to authenticated using (public.owns_employer(employer_id)) with check (public.owns_employer(employer_id));
drop policy if exists employer_styles_delete_own on public.employer_styles;
create policy employer_styles_delete_own on public.employer_styles
  for delete to authenticated using (public.owns_employer(employer_id));

alter table public.employer_concentrations enable row level security;
drop policy if exists employer_concentrations_select_own on public.employer_concentrations;
create policy employer_concentrations_select_own on public.employer_concentrations
  for select to authenticated using (public.owns_employer(employer_id));
drop policy if exists employer_concentrations_insert_own on public.employer_concentrations;
create policy employer_concentrations_insert_own on public.employer_concentrations
  for insert to authenticated with check (public.owns_employer(employer_id));
drop policy if exists employer_concentrations_update_own on public.employer_concentrations;
create policy employer_concentrations_update_own on public.employer_concentrations
  for update to authenticated using (public.owns_employer(employer_id)) with check (public.owns_employer(employer_id));
drop policy if exists employer_concentrations_delete_own on public.employer_concentrations;
create policy employer_concentrations_delete_own on public.employer_concentrations
  for delete to authenticated using (public.owns_employer(employer_id));

alter table public.employer_certifications enable row level security;
drop policy if exists employer_certifications_select_own on public.employer_certifications;
create policy employer_certifications_select_own on public.employer_certifications
  for select to authenticated using (public.owns_employer(employer_id));
drop policy if exists employer_certifications_insert_own on public.employer_certifications;
create policy employer_certifications_insert_own on public.employer_certifications
  for insert to authenticated with check (public.owns_employer(employer_id));
drop policy if exists employer_certifications_update_own on public.employer_certifications;
create policy employer_certifications_update_own on public.employer_certifications
  for update to authenticated using (public.owns_employer(employer_id)) with check (public.owns_employer(employer_id));
drop policy if exists employer_certifications_delete_own on public.employer_certifications;
create policy employer_certifications_delete_own on public.employer_certifications
  for delete to authenticated using (public.owns_employer(employer_id));

commit;

-- ============================================================================
-- END. A studio can now hold a real `employer` account with a §7 profile
-- (address + map-pin column, accessibility block, styles/concentration/certs).
-- Next: the dispatch loop (studio posts a slot → match → notify → claim →
-- studio picks) reads these server-side.
-- ============================================================================
