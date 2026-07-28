-- ============================================================================
-- Relevé Connect — Migration: ONE invite-only studio onboarding
--   (Kathleen's decision 2026-07-28; spec: STUDIO-ONBOARDING-ONE-FLOW-FROM-KATHLEEN.md)
-- ----------------------------------------------------------------------------
-- Collapses the two-form studio setup into ONE invite-only flow. Kathleen invites
-- a studio owner by name; they follow a secure link, sign in as the invited email,
-- and land in the complete studio setup. Nothing is public until she publishes it.
--
-- WHAT THIS ADDS
--   1. founding_studio_invites — the STUDIO-OWNER invitation (one row per invited
--      studio, bound to an email + a secure token, linked to ONE employer_profiles
--      row). This is DISTINCT from public.studio_invites, which is the FAMILY-join
--      code a studio hands its guardians — do not conflate them.
--   2. employer_profiles.status — the lifecycle
--        invited → in_progress → submitted → approved → live
--      `approved` and `live` are admin-only (Kathleen). Nothing auto-publishes.
--   3. employer_profiles social/video fields — instagram, tiktok, facebook,
--      promo_video_url (all nullable).
--   4. owner_user_id made NULLABLE — an invited-but-unclaimed studio profile has no
--      owner until the invited email signs in and binds. Existing rows all have
--      owners, so this only widens what's allowed.
--   5. Public read RLS: a studio profile is world-readable ONLY when status='live'.
--      invited/in_progress/submitted/approved stay invisible to the public.
--
-- Idempotent (if-not-exists / do-blocks / drop-then-create policies). Prereqs:
-- public.employer_profiles(employer_id, owner_user_id), all already exist.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) employer_profiles — status lifecycle + social/video fields + nullable owner
-- ----------------------------------------------------------------------------
alter table public.employer_profiles
  -- Non-public by default (never 'live'). The invite flow sets 'invited'
  -- explicitly at creation; any row made outside the flow is a private draft.
  add column if not exists status          text not null default 'in_progress',
  add column if not exists instagram       text,
  add column if not exists tiktok          text,
  add column if not exists facebook        text,
  add column if not exists promo_video_url text,
  -- Audit timestamps for the admin queue (nullable; set on each transition).
  add column if not exists submitted_at    timestamptz,
  add column if not exists approved_at     timestamptz,
  add column if not exists live_at         timestamptz;

-- The five allowed lifecycle values, enforced in the DB.
do $$ begin
  alter table public.employer_profiles
    add constraint employer_status_chk
    check (status in ('invited','in_progress','submitted','approved','live'));
exception when duplicate_object then null; end $$;

-- An invited studio profile has no owner yet — it is claimed when the invited
-- email signs in. Widen owner_user_id to allow that unclaimed state.
alter table public.employer_profiles alter column owner_user_id drop not null;

-- Fast "who is live" / "what's in the queue" filtering.
create index if not exists employer_profiles_status_idx
  on public.employer_profiles (status);

-- ── Public read of LIVE studios (spec §7) ──
-- A studio profile is visible to the world ONLY when Kathleen has published it.
-- This policy has no `to` clause, so it applies to anon + authenticated alike.
-- The existing owner/affiliated read policies still let a studio see its own
-- not-yet-live draft; RLS policies are OR-ed, so a non-live row stays private to
-- everyone else.
drop policy if exists employer_profiles_select_public_live on public.employer_profiles;
create policy employer_profiles_select_public_live on public.employer_profiles
  for select using (status = 'live');

-- ----------------------------------------------------------------------------
-- 2) founding_studio_invites — the STUDIO-OWNER invitation
--    (⚠️ NOT public.studio_invites — that is the family-join code. Separate.)
-- ----------------------------------------------------------------------------
create table if not exists public.founding_studio_invites (
  invite_id   uuid primary key default gen_random_uuid(),
  -- The invited studio owner's email. The invite is BOUND to it: only a session
  -- authenticated as this email may claim it.
  email       text not null,
  -- The secure, unguessable token carried in the invitation link.
  token       text not null,
  -- The ONE private studio profile this invite creates or connects to (rule 6).
  employer_id uuid not null references public.employer_profiles(employer_id) on delete cascade,
  -- Mirrors the profile lifecycle for admin convenience. The profile's own
  -- `status` is the source of truth for publication.
  status      text not null default 'invited'
                check (status in ('invited','in_progress','submitted','approved','live','revoked')),
  expires_at  timestamptz,                                   -- null = never expires
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- One token is one token, globally.
create unique index if not exists founding_studio_invites_token_key
  on public.founding_studio_invites (token);
-- One live invitation per email (case-insensitive) — re-inviting reuses the row.
create unique index if not exists founding_studio_invites_email_key
  on public.founding_studio_invites (lower(email));
create index if not exists founding_studio_invites_employer_idx
  on public.founding_studio_invites (employer_id);

-- RLS on, and DELIBERATELY no authenticated policy: default-deny to every user.
-- Only the service role touches this table — the /studio/setup binder and the
-- admin console both run server-side under the service role. A not-yet-bound
-- studio owner is served entirely by the server.
alter table public.founding_studio_invites enable row level security;

commit;

-- ============================================================================
-- END. One invite-only door for studios. The family gate (studio_invites) is
-- untouched and remains a separate concept. Nothing is public until status='live'.
-- ============================================================================
