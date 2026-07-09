-- ============================================================================
-- Relevé Connect — Migration: Enable Row-Level Security (RLS) on every table
-- ----------------------------------------------------------------------------
-- WHAT THIS DOES
--   Turns on Row-Level Security for all 22 tables and defines the rules for who
--   may read/write each row. Reference "pick-list" tables become world-readable
--   (but client-read-only). Every table holding a person's data is locked so a
--   logged-in user can only touch their OWN rows.
--
-- WHAT THIS DOES NOT DO
--   • It adds NO data and changes/removes NO existing rows. It only switches RLS
--     on and creates policies.
--   • Safe to run more than once: every policy is dropped-if-exists then recreated.
--
-- ROLES (Supabase built-ins) you'll see referenced below:
--   • anon           — a visitor who is NOT logged in.
--   • authenticated  — a logged-in user. auth.uid() returns their id.
--   • service_role   — the trusted server key (src/lib/supabase/admin.ts, Stripe
--                      webhooks, seeding). It BYPASSES RLS entirely, so all the
--                      admin/back-office and seed operations keep working.
--
-- KEY IDEA
--   users.user_id mirrors auth.users.id, so the test "auth.uid() = user_id"
--   means "this row belongs to the person making the request."
--
-- PREREQUISITE: the schema (supabase/setup.sql) must already be applied so these
--   tables exist.
-- ============================================================================

begin;

-- ============================================================================
-- 0 — OWNERSHIP HELPERS
-- ----------------------------------------------------------------------------
-- Most child/join tables don't carry a user_id directly — they point at a
-- talent_profile or an employer. These helpers answer a simple yes/no:
-- "does the current user own that profile / studio?" They are SECURITY DEFINER
-- so they can look past RLS to check ownership (this also avoids policies having
-- to recursively re-check the parent table's RLS).
-- ============================================================================

create or replace function public.owns_talent_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.talent_profiles tp
    where tp.profile_id = p_profile_id
      and tp.user_id = auth.uid()
  );
$$;

create or replace function public.owns_employer(p_employer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.employer_profiles ep
    where ep.employer_id = p_employer_id
      and ep.owner_user_id = auth.uid()
  );
$$;

-- ============================================================================
-- 1 — REFERENCE / LOOKUP TABLES  (public READ, no client writes)
-- ----------------------------------------------------------------------------
-- The controlled vocabularies. Everyone (even logged-out visitors) may SELECT
-- them so search filters and the profile builder can show options. There is NO
-- insert/update/delete policy, so with RLS on, clients cannot write. Only the
-- service_role (seeding / admin) can change these lists.
-- ============================================================================

alter table public.styles enable row level security;
drop policy if exists styles_read_all on public.styles;
create policy styles_read_all on public.styles for select using (true);

alter table public.levels enable row level security;
drop policy if exists levels_read_all on public.levels;
create policy levels_read_all on public.levels for select using (true);

alter table public.focus_areas enable row level security;
drop policy if exists focus_areas_read_all on public.focus_areas;
create policy focus_areas_read_all on public.focus_areas for select using (true);

alter table public.regions enable row level security;
drop policy if exists regions_read_all on public.regions;
create policy regions_read_all on public.regions for select using (true);

alter table public.disciplines enable row level security;
drop policy if exists disciplines_read_all on public.disciplines;
create policy disciplines_read_all on public.disciplines for select using (true);

alter table public.role_types enable row level security;
drop policy if exists role_types_read_all on public.role_types;
create policy role_types_read_all on public.role_types for select using (true);

alter table public.open_to_badges enable row level security;
drop policy if exists open_to_badges_read_all on public.open_to_badges;
create policy open_to_badges_read_all on public.open_to_badges for select using (true);

-- ============================================================================
-- 2 — ACCOUNTS
-- ============================================================================

alter table public.users enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select to authenticated using (user_id = auth.uid());

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists users_delete_own on public.users;
create policy users_delete_own on public.users
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================================
-- 3 — TALENT PROFILE + ITS CHILDREN / JOIN TABLES
-- ----------------------------------------------------------------------------
-- talent_profiles is owned directly via user_id. Everything hanging off it is
-- owned indirectly, checked with owns_talent_profile(profile_id).
-- ============================================================================

