-- ============================================================================
-- Relevé Connect — Migration: Professional Services, native-booking preparation
-- ----------------------------------------------------------------------------
-- ✅ APPLIED TO PRODUCTION — registered version 20260815173016.
--    (Header corrected 2026-08-17. It previously read "NOT YET APPLIED. Written
--    for review; apply on the founder's word." That was true when the file was
--    written and became false when it was applied, and nobody updated it. A
--    read-only audit on 2026-08-17 verified every object below against the live
--    catalog: the 9 columns, all 6 CHECK constraints, the bookable index, the
--    dropped `booking_url`, and the service_platform_fee_bps() function are all
--    present in Supabase project hmqqxbkhcqspqmsjxodq. Do not treat this file as
--    pending work. Only the comment changed — no SQL below was touched.)
--
-- ── Why ──
-- A Professional Service is NOT an outbound directory listing. The external
-- Booking Link was removed on 2026-08-15 (founder decision) because it took the
-- booking, the money, and the record of the work off Relevé at the first click.
-- The intended flow is:
--
--   Professional Profile → Professional Service → Relevé availability
--     → Book on Relevé → Relevé checkout/payment
--     → professional payout + configurable Relevé platform fee
--
-- This migration adds the FIELDS that flow needs. It does NOT implement Stripe
-- checkout, payouts, or a fee percentage, and it sets NO financial policy — the
-- fee rate is deliberately left UNSET (see §3).
--
-- ── What this reuses rather than reinventing ──
--   * `rate_unit` / `rate_source` enums and the `teaching_earnings` ledger
--     (20260720150000_teaching_engagements.sql) — the money vocabulary already
--     exists for teaching work. Service pricing uses a WIDER unit list (a
--     massage is priced per session, a photo shoot per project), so `pricing_unit`
--     is its own CHECK-constrained text with a documented mapping back to
--     `rate_unit` for the shared ledger.
--   * `experience_purchases`' split shape — amount_cents / application_fee_cents /
--     artist_transfer_cents, status pending|paid|refunded|failed — is the model a
--     service booking's payment row should follow.
--   * `app_config` + a SECURITY DEFINER accessor — how the Swing's $50/hr is
--     configured. The platform fee follows the same pattern (§3).
--
-- ── Deliberately NOT in this migration (needs a founder decision first) ──
--   * The `service_bookings` table (who booked what, when, payment status).
--   * PUBLISHABLE availability. `personal_events` already models a dated
--     'availability' window, but its RLS is owner-only with NO read path for
--     anyone else — by design, because a personal calendar leaks auditions and
--     medical appointments. A buyer must see bookable windows, so booking needs
--     EITHER a separate `service_availability` table OR an explicit publish flag
--     on personal_events. That choice is open; `availability_source` below is the
--     column that will record which one a service uses, so neither answer
--     requires re-architecting this table.
--
-- Idempotent and additive: every column is nullable or defaulted, so existing
-- rows stay valid and the feature behaves exactly as it does today until the
-- booking rail is built.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Retire the external booking pathway
-- ----------------------------------------------------------------------------
-- The column is dropped rather than left dormant: a dead `booking_url` sitting
-- in the schema is an open invitation to re-add the outbound button later. The
-- feature has never been enabled in production, so no member data is affected.
-- (Website and social links stay — they are identity and credibility, not a
-- booking pathway.)
alter table public.professional_services drop column if exists booking_url;

