-- ============================================================================
-- Relevé Connect — Migration: profile_views (Slice 1, "My Professional Home")
-- ----------------------------------------------------------------------------
-- A lightweight, additive view counter for the professional profile. Slice 1's
-- "Profile Activity" surfaces three honest numbers: saves (`shortlists`),
-- inquiries (`connections` of type 'message-request'), and VIEWS — which needs
-- somewhere to live. This is that place.
--
-- Deliberately minimal (PROFESSIONAL-HOME-AND-MESSAGES prompt §Slice 1):
--   * COUNT ONLY for now. Identity-level "who viewed you" is a later PAID
--     feature, so viewer_id is nullable and is NEVER surfaced in Slice 1.
--   * Purely additive: one new table + RLS. Touches nothing in the founding
--     studio pilot, the professional actor wall, or any existing table.
--
-- Writes happen SERVER-SIDE via the service-role admin client when a published
-- public profile is rendered for a non-owner, so there is no client insert path
-- (and thus no insert policy). Reads are owner-only.
-- ============================================================================

begin;

create table if not exists public.profile_views (
  view_id     uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.talent_profiles(profile_id) on delete cascade,
  -- Nullable on purpose: anonymous (logged-out) views are counted too, and the
  -- viewer's identity is intentionally NOT exposed in Slice 1. on delete set
  -- null so a user deletion never destroys the aggregate count.
  viewer_id   uuid references public.users(user_id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists profile_views_profile_idx
  on public.profile_views (profile_id, created_at desc);

alter table public.profile_views enable row level security;

-- The profile owner may read (i.e. count) their own views. No one else can read
-- rows — the raw viewer list stays private until the paid "who viewed you"
-- feature. Inserts are service-role only (no policy → RLS denies non-service).
drop policy if exists profile_views_owner_select on public.profile_views;
create policy profile_views_owner_select on public.profile_views
  for select to authenticated using (
    exists (
      select 1 from public.talent_profiles tp
      where tp.profile_id = profile_views.profile_id
        and tp.user_id = auth.uid()
    )
  );

commit;

-- END.