alter table public.talent_profiles enable row level security;

drop policy if exists talent_profiles_select_own on public.talent_profiles;
create policy talent_profiles_select_own on public.talent_profiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists talent_profiles_insert_own on public.talent_profiles;
create policy talent_profiles_insert_own on public.talent_profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists talent_profiles_update_own on public.talent_profiles;
create policy talent_profiles_update_own on public.talent_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists talent_profiles_delete_own on public.talent_profiles;
create policy talent_profiles_delete_own on public.talent_profiles
  for delete to authenticated using (user_id = auth.uid());

-- resume_entries ------------------------------------------------------------
alter table public.resume_entries enable row level security;

drop policy if exists resume_entries_select_own on public.resume_entries;
create policy resume_entries_select_own on public.resume_entries
  for select to authenticated using (public.owns_talent_profile(profile_id));

drop policy if exists resume_entries_insert_own on public.resume_entries;
create policy resume_entries_insert_own on public.resume_entries
  for insert to authenticated with check (public.owns_talent_profile(profile_id));

drop policy if exists resume_entries_update_own on public.resume_entries;
create policy resume_entries_update_own on public.resume_entries
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));

drop policy if exists resume_entries_delete_own on public.resume_entries;
create policy resume_entries_delete_own on public.resume_entries
  for delete to authenticated using (public.owns_talent_profile(profile_id));

-- profile_roles -------------------------------------------------------------
alter table public.profile_roles enable row level security;

drop policy if exists profile_roles_select_own on public.profile_roles;
create policy profile_roles_select_own on public.profile_roles
  for select to authenticated using (public.owns_talent_profile(profile_id));

drop policy if exists profile_roles_insert_own on public.profile_roles;
create policy profile_roles_insert_own on public.profile_roles
  for insert to authenticated with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_roles_update_own on public.profile_roles;
create policy profile_roles_update_own on public.profile_roles
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_roles_delete_own on public.profile_roles;
create policy profile_roles_delete_own on public.profile_roles
  for delete to authenticated using (public.owns_talent_profile(profile_id));

-- profile_styles ------------------------------------------------------------
alter table public.profile_styles enable row level security;

drop policy if exists profile_styles_select_own on public.profile_styles;
create policy profile_styles_select_own on public.profile_styles
  for select to authenticated using (public.owns_talent_profile(profile_id));

drop policy if exists profile_styles_insert_own on public.profile_styles;
create policy profile_styles_insert_own on public.profile_styles
  for insert to authenticated with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_styles_update_own on public.profile_styles;
create policy profile_styles_update_own on public.profile_styles
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_styles_delete_own on public.profile_styles;
create policy profile_styles_delete_own on public.profile_styles
  for delete to authenticated using (public.owns_talent_profile(profile_id));

-- profile_levels ------------------------------------------------------------
alter table public.profile_levels enable row level security;

drop policy if exists profile_levels_select_own on public.profile_levels;
create policy profile_levels_select_own on public.profile_levels
  for select to authenticated using (public.owns_talent_profile(profile_id));

drop policy if exists profile_levels_insert_own on public.profile_levels;
create policy profile_levels_insert_own on public.profile_levels
  for insert to authenticated with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_levels_update_own on public.profile_levels;
create policy profile_levels_update_own on public.profile_levels
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_levels_delete_own on public.profile_levels;
create policy profile_levels_delete_own on public.profile_levels
  for delete to authenticated using (public.owns_talent_profile(profile_id));

-- profile_focus_areas -------------------------------------------------------
alter table public.profile_focus_areas enable row level security;

drop policy if exists profile_focus_areas_select_own on public.profile_focus_areas;
create policy profile_focus_areas_select_own on public.profile_focus_areas
  for select to authenticated using (public.owns_talent_profile(profile_id));

