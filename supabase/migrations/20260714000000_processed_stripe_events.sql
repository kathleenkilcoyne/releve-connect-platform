-- ============================================================================
-- Relevé Connect — Migration: processed_stripe_events (webhook idempotency)
-- ----------------------------------------------------------------------------
-- WHAT THIS DOES
--   Adds a dedupe ledger so the Stripe webhook can process each event AT MOST
--   ONCE, even though Stripe delivers events at-least-once (5xx retries, network
--   hiccups, manual re-sends from the dashboard).
--
--     1. processed_stripe_events → NEW. One row per Stripe event id the webhook
--        has finished handling. The webhook checks this table on entry and, only
--        AFTER a handler succeeds, records the event id. Combined with the
--        per-row status guards already in the handlers, this makes fulfillment
--        doubly idempotent — no double access grants, no duplicate emails.
--     2. Re-affirms the index on experience_purchases.stripe_checkout_session_id
--        (the webhook's lookup key). Already created in the Connect migration;
--        repeated here with IF NOT EXISTS so this file stands on its own.
--
-- SAFE TO RUN MORE THAN ONCE. CREATE ... IF NOT EXISTS throughout.
--
-- RLS: enabled with NO policies — like experience_purchases, this table is
--   written and read ONLY by the Stripe webhook running as service_role (which
--   bypasses RLS). No client ever needs to touch it.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- processed_stripe_events: one row per fully-handled Stripe event id
-- ----------------------------------------------------------------------------
create table if not exists public.processed_stripe_events (
  event_id   text primary key,
  created_at timestamptz not null default now()
);

alter table public.processed_stripe_events enable row level security;
-- (No policies on purpose — service_role only.)

-- The webhook finds the pending purchase by its Checkout Session id; keep that
-- lookup indexed. Already present from the Connect migration; harmless to repeat.
create index if not exists experience_purchases_session_idx
  on public.experience_purchases (stripe_checkout_session_id);

commit;

-- ============================================================================
-- END. After this runs: the webhook has a durable dedupe ledger and the
-- session-id lookup is indexed. No existing data is touched.
-- ============================================================================