-- ----------------------------------------------------------------------------
-- 2) Pricing, duration, and the booking switch
-- ----------------------------------------------------------------------------
alter table public.professional_services
  -- WHAT IT COSTS. Cents + currency, matching memberships.price_cents and
  -- experience_purchases.amount_cents — never a float, never a display string
  -- for something that will be charged. `rate_display` (the existing free-text
  -- field) stays for services that are NOT bookable and just want to say
  -- "from $85"; once booking is on, `price_cents` is the number that transacts.
  add column if not exists price_cents      integer
    check (price_cents is null or price_cents >= 0),
  add column if not exists currency         char(3) not null default 'USD',

  -- HOW IT IS PRICED. Wider than the teaching `rate_unit` enum because service
  -- work is priced differently: a class musician per class, a massage per
  -- session, a photographer per project. Mapping to `rate_unit` for the shared
  -- earnings ledger: hour→hourly, session|class→per_session, everything else
  -- settles as a flat amount on the booking row.
  add column if not exists pricing_unit     text
    check (pricing_unit is null or pricing_unit in
      ('hour','session','class','day','project','flat','per_student')),

  -- HOW LONG IT TAKES. Drives the calendar block a booking occupies, so it is
  -- minutes (not a human string) from the start.
  add column if not exists duration_minutes integer
    check (duration_minutes is null or (duration_minutes > 0 and duration_minutes <= 1440)),

  -- THE SWITCH. The professional opts THIS service in to native Relevé booking.
  -- Default false: nothing becomes bookable because a column appeared.
  add column if not exists booking_enabled  boolean not null default false,

  -- WHERE BOOKABLE TIME COMES FROM (the availability seam — see the header).
  --   none            = not bookable / no availability wired yet (today)
  --   personal_events = published windows from the member's own calendar
  --   service_windows = a dedicated per-service availability table
  -- Recording the SOURCE means the open decision above can be made later, per
  -- service, without a schema change or a backfill.
  add column if not exists availability_source text not null default 'none'
    check (availability_source in ('none','personal_events','service_windows')),

  -- The member's booking timezone. Per-row for the same reason personal_events
  -- carries one: a professional on tour means a different wall clock each week.
  add column if not exists booking_timezone text,

  -- How much notice they need before a booking starts. Nullable = unset.
  add column if not exists booking_notice_hours integer
    check (booking_notice_hours is null or booking_notice_hours >= 0),

  -- SNAPSHOT of the fee that applied when booking was switched on, in basis
  -- points (1000 = 10.00%). Null = "use the platform default at charge time".
  -- Stored per service so a grandfathered or promotional rate is expressible
  -- later WITHOUT rewriting history — but no value is set here, and none is
  -- implied. See §3.
  add column if not exists platform_fee_bps integer
    check (platform_fee_bps is null or (platform_fee_bps >= 0 and platform_fee_bps <= 10000));

-- A bookable service must actually be priced and timed. Enforced at the data
-- layer so a half-configured service can never be offered for booking.
alter table public.professional_services
  drop constraint if exists professional_services_bookable_is_complete;
alter table public.professional_services
  add constraint professional_services_bookable_is_complete check (
    booking_enabled = false
    or (price_cents is not null and pricing_unit is not null and duration_minutes is not null)
  );

-- Find bookable services (the future "book a massage therapist" query).
create index if not exists professional_services_bookable_idx
  on public.professional_services (category)
  where booking_enabled and status = 'active' and moderation_status <> 'removed';

-- ----------------------------------------------------------------------------
-- 3) The configurable platform fee — plumbing ONLY, no policy
-- ----------------------------------------------------------------------------
-- Mirrors public.swing_hourly_rate_cents(): the number lives in `app_config`
-- (service-role writes only), NOT in code, so changing it is a config edit and
-- never a deploy.
--
-- NO app_config ROW IS INSERTED. The accessor returns NULL when unset, and any
-- future checkout MUST refuse to charge on a NULL fee rather than assume a
-- number. Choosing the rate is a founder decision that has not been made, and
-- nothing here quietly makes it.
create or replace function public.service_platform_fee_bps()
returns int language sql stable security definer
set search_path = public, pg_temp as $$
  select int_value from public.app_config where key = 'service_platform_fee_bps';
$$;

comment on function public.service_platform_fee_bps() is
  'Relevé platform fee on a Professional Service booking, in basis points. NULL until a rate is set in app_config — callers must refuse to charge rather than assume a default.';

commit;

-- ============================================================================
-- END. Adds pricing / duration / booking-switch / availability-source / fee
-- columns to professional_services, drops the retired booking_url, and creates
-- the (unset) platform-fee accessor. No booking, checkout, payout, or fee rate
-- is implemented, and no financial policy is decided.
--
-- STILL TO DECIDE before booking can be built:
--   1. Publishable availability — separate `service_availability` table, or an
--      explicit publish flag on `personal_events`?
--   2. The `service_bookings` table shape (follow experience_purchases).
--   3. The platform fee rate itself.
--
-- ROLLBACK:
--   begin;
--   alter table public.professional_services
--     drop constraint if exists professional_services_bookable_is_complete,
--     drop column if exists price_cents,
--     drop column if exists currency,
--     drop column if exists pricing_unit,
--     drop column if exists duration_minutes,
--     drop column if exists booking_enabled,
--     drop column if exists availability_source,
--     drop column if exists booking_timezone,
--     drop column if exists booking_notice_hours,
--     drop column if exists platform_fee_bps;
--   drop index if exists professional_services_bookable_idx;
--   drop function if exists public.service_platform_fee_bps();
--   alter table public.professional_services add column if not exists booking_url text;
--   commit;
-- ============================================================================