drop policy if exists profile_focus_areas_insert_own on public.profile_focus_areas;
create policy profile_focus_areas_insert_own on public.profile_focus_areas
  for insert to authenticated with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_focus_areas_update_own on public.profile_focus_areas;
create policy profile_focus_areas_update_own on public.profile_focus_areas
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_focus_areas_delete_own on public.profile_focus_areas;
create policy profile_focus_areas_delete_own on public.profile_focus_areas
  for delete to authenticated using (public.owns_talent_profile(profile_id));

-- ============================================================================
-- 4 — EMPLOYER PROFILE
-- ============================================================================

alter table public.employer_profiles enable row level security;

drop policy if exists employer_profiles_select_own on public.employer_profiles;
create policy employer_profiles_select_own on public.employer_profiles
  for select to authenticated using (owner_user_id = auth.uid());

drop policy if exists employer_profiles_insert_own on public.employer_profiles;
create policy employer_profiles_insert_own on public.employer_profiles
  for insert to authenticated with check (owner_user_id = auth.uid());

drop policy if exists employer_profiles_update_own on public.employer_profiles;
create policy employer_profiles_update_own on public.employer_profiles
  for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists employer_profiles_delete_own on public.employer_profiles;
create policy employer_profiles_delete_own on public.employer_profiles
  for delete to authenticated using (owner_user_id = auth.uid());

-- ============================================================================
-- 5 — BADGES (self-selected join + credential evidence)
-- ============================================================================

-- profile_open_to_badges ----------------------------------------------------
alter table public.profile_open_to_badges enable row level security;

drop policy if exists profile_open_to_badges_select_own on public.profile_open_to_badges;
create policy profile_open_to_badges_select_own on public.profile_open_to_badges
  for select to authenticated using (public.owns_talent_profile(profile_id));

drop policy if exists profile_open_to_badges_insert_own on public.profile_open_to_badges;
create policy profile_open_to_badges_insert_own on public.profile_open_to_badges
  for insert to authenticated with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_open_to_badges_update_own on public.profile_open_to_badges;
create policy profile_open_to_badges_update_own on public.profile_open_to_badges
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_open_to_badges_delete_own on public.profile_open_to_badges;
create policy profile_open_to_badges_delete_own on public.profile_open_to_badges
  for delete to authenticated using (public.owns_talent_profile(profile_id));

-- profile_credentials -------------------------------------------------------
alter table public.profile_credentials enable row level security;

drop policy if exists profile_credentials_select_own on public.profile_credentials;
create policy profile_credentials_select_own on public.profile_credentials
  for select to authenticated using (public.owns_talent_profile(profile_id));

drop policy if exists profile_credentials_insert_own on public.profile_credentials;
create policy profile_credentials_insert_own on public.profile_credentials
  for insert to authenticated with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_credentials_update_own on public.profile_credentials;
create policy profile_credentials_update_own on public.profile_credentials
  for update to authenticated using (public.owns_talent_profile(profile_id)) with check (public.owns_talent_profile(profile_id));

drop policy if exists profile_credentials_delete_own on public.profile_credentials;
create policy profile_credentials_delete_own on public.profile_credentials
  for delete to authenticated using (public.owns_talent_profile(profile_id));

-- ============================================================================
-- 6 — CONNECTION / CONTACT
-- ----------------------------------------------------------------------------
-- A connection has two parties: the sender (from_user_id) and the person whose
-- profile is being contacted (to_profile_id). Either party may READ it. Only
-- the sender may create it or delete it; either party may UPDATE (e.g. the
-- recipient marking a request "responded").
-- ============================================================================

alter table public.connections enable row level security;

drop policy if exists connections_select_party on public.connections;
create policy connections_select_party on public.connections
  for select to authenticated
  using (from_user_id = auth.uid() or public.owns_talent_profile(to_profile_id));

drop policy if exists connections_insert_sender on public.connections;
create policy connections_insert_sender on public.connections
  for insert to authenticated with check (from_user_id = auth.uid());

drop policy if exists connections_update_party on public.connections;
create policy connections_update_party on public.connections
  for update to authenticated
  using (from_user_id = auth.uid() or public.owns_talent_profile(to_profile_id))
  with check (from_user_id = auth.uid() or public.owns_talent_profile(to_profile_id));

