-- ============================================================================
-- Relevé Connect — Migration: service_availability column-privacy CORRECTION
-- ----------------------------------------------------------------------------
-- ALREADY APPLIED (as `service_availability_column_privacy_fix`). This file
-- records what ran, so the repo's migration history matches the database's.
--
-- ── The bug this fixes ──
-- The previous migration (20260815173044) granted SELECT on a NAMED LIST of
-- columns, deliberately omitting `source_personal_event_id` and `internal_note`,
-- on the belief that this created the private/public boundary the whole
-- Professional Services booking design rests on.
--
-- It created no boundary at all.
--
-- This project carries Supabase's default privileges, which ALREADY grant every
-- privilege on every column of every new public-schema table to `anon` and
-- `authenticated`. A narrower GRANT is therefore purely ADDITIVE — it adds a
-- permission that is already held and revokes nothing. Both "private" columns
-- were selectable by any reader on any row RLS exposed.
--
-- This was caught by querying information_schema.column_privileges on the LIVE
-- database after applying, rather than trusting that the GRANT had done what it
-- looked like it did. The lesson generalises:
--
--   ⚠️  COLUMN-LEVEL PRIVACY REQUIRES `REVOKE` FIRST.
--       On this project a GRANT alone is a false sense of security. Any future
--       table relying on hiding a column from anon/authenticated must revoke the
--       inherited default privileges before granting the narrow list back.
--
-- ── Scope of the damage (none) ──
-- The window between the two migrations was minutes, the feature is flag-gated
-- OFF in production, and both tables were empty throughout. No data was exposed.
--
-- ── What stays writable ──
-- INSERT and UPDATE remain TABLE-level for `authenticated`, deliberately: a
-- professional publishing a window must be able to WRITE
-- `source_personal_event_id` to record its provenance. They simply cannot read
-- it back through an RLS client. Owner-facing reads of the private columns go
-- through the service role, exactly as the public profile page and the admin
-- console already do.
--
-- Purely a privilege change: no table, column, constraint, index, policy, or row
-- is created, altered, or deleted.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) service_availability — the private/public column boundary, for real
-- ----------------------------------------------------------------------------
-- Revoke the inherited defaults, THEN grant back only the public columns.
-- Omitted, and therefore not selectable by anon or authenticated at all:
--   · source_personal_event_id  (which private calendar entry this came from)
--   · internal_note             (the professional's own note)
revoke all on public.service_availability from anon, authenticated;

grant select (
  id, profile_id, service_id, starts_at, ends_at, timezone, location,
  status, capacity, booked_count, created_at, updated_at
) on public.service_availability to anon, authenticated;

-- Owner writes still flow through their own session (RLS scopes them to their
-- own rows); table-level so provenance can be recorded on publish.
grant insert, update, delete on public.service_availability to authenticated;

-- ----------------------------------------------------------------------------
-- 2) service_bookings — same treatment
-- ----------------------------------------------------------------------------
-- Withheld from RLS clients: `buyer_note`, the Stripe identifiers, and the whole
-- fee/split breakdown (platform_fee_bps, application_fee_cents,
-- professional_transfer_cents). The two parties see WHAT was booked and whether
-- it is paid; the platform's economics are read server-side only.
revoke all on public.service_bookings from anon, authenticated;

grant select (
  id, availability_id, service_id, profile_id, buyer_user_id,
  amount_cents, currency, pricing_unit, duration_minutes,
  status, payment_status, confirmed_at, cancelled_at, created_at, updated_at
) on public.service_bookings to authenticated;

commit;

-- ============================================================================
-- END. Privilege-only correction. Verified live after applying:
--   · anon         → SELECT on the public columns only
--   · authenticated→ SELECT on the public columns only; INSERT/UPDATE still
--                    cover the private columns so publishing can record them
--   · service_role → unchanged, full access
--
-- ROLLBACK (restores the permissive default — do NOT run without cause):
--   begin;
--   grant all on public.service_availability to anon, authenticated;
--   grant all on public.service_bookings      to anon, authenticated;
--   commit;
-- ============================================================================
