-- ============================================================================
-- Relevé Connect — Migration: Stripe Connect + the $499 Signature Experience
-- ----------------------------------------------------------------------------
-- WHAT THIS DOES (see docs/STRIPE-CONNECT-499-LICENSING.md)
--   Adds the data model for the ONE place Relevé uses Stripe Connect: the $499
--   Signature Experience licensing flow. Everything else (memberships) stays a
--   simple one-way charge — this migration does NOT touch that.
--
--     1. talent_profiles  → two new columns for the artist's connected payout
--        account (Express): stripe_account_id + payouts_enabled.
--     2. signature_works   → NEW. The sellable catalog piece ($499 experience).
--        This is the "video reels become sellable catalog pieces" seam from
--        CLAUDE.md §3, built as its own table so nothing is re-architected.
--     3. experience_purchases → NEW. The order / relationship record for one
--        purchase. Written ONLY by the Stripe webhook (service_role).
--     4. memberships       → one new column (source) so an Access membership can
--        record that it was bundled free with a Signature Experience (Year 1).
--
-- SAFE TO RUN MORE THAN ONCE. Every add-column uses IF NOT EXISTS, every table
--   uses CREATE TABLE IF NOT EXISTS, and every policy is dropped-if-exists first.
--
-- PREREQUISITE: supabase/setup.sql (the base schema) and the RLS migration must
--   already be applied.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1 — talent_profiles: the artist's connected payout account (Express)
-- ----------------------------------------------------------------------------
-- stripe_account_id  — the Stripe "acct_…" id created when the artist starts
--                      Express onboarding. Null until they click "Connect payouts".
-- payouts_enabled    — flipped true by the account.updated webhook once Stripe
--                      confirms the artist can be paid. Guardrail: a work can't
--                      be sold with a split until this is true.
-- ----------------------------------------------------------------------------
alter table public.talent_profiles
  add column if not exists stripe_account_id text,
  add column if not exists payouts_enabled  boolean not null default false;

create index if not exists talent_profiles_stripe_account_idx
  on public.talent_profiles (stripe_account_id);

-- ----------------------------------------------------------------------------
-- 2 — signature_works: the sellable $499 catalog piece
-- ----------------------------------------------------------------------------
-- Reuses the existing publish_status enum ('draft' | 'published') so a work is
-- only buyable once the artist publishes it.
-- ----------------------------------------------------------------------------
create table if not exists public.signature_works (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.talent_profiles(profile_id) on delete cascade,

  -- What it is (shown on the sales / paywall page)
  title                 text not null,
  style                 text,
  length_label          text,               -- e.g. '2 min'
  level                 text,
  built_for             text,               -- short: who/what it was made for
  price_cents           int  not null default 49900,   -- $499.00

  -- The gated deliverables (private Vimeo, domain-locked — see §6 of the spec)
  vimeo_performance_url text,
  vimeo_breakdown_url   text,
  count_sheet_url       text,
  music_note            text,
  artistic_intent       text,

  status                publish_status not null default 'draft',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists signature_works_profile_idx on public.signature_works (profile_id);
create index if not exists signature_works_status_idx  on public.signature_works (status);

-- ----------------------------------------------------------------------------
-- 3 — experience_purchases: one purchase = one order + relationship record
-- ----------------------------------------------------------------------------
-- status values: 'pending' (checkout created) → 'paid' (webhook confirmed) →
--                'refunded' | 'failed'. Kept as text + CHECK so it's easy to
--                extend without an enum migration.
-- buyer_user_id is filled by the webhook when it creates/attaches the buyer's
--   Access account, so it is nullable at insert time (checkout collects email).
-- ----------------------------------------------------------------------------
create table if not exists public.experience_purchases (
  id                        uuid primary key default gen_random_uuid(),
  signature_work_id         uuid not null references public.signature_works(id) on delete restrict,
  buyer_user_id             uuid references public.users(user_id) on delete set null,
  buyer_email               text,

  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text,

  amount_cents              int not null,
  application_fee_cents     int not null default 0,   -- Relevé's 20% (0 on founder no-split path)
  artist_transfer_cents     int not null default 0,   -- artist's 80% (= amount on no-split path)

  status                    text not null default 'pending'
                              check (status in ('pending', 'paid', 'refunded', 'failed')),
  access_granted_at         timestamptz,
  welcome_booked_at         timestamptz,
  checkin_booked_at         timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists experience_purchases_work_idx
  on public.experience_purchases (signature_work_id);
create index if not exists experience_purchases_buyer_idx
  on public.experience_purchases (buyer_user_id);
create index if not exists experience_purchases_session_idx
  on public.experience_purchases (stripe_checkout_session_id);
create index if not exists experience_purchases_pi_idx
  on public.experience_purchases (stripe_payment_intent_id);
-- Fast "does this buyer own this work?" gate check.
create index if not exists experience_purchases_gate_idx
  on public.experience_purchases (buyer_user_id, signature_work_id, status);

-- ----------------------------------------------------------------------------
-- 4 — memberships: mark an Access membership bundled with a Signature Experience
-- ----------------------------------------------------------------------------
alter table public.memberships
  add column if not exists source text;   -- e.g. 'signature_experience_bundle'

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- signature_works    — anyone may read a PUBLISHED work (the sales page is
--                      public); the owning artist may read/manage their own
--                      (incl. drafts). Writes otherwise are service_role only.
-- experience_purchases — the buyer may read their OWN purchases; there is NO
--                      client write policy at all. Rows are created and updated
--                      exclusively by the Stripe webhook running as service_role,
--                      so no one can grant themselves access without paying.
-- ============================================================================

alter table public.signature_works enable row level security;

drop policy if exists signature_works_read_published on public.signature_works;
create policy signature_works_read_published on public.signature_works
  for select
  using (status = 'published' or public.owns_talent_profile(profile_id));

drop policy if exists signature_works_insert_own on public.signature_works;
create policy signature_works_insert_own on public.signature_works
  for insert to authenticated with check (public.owns_talent_profile(profile_id));

drop policy if exists signature_works_update_own on public.signature_works;
create policy signature_works_update_own on public.signature_works
  for update to authenticated
  using (public.owns_talent_profile(profile_id))
  with check (public.owns_talent_profile(profile_id));

drop policy if exists signature_works_delete_own on public.signature_works;
create policy signature_works_delete_own on public.signature_works
  for delete to authenticated using (public.owns_talent_profile(profile_id));

alter table public.experience_purchases enable row level security;

drop policy if exists experience_purchases_select_own on public.experience_purchases;
create policy experience_purchases_select_own on public.experience_purchases
  for select to authenticated using (buyer_user_id = auth.uid());
-- (No insert/update/delete policy on purpose — service_role only, like memberships.)

commit;

-- ============================================================================
-- END. After this runs: artists have payout fields, the two Connect tables
-- exist with RLS on, and memberships can record a bundled Access grant. The
-- service_role key (Stripe webhook) still writes everything.
-- ============================================================================
