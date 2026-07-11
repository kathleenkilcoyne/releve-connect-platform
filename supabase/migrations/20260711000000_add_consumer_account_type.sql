-- ============================================================================
-- Add 'consumer' to the account_type enum  (ratified 2026-07-11)
-- ----------------------------------------------------------------------------
-- account_type is IDENTITY only. 'consumer' covers individuals who BUY but are
-- neither vetted talent nor an employer studio — e.g. Live Pass members and
-- one-time Senior Spotlight ($499) buyers. What someone bought stays in the
-- entitlements layer (memberships / experience_purchases / founder_distinction),
-- NEVER in account_type.
--
-- Note: the two $499s are DIFFERENT objects and live in DIFFERENT tables —
--   • Studio Growth   = recurring subscription  -> memberships        (employer)
--   • Senior Spotlight = one-time marketplace buy -> experience_purchases (consumer)
-- Never modeled as one SKU.
--
-- Safe/idempotent: appends the value only if it isn't already present.
-- (Postgres appends new enum values at the end; ordering is cosmetic.)
-- ============================================================================

alter type account_type add value if not exists 'consumer';
