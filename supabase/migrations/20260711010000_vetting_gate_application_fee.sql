-- ============================================================================
-- Relevé Connect — Migration: the vetting gate + $30 application fee (Step 2)
-- ----------------------------------------------------------------------------
-- WHAT THIS DOES
--   1. Adds the ADMIN REVIEW fields to `applications` (the lifecycle itself
--      already lives in the existing `state` column — draft / submitted /
--      in-review / approved / more-info / declined — so we don't duplicate it).
--   2. Adds `application_fee_payments` — one row per $30 application-fee attempt,
--      modeled on `experience_purchases`: written ONLY by the server
--      (service_role: the fee-checkout route + the Stripe webhook), read-own by
--      the applicant. Lifecycle: pending -> paid -> (credited | refunded |
--      forfeited); or `waived` for the Founding 25 (no charge).
--
-- WHAT THIS DOES NOT DO
--   • Adds no data; changes/removes no existing rows. Safe to run more than once
--     (idempotent: add-column-if-not-exists, create-table-if-not-exists,
--     drop-policy-if-exists then recreate).
--
-- PREREQUISITE: supabase/setup.sql + the RLS migration are already applied
--   (this reuses the `choreographer_tier` enum and the users/applications tables).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) applications — admin review / decision fields
-- ----------------------------------------------------------------------------
-- NOTE: the geographic state is `state_province` — the column `state` is already
-- the application LIFECYCLE enum and must not be reused for location.
alter table public.applications
  add column if not exists city           text,
  add column if not exists state_province text,
  -- Set when a CHOREOGRAPHER is approved at a marketplace tier
  -- (emerging | established | signature; "featured" is retired — pricing SSOT).
  add column if not exists approved_tier  choreographer_tier,
  -- Editorial honorifics conferred by the admin (Master Teacher, Founding Artist…).
  add column if not exists honorifics     text[] not null default '{}',
  -- Founding-25 invited honorees: the $30 application fee is waived for them.
  add column if not exists is_founding_25 boolean not null default false,
  add column if not exists reviewed_by    uuid references public.users(user_id),
  add column if not exists reviewed_at    timestamptz,
  add column if not exists admin_notes    text;

-- ----------------------------------------------------------------------------
-- 2) application_fee_payments — the $30 fee ledger (mirrors experience_purchases)
-- ----------------------------------------------------------------------------
create table if not exists public.application_fee_payments (
  id                         uuid primary key default gen_random_uuid(),
  application_id             uuid not null references public.applications(application_id) on delete cascade,
  user_id                    uuid references public.users(user_id) on delete set null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text,
  amount_cents               int  not null default 3000,   -- $30.00
  status                     text not null default 'pending'
                               check (status in ('pending','paid','refunded','credited','forfeited','waived')),
  paid_at                    timestamptz,
  resolved_at                timestamptz,                   -- when credited / refunded / forfeited / waived
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists application_fee_payments_application_idx
  on public.application_fee_payments (application_id);
create index if not exists application_fee_payments_pi_idx
  on public.application_fee_payments (stripe_payment_intent_id);

-- ----------------------------------------------------------------------------
-- 3) RLS: applicant may READ their own fee row; ALL writes are service-role only
--    (same shape as memberships — a fee can never be self-granted).
-- ----------------------------------------------------------------------------
alter table public.application_fee_payments enable row level security;

drop policy if exists application_fee_payments_select_own on public.application_fee_payments;
create policy application_fee_payments_select_own on public.application_fee_payments
  for select to authenticated using (user_id = auth.uid());

commit;

-- ============================================================================
-- END. `applications` now carries the review decision; `application_fee_payments`
-- tracks the $30 through paid -> credited/refunded/forfeited (or waived).
-- ============================================================================
