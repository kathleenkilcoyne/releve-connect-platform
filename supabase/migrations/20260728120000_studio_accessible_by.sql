-- ============================================================================
-- Relevé Connect — Migration: simplify "Getting there" to Accessible-by flags
--   (2026-07-28)
-- ----------------------------------------------------------------------------
-- The studio "Getting there" block was four free-text/select fields. Kathleen
-- replaced it with a single "Accessible by: Train / Bus / Car" checkbox row.
-- This adds the two new boolean flags; the existing `car_required` boolean is
-- reused for "Car / parking".
--
-- The retired fields (nearest_transit, parking, directions_note) are LEFT IN
-- PLACE, columns and data intact — the form just stops reading/writing them.
-- Nothing is dropped or deleted.
--
-- Idempotent (add-column-if-not-exists). Nullable — a studio that ticks nothing
-- simply has no accessibility flags.
-- ============================================================================

begin;

alter table public.employer_profiles
  add column if not exists accessible_by_train boolean,
  add column if not exists accessible_by_bus   boolean;

commit;
