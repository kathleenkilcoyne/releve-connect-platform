-- ============================================================================
-- Relevé Connect — Migration: profile_trust_events (the trust audit trail)
-- ----------------------------------------------------------------------------
-- ✅ APPLIED to production 2026-08-17, on the founder's explicit approval.
--    Registered in the Supabase migration ledger as version 20260817232844,
--    name `profile_trust_events` — this filename matches that version on
--    purpose. Pre-flight was re-run immediately before applying (table absent,
--    both FK targets present) and verified after (8 columns, 4 constraints,
--    2 indexes, RLS on, zero policies, no anon/authenticated grants).
--
-- ── Why ──
-- Slice 2b lets Relevé confer, correct, or withdraw a trust signal AFTER a
-- profile exists: honorifics, founder_distinction (including Founding 25), and
-- choreographer_tier. Those three columns already exist, so the WRITES need no
-- migration. What needs one is the record of who did it and why.
--
-- Founder, 2026-08-17: "Relevé is a vetted professional network. Traceability is
-- part of the trust model." A badge nobody can account for is decoration. In ten
-- years "Founding 25" should still be answerable: which admin conferred it, when,
-- and on what stated grounds.
--
-- ── What it is ──
-- An append-only log. One row per FIELD per change, so a single admin action that
-- alters two signals writes two rows and each reads on its own. Values are stored
-- as TEXT rather than typed columns on purpose: an audit row must stay readable
-- even if an enum label is later added or a vocabulary is retired, and it must
-- never be re-interpreted by a schema change made years afterwards.
--
-- ── What it is NOT ──
-- Not a source of truth. talent_profiles holds the current values; this explains
-- how they got there. Nothing reads this table to decide anything.
--
-- Additive only: one new table. No existing column, constraint, policy, or row is
-- modified. Safe to run more than once.
-- ============================================================================

begin;

create table if not exists public.profile_trust_events (
  event_id      uuid primary key default gen_random_uuid(),

  -- Whose standing changed. CASCADE: if a profile is deleted the member is gone,
  -- and retaining a log of their revoked honorifics would serve nobody.
  profile_id    uuid not null references public.talent_profiles(profile_id) on delete cascade,

  -- WHO acted. RESTRICT, deliberately: an admin account must not be deletable
  -- while it still has conferrals attributed to it. "Some admin, at some point"
  -- is not an audit trail, and this is the column that makes the record answerable.
  actor_user_id uuid not null references public.users(user_id) on delete restrict,

  -- WHICH signal. `verification_flag` is included for a future slice — the
  -- Verified mark has no admin path yet — so that path will not need a migration.
  field         text not null check (field in (
                  'honorifics', 'founder_distinction', 'choreographer_tier', 'verification_flag')),

  -- Rendered as text: 'none' → 'founding_25', or 'Master Teacher' →
  -- 'Master Teacher, Adaptive Arts Faculty'. Nullable because a first conferral
  -- has no meaningful previous state.
  previous_value text,
  new_value      text,

  -- WHY. Free text, and the console asks for it. A conferral without a stated
  -- reason is exactly what erodes a trust signal over time.
  reason         text,

  created_at     timestamptz not null default now()
);

-- "Show me this profile's history, newest first" — the console's only query.
create index if not exists profile_trust_events_profile_idx
  on public.profile_trust_events (profile_id, created_at desc);

-- "What has this admin conferred?" — for reviewing an admin's own activity.
create index if not exists profile_trust_events_actor_idx
  on public.profile_trust_events (actor_user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS — nobody reads this but the server
-- ----------------------------------------------------------------------------
-- No policy is created, so with RLS enabled the table is unreadable and
-- unwritable through any RLS-scoped client. The admin console reads and writes it
-- with the service role, exactly like the applications queue.
--
-- A member must not be able to read their own trust history: it would expose
-- internal review notes about them, and the profile already shows the OUTCOME.
alter table public.profile_trust_events enable row level security;

-- Explicit Data-API grants are deliberately NOT issued. New tables are not
-- auto-exposed, and this one should stay that way.
revoke all on public.profile_trust_events from anon, authenticated;

comment on table public.profile_trust_events is
  'Append-only audit of Relevé-conferred trust signals (honorifics, founder_distinction, choreographer_tier). Explains how a profile''s current values came to be; never read to decide anything. Service-role only.';

commit;

-- ============================================================================
-- END. Adds public.profile_trust_events + two indexes, RLS on with no policies,
-- and no Data-API exposure. No existing object touched.
--
-- ROLLBACK:
--   begin;
--   drop table if exists public.profile_trust_events;
--   commit;
-- ============================================================================
