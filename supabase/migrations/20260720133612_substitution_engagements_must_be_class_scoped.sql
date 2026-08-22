-- ============================================================================
-- Relevé Connect — Migration: a substitution must name the class it covers
-- ----------------------------------------------------------------------------
-- ⚠️  RECONSTRUCTED FROM LIVE PRODUCTION STATE — 2026-08-17. DO NOT REAPPLY.
--
-- This file did not exist in Git. The change was applied by hand directly in the
-- Supabase SQL editor on 2026-07-20 and is recorded in the Supabase migration
-- ledger as version `20260720133612 substitution_engagements_must_be_class_scoped`.
-- It is reproduced here from the LIVE database catalog so the repository
-- documents what production actually contains.
--
-- ── Status ──
-- ALREADY APPLIED to production. This file is DOCUMENTATION, not a pending
-- change. The statement below is guarded so an accidental replay is a no-op, but
-- the intent is that it is never executed at all.
--
-- ── How it was reconstructed ──
--   · constraint name + expression → pg_constraint / pg_get_constraintdef()
-- The ORIGINAL text is unrecoverable; only the resulting constraint is known.
--
-- ── What it enforces, and why it matters ──
-- `teaching_engagements` records how a professional is engaged to teach and what
-- they are paid. Its `kind` (enum `engagement_kind`: ongoing · substitution ·
-- one_off) distinguishes a standing assignment from covering a single class.
--
-- An ONGOING engagement can legitimately be studio-wide — "she teaches here" —
-- so `class_id` is nullable in general. A SUBSTITUTION cannot: covering nothing
-- in particular is not a fact about the world. Without this constraint, a
-- substitution with a null class_id would be an unpayable, unattributable row:
-- the compensation model could not tell which session was covered, and The
-- Swing's future "who subbed for what" history would have a hole in it.
--
-- Enforced in the database rather than in application code because it is an
-- invariant about the DATA, not about one code path — a server action, an admin
-- script, and a future Swing booking must all obey it equally.
-- ============================================================================

begin;

-- Guarded rather than the usual `drop constraint if exists` + `add constraint`
-- pattern: dropping a live constraint, even for an instant, is a real change to
-- production, and this file must never make one.
do $$
begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'teaching_engagements'
      and con.conname = 'teaching_engagements_substitution_is_class_scoped'
  ) then
    alter table public.teaching_engagements
      add constraint teaching_engagements_substitution_is_class_scoped
      check (kind <> 'substitution'::engagement_kind or class_id is not null);
  end if;
end $$;

commit;

-- ============================================================================
-- END (reconstruction). Live state confirmed 2026-08-17:
--   CHECK ((kind <> 'substitution'::engagement_kind) OR (class_id IS NOT NULL))
--   on public.teaching_engagements, named
--   teaching_engagements_substitution_is_class_scoped
--
-- ROLLBACK (do not run without cause — it removes a data-integrity guarantee):
--   alter table public.teaching_engagements
--     drop constraint if exists teaching_engagements_substitution_is_class_scoped;
-- ============================================================================