drop policy if exists connections_delete_sender on public.connections;
create policy connections_delete_sender on public.connections
  for delete to authenticated using (from_user_id = auth.uid());

-- shortlists (an employer's saved talent + private notes) --------------------
alter table public.shortlists enable row level security;

drop policy if exists shortlists_select_own on public.shortlists;
create policy shortlists_select_own on public.shortlists
  for select to authenticated using (public.owns_employer(employer_id));

drop policy if exists shortlists_insert_own on public.shortlists;
create policy shortlists_insert_own on public.shortlists
  for insert to authenticated with check (public.owns_employer(employer_id));

drop policy if exists shortlists_update_own on public.shortlists;
create policy shortlists_update_own on public.shortlists
  for update to authenticated using (public.owns_employer(employer_id)) with check (public.owns_employer(employer_id));

drop policy if exists shortlists_delete_own on public.shortlists;
create policy shortlists_delete_own on public.shortlists
  for delete to authenticated using (public.owns_employer(employer_id));

-- ============================================================================
-- 7 — REVIEWS
-- ----------------------------------------------------------------------------
-- Only the two people involved (author = reviewer_id, subject = reviewee_id)
-- may read a review. Only the author may write/edit/delete their own review.
-- (Any future "public reveal" display will be served through the service role
--  or a dedicated policy once that flow is designed.)
-- ============================================================================

alter table public.reviews enable row level security;

drop policy if exists reviews_select_party on public.reviews;
create policy reviews_select_party on public.reviews
  for select to authenticated
  using (reviewer_id = auth.uid() or reviewee_id = auth.uid());

drop policy if exists reviews_insert_author on public.reviews;
create policy reviews_insert_author on public.reviews
  for insert to authenticated with check (reviewer_id = auth.uid());

drop policy if exists reviews_update_author on public.reviews;
create policy reviews_update_author on public.reviews
  for update to authenticated using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());

drop policy if exists reviews_delete_author on public.reviews;
create policy reviews_delete_author on public.reviews
  for delete to authenticated using (reviewer_id = auth.uid());

-- ============================================================================
-- 8 — MEMBERSHIP  (read-own only; writes are service-role ONLY)
-- ----------------------------------------------------------------------------
-- A member may SEE their own membership, but there is deliberately NO client
-- insert/update/delete policy. Membership rows are created/updated by the
-- Stripe webhook running as the service_role — so a member can never edit their
-- own row to grant themselves an "active" membership without paying.
-- ============================================================================

alter table public.memberships enable row level security;

drop policy if exists memberships_select_own on public.memberships;
create policy memberships_select_own on public.memberships
  for select to authenticated using (user_id = auth.uid());

-- ============================================================================
-- 9 — APPLICATIONS  (the intake form)
-- ----------------------------------------------------------------------------
-- Once a submission is tied to an account (user_id), only that person may see
-- or edit it. Nothing is publicly readable.
--
-- NOTE (pre-account drafts): applications.user_id can be NULL for a submission
-- started before the person has an account. Anonymous rows CANNOT be matched by
-- auth.uid(), so an anonymous/"save-and-resume" intake flow must go through a
-- trusted server route (service_role) or a future token-scoped policy. That's a
-- deliberate follow-up, not covered by this owner-only baseline.
-- ============================================================================

alter table public.applications enable row level security;

drop policy if exists applications_select_own on public.applications;
create policy applications_select_own on public.applications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists applications_insert_own on public.applications;
create policy applications_insert_own on public.applications
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists applications_update_own on public.applications;
create policy applications_update_own on public.applications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists applications_delete_own on public.applications;
create policy applications_delete_own on public.applications
  for delete to authenticated using (user_id = auth.uid());

commit;

-- ============================================================================
-- END. After this runs, every table has RLS ON. Clients (anon + authenticated)
-- can only do what the policies above allow; the service_role key still does
-- everything (seeding, admin, webhooks).
-- ============================================================================
