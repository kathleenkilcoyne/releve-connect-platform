-- ============================================================================
-- Relevé Connect — Migration: Smart Calendar Slice 2 (event_type + studio_wide)
-- ----------------------------------------------------------------------------
-- The studio's "What are you scheduling?" create flow. The chosen TYPE sets the
-- family-facing label and drives the target-picker; storage stays exactly the
-- existing engine — one studio_class per event, targeting via enrollments — plus
-- the ONE new lane enrollment can't express: the whole studio.
--
--   event_type  — which of the nine types the studio picked (drives label + picker).
--   studio_wide — TRUE = the whole studio sees it (Full Studio Event, or a
--                 whole-studio Parent Meeting). FALSE = targeted via enrollments.
--
-- No other schema. Targeting for classes / teams / duets / trios / privates stays
-- `enrollments` (whoever is enrolled sees it). studio_wide is resolved at read
-- time against `affiliations` (Slice 3) — never fanned out into per-child rows.
-- ============================================================================

alter table public.studio_classes add column if not exists event_type text;
alter table public.studio_classes
  add column if not exists studio_wide boolean not null default false;

-- Keep event_type honest without an enum's migration friction: null (legacy) or
-- one of the nine types.
do $$ begin
  alter table public.studio_classes
    add constraint studio_classes_event_type_check
    check (
      event_type is null or event_type in (
        'class', 'company_rehearsal', 'duet_trio', 'solo_private',
        'full_studio_event', 'parent_meeting', 'competition', 'audition', 'performance'
      )
    );
exception when duplicate_object then null; end $$;

create index if not exists studio_classes_studio_wide_idx
  on public.studio_classes (employer_id) where studio_wide;

-- END.
