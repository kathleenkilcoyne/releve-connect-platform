-- ============================================================================
-- Relevé Connect — Migration: studio_classes.kind  (studio_class_kind enum)
-- ----------------------------------------------------------------------------
-- ⚠️  RECONSTRUCTED FROM LIVE PRODUCTION STATE — 2026-08-17. DO NOT REAPPLY.
--
-- This file did not exist in Git. The change was applied by hand directly in the
-- Supabase SQL editor on 2026-07-20 and is recorded in the Supabase migration
-- ledger as version `20260720122804 studio_classes_kind`. It is reproduced here
-- from the LIVE database catalog so the repository documents what production
-- actually contains.
--
-- ── Status ──
-- ALREADY APPLIED to production. This file is DOCUMENTATION, not a pending
-- change. Do not run it against a database that already has these objects, and
-- do not treat it as work to be done. Every statement below is written to be a
-- no-op if the object already exists, so an accidental replay changes nothing —
-- but the intent is that it is never executed at all.
--
-- ── How it was reconstructed ──
--   · enum values + order  → pg_enum, ordered by enumsortorder
--   · column type/default  → information_schema.columns
-- The ORIGINAL text is unrecoverable; only the resulting shape is known. The
-- commentary below is inferred from the surrounding migrations and the code that
-- consumes these objects, and is therefore explanatory rather than historical.
--
-- ── Scope note on the enum values ──
-- Live, `studio_class_kind` carries seven labels in this order:
--   class · rehearsal · performance · competition · audition · workshop · deadline
-- The last four were added later by
-- `20260730000000_studio_class_kind_comp_college.sql` (which is in Git and uses
-- `alter type … add value if not exists`). Enum labels keep their creation order,
-- so THIS migration created only the first three.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) The kind of thing on a studio's schedule
-- ----------------------------------------------------------------------------
-- "This Week" renders a studio's calendar, and not every entry on it is a class.
-- A rehearsal, a performance, and (later) a competition or audition all belong on
-- the same timeline but read differently to a family. An enum rather than free
-- text so the calendar's rendering can never be broken by a typo.
--
-- Guarded rather than bare `create type`, which has no IF NOT EXISTS form.
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'studio_class_kind'
  ) then
    create type public.studio_class_kind as enum ('class', 'rehearsal', 'performance');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2) studio_classes gains the discriminator
-- ----------------------------------------------------------------------------
-- NOT NULL with a default of 'class' so every row that existed before this change
-- stays valid and keeps its original meaning — the schedule was all classes until
-- this column existed.
alter table public.studio_classes
  add column if not exists kind public.studio_class_kind not null default 'class';

commit;

-- ============================================================================
-- END (reconstruction). Live state confirmed 2026-08-17:
--   · type   public.studio_class_kind  = enum, 7 labels (3 created here)
--   · column public.studio_classes.kind = studio_class_kind NOT NULL DEFAULT 'class'
--
-- NO ROLLBACK IS OFFERED. `studio_classes.kind` is populated and read by the
-- live "This Week" calendar; dropping it would break production. If this ever
-- needs to be undone, it needs a plan, not a one-liner.
-- ============================================================================
