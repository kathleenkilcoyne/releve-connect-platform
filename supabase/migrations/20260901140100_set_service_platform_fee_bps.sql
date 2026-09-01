-- ============================================================================
-- Relevé Connect — Migration: set the Professional Services platform fee to 3%
-- ----------------------------------------------------------------------------
-- Professional Services transaction rail, Phase 1 (2026-09-01, founder-ratified
-- rate). The accessor function public.service_platform_fee_bps() has existed
-- since 20260815173016_professional_services_booking_prep.sql, deliberately
-- reading NULL until a rate was approved — "any future checkout MUST refuse to
-- charge when it is NULL." This migration is that approval, nothing else.
--
-- ── The rule this encodes (founder, 2026-09-01) ──
-- The buyer pays the Professional's price PLUS a 3% Relevé booking fee, on top —
-- never a percentage taken from the Professional's own price. 300 basis points.
-- Mirrors the existing swing_hourly_rate_cents pattern: the number lives in
-- app_config (service-role writes only), so changing it later is a config edit,
-- never a deploy.
--
-- ── Scope — what this rate does NOT apply to ──
--   * Senior Spotlight stays completely separate at its own 80/20
--     (PLATFORM_FEE_BPS = 2000, hardcoded in src/lib/stripe/config.ts,
--     experience_purchases) — untouched by this migration.
--   * General licensing/products (Phase 2, not built yet) will get its OWN
--     app_config key (e.g. product_platform_fee_bps) when that phase starts —
--     never layered onto this one, so a future change to either rate can never
--     accidentally affect the other.
-- ============================================================================

begin;

insert into public.app_config (key, int_value)
values ('service_platform_fee_bps', 300)
on conflict (key) do update set int_value = excluded.int_value, updated_at = now();

commit;

-- ============================================================================
-- END.
--
-- ROLLBACK (returns the rail to its "refuse to charge" state, not a deploy):
--   delete from public.app_config where key = 'service_platform_fee_bps';
-- ============================================================================
