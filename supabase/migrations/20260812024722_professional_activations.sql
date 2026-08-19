-- ============================================================================
-- Relevé Connect — Migration: professional_activations
--   (Professional Roster Activation, Slice 1 —
--    APPLIED to production 2026-08-12, registered version 20260812024722)
-- ----------------------------------------------------------------------------
-- Additive only. Adds ONE new table (the $30 activation + credit LEDGER) and its
-- RLS. Touches no existing table, column, policy, trigger, function, or data.
--
-- This is the payment/credit record that sits ALONGSIDE — never inside — the
-- vetting record (`applications.state`) and the access grant (`memberships`).
--   • status:        pending → active → converted | expired
--   • credit_status: available → applied | forfeited
-- The $30 buys 30 days of access (clock starts at payment) and is a fixed,
-- PRICE-AGNOSTIC credit toward the continuing subscription, applied ONLY if the
-- member continues within the window, else FORFEITED. See
-- docs/PROFESSIONAL-ACTIVATION-MODEL-PLAN.md.
--
-- Nothing reads or writes this table yet (Slice 1 is dormant). The checkout route
-- (service role) and the webhook (service role) populate it in later slices.
--
-- PREREQUISITES (all exist): public.users(user_id = auth.uid()),
--   public.applications(application_id), public.memberships(membership_id).
-- ============================================================================

begin;

create table if not exists public.professional_activations (
  activation_id             uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.users(user_id) on delete cascade,
  -- Which approved application this activation belongs to (kept for audit; may be
  -- null if the application row is later removed — activation history survives).
  application_id            uuid references public.applications(application_id) on delete set null,

  amount_cents              int not null default 3000,      -- what they paid ($30)

  -- Activation lifecycle. Vetting-independent.
  status                    text not null default 'pending'
                              check (status in ('pending','active','converted','expired')),
  access_started_at         timestamptz,                    -- = payment time (clock start)
  access_expires_at         timestamptz,                    -- = access_started_at + 30 days

  -- Credit lifecycle. Time-boxed + forfeitable — never a cash balance.
  credit_cents              int not null default 3000,
  credit_status             text not null default 'available'
                              check (credit_status in ('available','applied','forfeited')),
  credit_applied_at         timestamptz,
  credit_forfeited_at       timestamptz,

  -- Safe reuse of Stripe primitives (kind: 'professional_activation').
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,

  -- The 30-day Professional membership this activation created (the access grant).
  membership_id             uuid references public.memberships(membership_id) on delete set null,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists professional_activations_user_idx
  on public.professional_activations (user_id);
create index if not exists professional_activations_status_idx
  on public.professional_activations (status);

-- RLS: a member may READ their own activation ledger; all writes happen server-
-- side via the service role (checkout route + webhook), which bypasses RLS — a
-- member can never mint or edit their own activation/credit.
alter table public.professional_activations enable row level security;

drop policy if exists professional_activations_select_own on public.professional_activations;
create policy professional_activations_select_own on public.professional_activations
  for select to authenticated
  using (user_id = auth.uid());

commit;

-- ============================================================================
-- END. The activation/credit ledger exists (owner-read, service-role-write) and
-- is dormant. Applying `applications` state or `memberships` access is done
-- elsewhere; this table only records the $30 payment + its time-boxed credit.
-- ============================================================================
