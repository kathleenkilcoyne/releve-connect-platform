-- Profile revisions, 2026-07-24 (PROFILE-REVISIONS-FROM-KATHLEEN.md).
--
-- The through-line of this migration: everything a studio might search on is a
-- STRUCTURED TAG, never free text. "Jazz teachers within 20 miles, available
-- weekends, CPR-certified" has to be a query, not a reading exercise. Capturing
-- it structured now is nearly free; retrofitting it later is a migration with
-- real data in the way. This is also the same spine The Swing will match on —
-- one data model, two features.
--
--   1. New Focus Areas    — Early Childhood · Adaptive Dance · Improvisation
--   2. New Certifications — State Teaching License · CPR/First Aid · Safe Sport
--   3. NEW: availability_tags + profile_availability, the "Availability" section
--   4. NEW: talent_profiles.teaching_at / touring_with (the "Currently" lines)
--   5. roster_profiles gains availability_slugs so the Roster can filter on it

-- ---------------------------------------------------------------------------
-- 1. Focus areas
-- ---------------------------------------------------------------------------
insert into focus_areas (slug, label, sort_order, is_active) values
  ('early-childhood', 'Early Childhood', 11, true),
  ('adaptive-dance',  'Adaptive Dance',  12, true),
  ('improvisation',   'Improvisation',   13, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Certifications
--
-- "Other" was sort_order 7, which would have buried the three new ones beneath
-- it. Push it to 99 so it stays last, the way focus_areas already does it.
-- ---------------------------------------------------------------------------
insert into certifications (slug, label, sort_order, is_active) values
  ('state-teaching-license', 'State Teaching License', 8,  true),
  ('cpr-first-aid',          'CPR / First Aid',        9,  true),
  ('safe-sport',             'Safe Sport',             10, true)
on conflict (slug) do nothing;

update certifications set sort_order = 99 where slug = 'other';

-- ---------------------------------------------------------------------------
-- 3. Availability tags
--
-- One table, two `kind`s, because both render as checkboxes and both filter
-- identically — splitting them into two tables would duplicate the join, the
-- RLS, the view column and the filter code to say the same thing twice.
--   'general'   — when they can work        (Saturdays, Weekends, …)
--   'currently' — what they're taking on    (Accepting Choreography, …)
-- The 'currently' ones are deliberately NOT booleans on talent_profiles: a
-- studio searching "choreographers accepting commissions" wants a facet that
-- behaves exactly like Style and Certification, not a special case.
-- ---------------------------------------------------------------------------
create table if not exists availability_tags (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  kind       text not null check (kind in ('general', 'currently')),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into availability_tags (slug, label, kind, sort_order) values
  ('saturdays',                    'Saturdays',                    'general',   1),
  ('weekends',                     'Weekends',                     'general',   2),
  ('summers-only',                 'Summers Only',                 'general',   3),
  ('willing-to-travel',            'Willing to Travel',            'general',   4),
  ('virtual-available',            'Virtual Available',            'general',   5),
  ('accepting-choreography',       'Accepting Choreography',       'currently', 1),
  ('accepting-master-classes',     'Accepting Master Classes',     'currently', 2),
  ('available-for-adjudication',   'Available for Adjudication',   'currently', 3),
  ('available-for-guest-teaching', 'Available for Guest Teaching', 'currently', 4)
on conflict (slug) do nothing;

create table if not exists profile_availability (
  profile_id          uuid not null references talent_profiles(profile_id) on delete cascade,
  availability_tag_id uuid not null references availability_tags(id) on delete cascade,
  primary key (profile_id, availability_tag_id)
);

create index if not exists profile_availability_tag_idx
  on profile_availability (availability_tag_id);

-- RLS mirrors focus_areas / profile_focus_areas exactly: the vocabulary is
-- world-readable, and a member may only touch their own profile's rows.
alter table availability_tags     enable row level security;
alter table profile_availability  enable row level security;

drop policy if exists availability_tags_read_all on availability_tags;
create policy availability_tags_read_all on availability_tags
  for select using (true);

drop policy if exists profile_availability_select_own on profile_availability;
create policy profile_availability_select_own on profile_availability
  for select to authenticated using (owns_talent_profile(profile_id));

drop policy if exists profile_availability_insert_own on profile_availability;
create policy profile_availability_insert_own on profile_availability
  for insert to authenticated with check (owns_talent_profile(profile_id));

drop policy if exists profile_availability_update_own on profile_availability;
create policy profile_availability_update_own on profile_availability
  for update to authenticated using (owns_talent_profile(profile_id))
  with check (owns_talent_profile(profile_id));

drop policy if exists profile_availability_delete_own on profile_availability;
create policy profile_availability_delete_own on profile_availability
  for delete to authenticated using (owns_talent_profile(profile_id));

-- New tables are not auto-exposed to the Data API (see auto_expose_new_tables in
-- config.toml), so the grants have to be explicit or PostgREST returns 404. RLS
-- above is the real gate; these grants only decide who may knock.
grant select on availability_tags to anon, authenticated, service_role;
grant select, insert, update, delete on profile_availability to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. The "Currently" free-text lines
--
-- These two ARE free text on purpose — "Teaching at: Broadway Dance Center" is a
-- fact about one person, not a facet anyone would filter by. Everything meant
-- for search went into availability_tags above.
-- ---------------------------------------------------------------------------
alter table talent_profiles add column if not exists teaching_at  text;
alter table talent_profiles add column if not exists touring_with text;

-- ---------------------------------------------------------------------------
-- 5. Roster view — expose availability_slugs alongside the other facets
--
-- Recreated wholesale (CREATE OR REPLACE cannot add a column to a view).
-- Everything else is byte-for-byte the previous definition.
-- ---------------------------------------------------------------------------
drop view if exists roster_profiles;

create view roster_profiles as
  select
    profile_id,
    user_id,
    display_name,
    public_slug,
    primary_role,
    city,
    state_province,
    country,
    region_id,
    headshot_url,
    verification_flag,
    honorifics,
    years_experience,
    search_tsv,
    coalesce((select array_agg(distinct s.slug)
                from profile_styles ps join styles s on s.id = ps.style_id
               where ps.profile_id = p.profile_id), '{}'::text[]) as style_slugs,
    coalesce((select array_agg(distinct l.slug)
                from profile_levels pl join levels l on l.id = pl.level_id
               where pl.profile_id = p.profile_id), '{}'::text[]) as level_slugs,
    coalesce((select array_agg(distinct c.slug)
                from profile_certifications pc join certifications c on c.id = pc.certification_id
               where pc.profile_id = p.profile_id), '{}'::text[]) as cert_slugs,
    coalesce((select array_agg(distinct a.slug)
                from profile_availability pa join availability_tags a on a.id = pa.availability_tag_id
               where pa.profile_id = p.profile_id), '{}'::text[]) as availability_slugs,
    (exists (select 1 from memberships m
              where m.user_id = p.user_id
                and m.membership_status = 'active'::membership_status)) as owner_active
  from talent_profiles p
  where profile_status = 'published'::publish_status
    and visibility     = 'public'::visibility_status;

-- DROP VIEW threw the old grants away with it. The Roster reads this view with
-- the service-role client only — it is deliberately NOT readable by anon or
-- authenticated, because discovery is a paid member benefit gated in the page.
-- Forgetting this line makes the Roster silently return zero rows.
grant select on roster_profiles to service_role;
