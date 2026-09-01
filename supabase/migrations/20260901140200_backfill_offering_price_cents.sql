-- ============================================================================
-- Relevé Connect — Migration: backfill professional_offerings.price_cents
-- ----------------------------------------------------------------------------
-- Professional Services transaction rail, Phase 1 (2026-09-01). price_cents
-- becomes the canonical monetary value going forward (the builder now writes it
-- on every save — see src/lib/offerings/actions.ts) — this is the one-time
-- backfill for offerings saved BEFORE that change, so an existing amount-priced
-- offering doesn't sit non-bookable forever just because it predates this pass.
--
-- ── What this does ──
-- For every row where price_cents is still null, pricing_type is one of the
-- amount-carrying kinds (fixed/hourly/daily/project/starting_at), and
-- price_display contains a parseable number (e.g. "$60 / hour", "$175", "$600 /
-- day"), extract the number and store it in cents. This is a read of data the
-- professional already entered — not a new value invented on their behalf.
--
-- ── What this deliberately does NOT do ──
--   * Touch pricing_type in ('contact','free','hidden','external') — those never
--     carry an amount and stay exactly as they are (never bookable, by design —
--     see isOfferingBookable).
--   * Touch any row where price_display has no parseable number (defensive; none
--     exist today, but a malformed row is skipped rather than guessed at).
--   * Overwrite any row that already has price_cents set (idempotent — safe to
--     run more than once).
--
-- ── Verified against production data before writing this ──
-- 6 rows total in professional_offerings today, all Kathleen McAree's own real
-- offerings (Geoffrey Doig-Marx and Todd Shanks have zero). Of the 6, only one
-- ("Massage Therapy", $60 / hour) has a parseable amount; the other 5 are
-- pricing_type='contact' with no price_display and are correctly left untouched
-- — this migration does not force a price onto a "Contact for pricing" offering.
-- ============================================================================

begin;

update public.professional_offerings
set price_cents = round(
      replace(
        (regexp_match(price_display, '([0-9][0-9,]*(?:\.[0-9]+)?)'))[1],
        ',', ''
      )::numeric * 100
    )::integer,
    updated_at = now()
where price_cents is null
  and pricing_type in ('fixed', 'hourly', 'daily', 'project', 'starting_at')
  and price_display ~ '[0-9]';

commit;

-- ============================================================================
-- END. Additive data fix only — no schema change, no row deleted, no row with
-- an already-set price_cents touched.
--
-- ROLLBACK: not meaningful to reverse mechanically (would require remembering
-- which rows this migration touched vs. were already set). If ever needed,
-- restore price_cents to null for the specific offerings by id.
-- ============================================================================
