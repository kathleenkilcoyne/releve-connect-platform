-- ============================================================================
-- Relevé Connect — Migration: the Roster (Step 4) — cert tags + search view
-- ----------------------------------------------------------------------------
-- WHAT THIS DOES
--   1. `certifications` — a controlled vocabulary of the structured, filterable
--      certification tags from build spec §6 (ABT NTC, RAD, Cecchetti,
--      Vaganova/Balanchine, PBT, Acrobatic Arts, Other). Same shape as the other
--      taxonomies (styles/levels/focus_areas) so the profile editor + Roster
--      filter treat it identically. World-readable (RLS select = true); no client
--      writes (admin/seed only).
--   2. `profile_certifications` — the profile ↔ certification join, with the same
--      own-row RLS as profile_styles / profile_levels (a member edits only their
--      own tags; §13: these are self-reported / searchable, NOT endorsed).
--   3. `roster_profiles` — a read view powering the Roster's multi-facet search.
--      It exposes only PUBLISHED + public profiles, pre-aggregates each profile's
--      style / level / cert slugs as arrays (so a facet filter is one array
--      overlap), and flags whether the owner currently holds an ACTIVE membership
--      (`owner_active`) so lapsed members drop out of discovery. Queried ONLY by
--      the server (service role); access is revoked from the anon/authenticated
--      PostgREST roles so the directory can't be scraped un-gated.
--
-- Idempotent: create-if-not-exists, on-conflict-do-nothing seed, or-replace view,
-- drop-policy-if-exists then recreate.
--
-- PREREQUISITE: schema.sql + prior migrations (talent_profiles, the taxonomies,
--   memberships, and the public.owns_talent_profile() RLS helper all exist).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) certifications — the structured, filterable cert vocabulary (§6)
-- ----------------------------------------------------------------------------
create table if not exists public.certifications (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  label      text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

insert into public.certifications (slug, label, sort_order) values
  ('abt-ntc',             'ABT® National Training Curriculum', 1),
  ('rad',                 'RAD (Royal Academy of Dance)',      2),
  ('cecchetti',           'Cecchetti',                         3),
  ('vaganova-balanchine', 'Vaganova / Balanchine',             4),
  ('pbt',                 'Progressing Ballet Technique (PBT)', 5),
  ('acrobatic-arts',      'Acrobatic Arts',                    6),
  ('other',               'Other',                             7)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 2) profile_certifications — profile ↔ certification join
-- ----------------------------------------------------------------------------
create table if not exists public.profile_certifications (
  profile_id       uuid not null references public.talent_profiles(profile_id) on delete cascade,
  certification_id uuid not null references public.certifications(id),
  primary key (profile_id, certification_id)
);
create index if not exists profile_certifications_cert_idx
  on public.profile_certifications (certification_id);

-- ----------------------------------------------------------------------------
-- 3) RLS — cert vocabulary is world-readable; the join is own-row only
-- ----------------------------------------------------------------------------
alter table public.certifications enable row level security;
drop policy if exists certifications_read_all on public.certifications;
create policy certifications_read_all on public.certifications for select using (true);

alter table public.profile_certifications enable row level security;

drop policy if exists profile_certifications_select_own on public.profile_certifications;
create policy profile_certifications_select_own on public.profile_certifications
  for select to authenticated using (public.owns_talent_profile(profile_id));

drop policy if exists profile_certifications_insert_own on public.profile_certifications;
create policy profile_certifications_insert_own on public.profile_certifications
  for insert to authenticated with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_certifications_update_own on public.profile_certifications;
create policy profile_certifications_update_own on public.profile_certifications
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_certifications_delete_own on public.profile_certifications;
create policy profile_certifications_delete_own on public.profile_certifications
  for delete to authenticated using (public.owns_talent_profile(profile_id));

-- ----------------------------------------------------------------------------
-- 4) roster_profiles — the Roster search view (published + public only)
-- ----------------------------------------------------------------------------
create or replace view public.roster_profiles as
select
  p.profile_id,
  p.user_id,
  p.display_name,
  p.public_slug,
  p.primary_role,
  p.city,
  p.state_province,
  p.country,
  p.region_id,
  p.headshot_url,
  p.verification_flag,
  p.honorifics,
  p.years_experience,
  p.search_tsv,
  coalesce((select array_agg(distinct s.slug)
            from public.profile_styles ps join public.styles s on s.id = ps.style_id
            where ps.profile_id = p.profile_id), '{}') as style_slugs,
  coalesce((select array_agg(distinct l.slug)
            from public.profile_levels pl join public.levels l on l.id = pl.level_id
            where pl.profile_id = p.profile_id), '{}') as level_slugs,
  coalesce((select array_agg(distinct c.slug)
            from public.profile_certifications pc join public.certifications c on c.id = pc.certification_id
            where pc.profile_id = p.profile_id), '{}') as cert_slugs,
  exists(select 1 from public.memberships m
         where m.user_id = p.user_id and m.membership_status = 'active') as owner_active
from public.talent_profiles p
where p.profile_status = 'published' and p.visibility = 'public';

-- The directory is a gated, paid benefit (§5) — only the server (service role)
-- may read it. Keep it off the anon/authenticated PostgREST roles.
revoke all on public.roster_profiles from anon, authenticated;

commit;

-- ============================================================================
-- END. `certifications` + `profile_certifications` capture the structured cert
-- tags; `roster_profiles` powers gated, multi-facet Roster search.
-- ============================================================================
