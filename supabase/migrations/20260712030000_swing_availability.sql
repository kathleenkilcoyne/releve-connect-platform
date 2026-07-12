-- ============================================================================
-- Relevé Connect — Migration: The Swing, Slice A — teacher availability (§10)
-- ----------------------------------------------------------------------------
-- The member-controlled opt-in foundation for The Swing (substitute teaching).
-- This slice is TEACHER-SIDE ONLY: it stores whether a teacher is available to
-- sub and the fields a studio's dispatch loop will match on next (styles they'll
-- sub, levels, home base + travel radius, notes). No studio side, no slots, no
-- matching, no reviews yet — those are later slices.
--
-- CONSENT PRINCIPLE (§10, §17 guardrail): opt-in is mandatory and member-
-- controlled. `is_available` defaults FALSE — a teacher NEVER appears in Swing
-- unless they turn it on, and they can turn it off anytime. This is deliberately
-- NOT ambient availability data.
--
-- WHAT THIS ADDS
--   1. swing_availability — one row per teacher (1:1 with talent_profiles): the
--      toggle + home base + travel radius (miles) + notes.
--   2. swing_styles / swing_levels — the styles + levels they'll SUB, chosen
--      independently from their teaching styles/levels (reuses the existing
--      `styles` + the 5 seeded `levels`). Own-row RLS, like profile_styles.
--
-- Idempotent (create-if-not-exists, drop-policy-if-exists then recreate).
-- PREREQUISITE: talent_profiles, styles, levels, and public.owns_talent_profile()
--   all exist.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) swing_availability — the toggle + fields (1:1 with a talent profile)
-- ----------------------------------------------------------------------------
create table if not exists public.swing_availability (
  profile_id          uuid primary key references public.talent_profiles(profile_id) on delete cascade,
  is_available        boolean not null default false,   -- OFF until the teacher opts in (§10)
  home_location       text,                             -- free text now; geocoded for radius later
  travel_radius_miles int check (travel_radius_miles is null or travel_radius_miles >= 0),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Fast lookup of opted-in teachers for the dispatch loop (Slice B).
create index if not exists swing_availability_available_idx
  on public.swing_availability (is_available) where is_available;

-- ----------------------------------------------------------------------------
-- 2) swing_styles / swing_levels — what they'll SUB (independent of teaching set)
-- ----------------------------------------------------------------------------
create table if not exists public.swing_styles (
  profile_id uuid not null references public.talent_profiles(profile_id) on delete cascade,
  style_id   uuid not null references public.styles(id),
  primary key (profile_id, style_id)
);
create index if not exists swing_styles_style_idx on public.swing_styles (style_id);

create table if not exists public.swing_levels (
  profile_id uuid not null references public.talent_profiles(profile_id) on delete cascade,
  level_id   uuid not null references public.levels(id),
  primary key (profile_id, level_id)
);
create index if not exists swing_levels_level_idx on public.swing_levels (level_id);

-- ----------------------------------------------------------------------------
-- 3) RLS — own-row only (a teacher manages only their own Swing availability).
--    Matching (Slice B) will read these server-side via the service role.
-- ----------------------------------------------------------------------------
alter table public.swing_availability enable row level security;
drop policy if exists swing_availability_select_own on public.swing_availability;
create policy swing_availability_select_own on public.swing_availability
  for select to authenticated using (public.owns_talent_profile(profile_id));
drop policy if exists swing_availability_insert_own on public.swing_availability;
create policy swing_availability_insert_own on public.swing_availability
  for insert to authenticated with check (public.owns_talent_profile(profile_id));
drop policy if exists swing_availability_update_own on public.swing_availability;
create policy swing_availability_update_own on public.swing_availability
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));
drop policy if exists swing_availability_delete_own on public.swing_availability;
create policy swing_availability_delete_own on public.swing_availability
  for delete to authenticated using (public.owns_talent_profile(profile_id));

alter table public.swing_styles enable row level security;
drop policy if exists swing_styles_select_own on public.swing_styles;
create policy swing_styles_select_own on public.swing_styles
  for select to authenticated using (public.owns_talent_profile(profile_id));
drop policy if exists swing_styles_insert_own on public.swing_styles;
create policy swing_styles_insert_own on public.swing_styles
  for insert to authenticated with check (public.owns_talent_profile(profile_id));
drop policy if exists swing_styles_update_own on public.swing_styles;
create policy swing_styles_update_own on public.swing_styles
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));
drop policy if exists swing_styles_delete_own on public.swing_styles;
create policy swing_styles_delete_own on public.swing_styles
  for delete to authenticated using (public.owns_talent_profile(profile_id));

alter table public.swing_levels enable row level security;
drop policy if exists swing_levels_select_own on public.swing_levels;
create policy swing_levels_select_own on public.swing_levels
  for select to authenticated using (public.owns_talent_profile(profile_id));
drop policy if exists swing_levels_insert_own on public.swing_levels;
create policy swing_levels_insert_own on public.swing_levels
  for insert to authenticated with check (public.owns_talent_profile(profile_id));
drop policy if exists swing_levels_update_own on public.swing_levels;
create policy swing_levels_update_own on public.swing_levels
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));
drop policy if exists swing_levels_delete_own on public.swing_levels;
create policy swing_levels_delete_own on public.swing_levels
  for delete to authenticated using (public.owns_talent_profile(profile_id));

commit;

-- ============================================================================
-- END. A teacher can now record (own-row) whether they're Available for Swing
-- and what they'll sub. The dispatch loop (Slice B) matches on this server-side.
-- ============================================================================
