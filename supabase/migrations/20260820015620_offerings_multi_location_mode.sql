-- Offering availability becomes multi-select. A professional may offer the SAME
-- service in person AND virtually AND via travel at once — location_mode (a
-- single text value) cannot represent that. Additive: new location_modes array
-- column; the old location_mode column is kept AS-IS (deprecated, unread by new
-- code, never dropped) so no historical value is destroyed.
--
-- "Flexible" is retired (founder decision 2026-08-19) — it had zero differentiated
-- behavior anywhere in the codebase (checked: no distinct filtering, CTA, or
-- display logic), was never the same dimension as in_person/virtual/travel, and
-- becomes redundant now that a professional can just select all three. It is not
-- a selectable option going forward.
--
-- Backfill, so no live offering loses its location on this migration:
--   · a real value ('in_person' | 'virtual' | 'travel')     → that one value, as a one-element array
--   · 'flexible' (one live offering has this: "Adjudication") → ALL THREE modes,
--     the most faithful reading of what "flexible" meant in practice — the
--     offering keeps showing SOME location info instead of silently going blank.
--   · null (two live offerings: "Massage Therapy", "Master Classes")            → stays null
alter table public.professional_offerings
  add column if not exists location_modes text[];

update public.professional_offerings
  set location_modes = case
    when location_mode = 'flexible' then array['in_person', 'virtual', 'travel']
    when location_mode is not null then array[location_mode]
    else null
  end
  where location_modes is null;

comment on column public.professional_offerings.location_modes is
  'Multi-select delivery modes (in_person/virtual/travel). Replaces the single-value location_mode column, which is kept for history/rollback but no longer read by current code.';
