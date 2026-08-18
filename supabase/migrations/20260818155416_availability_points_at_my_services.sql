-- ============================================================================
-- Relevé Connect — Migration: a published availability window can name a My Service
-- ----------------------------------------------------------------------------
-- ✅ APPLIED to production 2026-08-18, on the founder's explicit approval.
--    Ledger version 20260818155416, name `availability_points_at_my_services`.
--
--    VERIFIED AFTER APPLYING:
--      · column present; FK → professional_offerings(id) ON DELETE CASCADE
--      · partial index service_availability_offering_idx present
--      · CHECK service_availability_one_service_ref present
--      · GRANTS — offering_id: SELECT to anon; SELECT/INSERT/UPDATE to
--        authenticated (identical to service_id)
--      · FIREWALL INTACT — source_personal_event_id and internal_note still
--        have NO SELECT for anon or authenticated
--      · CONSTRAINT EXERCISED with real inserts, all six cases correct:
--          published + My Service   → allowed
--          published + BOTH         → rejected
--          published + NEITHER      → rejected
--          booked    + NEITHER      → rejected
--          cancelled + NEITHER      → allowed
--          cancelled + BOTH         → rejected
--        Test rows removed afterwards; service_availability back to 0 rows.
--
-- ── Why ──
-- `service_availability.service_id` references `professional_services` — the
-- OTHER-BUSINESSES table (massage, Pilates, photography, accompanists). It does
-- NOT reference `professional_offerings`, which is **My Services** and the
-- ratified source of truth for what a dance professional offers.
--
-- So a published window could not say "Guest Teaching". The bridge existed but
-- was wired to the wrong table. This adds the missing one.
--
-- ── The boundary this serves (ratified 2026-08-18) ──
-- "Only publish when the member explicitly marks a window public."
--   · `personal_events` is ALWAYS private. Creating one publishes nothing.
--   · Publishing IS the existence of a `service_availability` row.
--   · Unpublishing DELETES that row; it never edits the private event.
--   · Only the SHAPE crosses over — start, end, timezone, and which service.
--     Never the title, category, note or reason. A studio learns WHEN someone
--     is free, never WHY they are not.
-- This migration does not change any of that. It only lets a window that has
-- ALREADY been published name the service it is for.
--
-- ── ⚠ The grant, and why it is not optional ──
-- This table does NOT use table-level SELECT. It uses the REVOKE-then-grant
-- COLUMN-level pattern from 20260815173203, which is what keeps
-- `source_personal_event_id` and `internal_note` unreadable. Confirmed by
-- pre-flight:
--     anon          → NO table-level grants at all (SELECT is per column)
--     authenticated → INSERT/UPDATE/DELETE at table level, SELECT per column
--
-- A new column therefore inherits SELECT for NOBODY. Without the explicit grant
-- below, a studio reading a published window would get every field EXCEPT which
-- service it is for — a null where "Guest Teaching" should be, with no error and
-- no warning. That is why `grant select (offering_id)` is part of this migration
-- and not an afterthought.
--
-- INSERT/UPDATE need no grant: `authenticated` holds those at table level, so
-- the new column is covered. SELECT is the only gap.
--
-- ── Safety ──
-- Additive and nullable. The existing `service_id` path for Professional
-- Services bookings is untouched. Pre-flight: service_availability 0 rows,
-- service_bookings 0 rows, professional_services 0 rows, personal_events 0 rows,
-- and NO application code references `service_availability` at all — there is no
-- path to break. Nothing is dropped, renamed, or written.
-- ============================================================================

-- 1 ── The missing bridge to My Services. ------------------------------------
alter table public.service_availability
  add column if not exists offering_id uuid null
    references public.professional_offerings(id) on delete cascade;

comment on column public.service_availability.offering_id is
  'The My Service (professional_offerings) this published window is for. '
  'Mutually exclusive with service_id, which points at a Professional Service '
  '(the other-businesses table). See service_availability_one_service_ref.';

-- 2 ── Findable by service without scanning. ---------------------------------
create index if not exists service_availability_offering_idx
  on public.service_availability (offering_id)
  where offering_id is not null;

-- 3 ── THE GRANT. See the note above — without this the column is invisible.
grant select (offering_id) on public.service_availability to anon, authenticated;

-- 4 ── Exactly one service reference on a published window. -------------------
-- Founder, 2026-08-18: "Enforce that any published availability window has
-- exactly one of service_id or offering_id set, never both. An unpublished/draft
-- window may have neither if needed."
--
-- A live window (open / held / booked) MUST name exactly one service — a
-- published window that names nothing is not answerable to a studio, and one
-- that names two is ambiguous. A cancelled window may name none.
--
-- Written as `status in ('open','held','booked')` rather than
-- `status <> 'cancelled'` deliberately: if a 'draft' status is ever added, it
-- falls to the permissive branch instead of being silently forced to carry a
-- service. That is the founder's "may have neither if needed", made future-proof.
--
-- BOTH is rejected in every state, including cancelled.
alter table public.service_availability
  add constraint service_availability_one_service_ref check (
    case
      when status in ('open', 'held', 'booked')
        then num_nonnulls(service_id, offering_id) = 1
      else num_nonnulls(service_id, offering_id) <= 1
    end
  );
