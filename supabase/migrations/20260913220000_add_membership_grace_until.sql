-- 14-day failed-renewal grace period (founder-approved 2026-09-13).
-- Additive, nullable — no backfill, no enum change. NULL means "no grace in
-- effect". Existing rows are unaffected. Enforcement reads this at access-check
-- time (lib/membership/access.ts); nothing writes it automatically on expiry.
alter table memberships
  add column grace_until timestamptz;

comment on column memberships.grace_until is
  'Set by the invoice.payment_failed webhook on a renewal failure (never an initial-payment failure). Membership stays active while now() < grace_until. Cleared on a successful invoice.paid or on cancellation.';
