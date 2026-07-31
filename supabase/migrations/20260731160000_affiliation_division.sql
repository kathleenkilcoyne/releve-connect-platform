-- ============================================================================
-- Relevé Connect — Migration: studio-controlled Age Division (2026-07-31)
-- ----------------------------------------------------------------------------
-- The studio's classification of a dancer (Junior / Teen / Senior…). It is
-- STUDIO-SCOPED and studio-set — never derived from age (competitions define
-- divisions differently and a dancer can age into a new one mid-season) — so it
-- lives on the `affiliations` row (student ↔ employer), NOT on the family-owned
-- `students` record. `students.age_range` stays as read-only reference.
--
-- The picklist (Mini · Petite · Junior · Pre-Teen · Teen · Senior · Open · Adult)
-- is an app-level constant, deliberately NOT a DB enum, so a studio's set can
-- extend without a migration. Nullable = not yet classified.
-- ============================================================================

alter table public.affiliations add column if not exists division text;

-- END.
