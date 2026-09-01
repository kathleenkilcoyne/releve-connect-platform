-- ============================================================================
-- Relevé Connect — Migration: service_bookings can name a My Service (offering)
-- ----------------------------------------------------------------------------
-- Professional Services transaction rail, Phase 1 (2026-09-01, founder-approved
-- design). Mirrors 20260818155416_availability_points_at_my_services.sql EXACTLY
-- — same bug, same fix, one migration later in the chain.
--
-- ── Why ──
-- `service_bookings.service_id` references `professional_services` — the
-- OTHER-BUSINESSES table (massage, Pilates, photography, accompanists), which
-- has no UI and no application code anywhere. It does NOT reference
-- `professional_offerings`, which is **My Offerings / What I Offer** — the
-- ratified, live source of truth for what a dance professional offers (Geoffrey
-- Doig-Marx, Todd Shanks, Kathleen McAree's own 6 real offerings all live there).
--
-- So a real booking of a My Service offering had nowhere to point. This adds the
-- missing bridge, the same way service_availability got one three days earlier
-- in the ledger.
--
-- ── Safety ──
-- Additive and nullable. `service_bookings` has ZERO rows in production (verified
-- 2026-09-01 as part of the audit that proposed this rail) — there is no existing
-- data to migrate or break. The old `service_id` → `professional_services` path
-- is left completely intact for the (currently unused) other-businesses concept;
-- nothing is dropped or renamed.
-- ============================================================================

begin;

-- 1 ── service_id must be nullable so a booking can instead carry offering_id.
alter table public.service_bookings
  alter column service_id drop not null;

-- 2 ── The missing bridge to My Services.
alter table public.service_bookings
  add column if not exists offering_id uuid null
    references public.professional_offerings(id) on delete restrict;

comment on column public.service_bookings.offering_id is
  'The My Service (professional_offerings) this booking is for. Mutually '
  'exclusive with service_id, which points at a Professional Service (the '
  'other-businesses table, currently unused). See '
  'service_bookings_one_service_ref.';

-- 3 ── Findable by offering without scanning (mirrors service_bookings_professional_idx).
create index if not exists service_bookings_offering_idx
  on public.service_bookings (offering_id)
  where offering_id is not null;

-- 4 ── Exactly one service reference on every booking, always. Unlike
-- service_availability (which permits a draft/cancelled row to carry neither,
-- because it can exist before or after being "for" anything), a booking only
-- ever comes into existence FOR a specific service or offering — there is no
-- state where a booking legitimately names nothing.
alter table public.service_bookings
  add constraint service_bookings_one_service_ref check (
    num_nonnulls(service_id, offering_id) = 1
  );

commit;

-- ============================================================================
-- END.
--
-- ROLLBACK:
--   begin;
--   alter table public.service_bookings
--     drop constraint if exists service_bookings_one_service_ref,
--     drop column if exists offering_id;
--   drop index if exists service_bookings_offering_idx;
--   alter table public.service_bookings alter column service_id set not null;
--   commit;
-- ============================================================================
