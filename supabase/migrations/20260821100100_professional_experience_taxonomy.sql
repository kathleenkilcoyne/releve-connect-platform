-- Roster search rebuild, Phase 1. Part 2 of 3: the Professional Experience
-- taxonomy (founder-approved 2026-08-21) — structured metadata so a search
-- like "Vocal Coach + Broadway" resolves to an exact chip combination instead
-- of a hopeful keyword match against free-text bios. Same shape and RLS
-- pattern as `certifications` (world-readable vocabulary; own-row join).

create table if not exists public.professional_experience_tags (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  label      text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

insert into public.professional_experience_tags (slug, label, sort_order) values
  ('broadway',             'Broadway',             1),
  ('off_broadway',         'Off-Broadway',          2),
  ('national_tour',        'National Tour',        3),
  ('international_tour',   'International Tour',   4),
  ('regional_theatre',     'Regional Theatre',     5),
  ('film_tv',               'Film / TV',            6),
  ('commercial',           'Commercial',            7),
  ('concert_cabaret',      'Concert / Cabaret',     8),
  ('professional_company', 'Professional Company', 9)
on conflict (slug) do nothing;

create table if not exists public.profile_professional_experience (
  profile_id      uuid not null references public.talent_profiles(profile_id) on delete cascade,
  experience_tag_id uuid not null references public.professional_experience_tags(id),
  primary key (profile_id, experience_tag_id)
);
create index if not exists profile_professional_experience_tag_idx
  on public.profile_professional_experience (experience_tag_id);

alter table public.professional_experience_tags enable row level security;
drop policy if exists professional_experience_tags_read_all on public.professional_experience_tags;
create policy professional_experience_tags_read_all on public.professional_experience_tags
  for select using (true);

alter table public.profile_professional_experience enable row level security;

drop policy if exists profile_professional_experience_select_own on public.profile_professional_experience;
create policy profile_professional_experience_select_own on public.profile_professional_experience
  for select to authenticated using (public.owns_talent_profile(profile_id));

drop policy if exists profile_professional_experience_insert_own on public.profile_professional_experience;
create policy profile_professional_experience_insert_own on public.profile_professional_experience
  for insert to authenticated with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_professional_experience_update_own on public.profile_professional_experience;
create policy profile_professional_experience_update_own on public.profile_professional_experience
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_professional_experience_delete_own on public.profile_professional_experience;
create policy profile_professional_experience_delete_own on public.profile_professional_experience
  for delete to authenticated using (public.owns_talent_profile(profile_id));

-- New tables are not auto-exposed to the Data API on this project (see the
-- note in 20260724000000_availability_and_taxonomy.sql) — grants must be
-- explicit or PostgREST 404s.
grant select on public.professional_experience_tags to anon, authenticated, service_role;
grant select, insert, update, delete on public.profile_professional_experience to authenticated, service_role;
