-- ============================================================================
-- Relevé Connect — Migration: comp/college "kinds" for studio_classes (Brick B2)
-- ----------------------------------------------------------------------------
-- The August wedge is competition & college teams, not the rec calendar. The
-- admin schedule entry (concierge) creates studio_classes whose `kind` is one of
-- the comp/college event types. The enum shipped with only class/rehearsal/
-- performance; this adds the four missing comp/college kinds.
--
--   existing:  class · rehearsal · performance
--   added:     competition · audition · workshop · deadline
--
-- Additive only. `class` (the rec-class kind) is intentionally LEFT in the enum
-- for backward compatibility, but the admin UI offers only the comp/college
-- kinds (rehearsal · competition · audition · workshop · performance · deadline).
--
-- ADD VALUE IF NOT EXISTS is idempotent and safe to re-run. We do not USE any of
-- the new values in this migration, so it is safe inside a transaction.
-- ============================================================================

alter type public.studio_class_kind add value if not exists 'competition';
alter type public.studio_class_kind add value if not exists 'audition';
alter type public.studio_class_kind add value if not exists 'workshop';
alter type public.studio_class_kind add value if not exists 'deadline';

-- END.
