-- ============================================================================
-- Relevé Connect — Migration: Works & Licensing
--   (Licensing as a capability of the Professional Profile —
--    APPLIED to production 2026-08-11, registered version 20260811235453)
-- ----------------------------------------------------------------------------
-- Additive only. Adds ONE column to talent_profiles and ONE new table (works)
-- with two RLS policies. Touches no existing table, column, policy, or data.
-- Mirrors the established owner-scope pattern (`owns_talent_profile`) already
-- used by swing_availability.
--
-- Two gates (per LICENSING-APPLICATION-GUARDRAILS): the person is already vetted
-- (Roster membership), and each work passes a lightweight admin review before it
-- can appear publicly. NOT open self-publish. "Add a Work" creates a DRAFT; only
-- APPROVED work is ever public.
--
-- OUT of scope here (do not add): checkout / Stripe / splits / payouts / Senior
-- Spotlight / rights-exclusivity engine. `license_type` is a freeform note only.
--
-- PREREQUISITES (all exist): public.talent_profiles(profile_id, profile_status,
--   visibility, user_id), public.owns_talent_profile(profile_id).
-- ============================================================================

begin;

-- Available-for-Licensing flag on the profile. Written by the owner exactly like
-- any other talent_profiles field (user_id = auth.uid()); default OFF.
alter table public.talent_profiles
  add column if not exists available_for_licensing boolean not null default false;

-- Works available to license.
create table if not exists public.works (
  work_id           uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.talent_profiles(profile_id) on delete cascade,
  title             text not null,
  work_type         text,   -- solo | duet_trio | group | competition | concert | musical_theatre | educational | other
  style             text,
  cast_size         text,
  duration          text,   -- approximate, e.g. "1:45"
  level_audience    text,
  year_created      int,
  description       text,
  preview_video_url text,
  origin            text,   -- repertory | new
  license_type      text,   -- freeform note this phase (rights engine is parked)
  status            text not null default 'draft'
                     check (status in ('draft','submitted','in_review','returned','approved','declined')),
  review_notes      text,   -- admin note on "returned"/"declined"
  submitted_at      timestamptz,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists works_profile_idx on public.works (profile_id, status);

alter table public.works enable row level security;

-- Artist manages only their own works (mirror swing_availability's owner scope).
drop policy if exists works_owner_all on public.works;
create policy works_owner_all on public.works
  for all to authenticated
  using (public.owns_talent_profile(profile_id))
  with check (public.owns_talent_profile(profile_id));

-- Public may read ONLY approved works on published/public profiles that have the
-- licensing capability switched on (defense in depth — the public page also
-- filters in app code).
drop policy if exists works_public_read on public.works;
create policy works_public_read on public.works
  for select to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.talent_profiles tp
      where tp.profile_id = works.profile_id
        and tp.profile_status = 'published'
        and tp.visibility = 'public'
        and tp.available_for_licensing = true
    )
  );
-- Admin review queue reads via the service-role admin client (no policy needed).

commit;

-- ============================================================================
-- END. talent_profiles gains `available_for_licensing`; `works` exists with
-- owner-only management + approved-only public read. Status lifecycle is
-- enforced in the server actions (draft → submitted → in_review → approved |
-- returned | declined). No existing object was altered.
-- ============================================================================
