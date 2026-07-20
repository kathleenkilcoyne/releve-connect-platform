-- ============================================================================
-- "This Week" Pass Two (code wiring) — two additive fixes the recurrence
-- expander needs. No data is moved and no policy changes.
--
-- 1) studio_classes.series_start / series_end
--    A recurrence rule alone cannot place a class on a calendar. "Every Monday"
--    needs a term to run within:
--      · series_start ANCHORS the series — INTERVAL=2 means "every other week
--        counted from here", and COUNT=10 means "ten classes from here". Without
--        an anchor those parts are undefined.
--      · series_start is ALSO the date of a one-off class (recurrence is null).
--      · series_end closes the term, so summer does not inherit spring's classes.
--
-- 2) unique (class_id, starts_at) on class_sessions
--    Sessions are MATERIALISED from the rule the first time a week is opened.
--    That write must be idempotent: two people opening the same week at the same
--    moment, or one person refreshing, must not create the class twice. This key
--    makes the insert safely repeatable via ON CONFLICT DO NOTHING.
--    A studio genuinely running the same class twice at the identical instant
--    would be two different classes (two class_id rows), so this does not
--    constrain any real schedule.
-- ============================================================================

begin;

alter table public.studio_classes
  add column if not exists series_start date,
  add column if not exists series_end   date;

comment on column public.studio_classes.series_start is
  'Anchor for INTERVAL/COUNT and the date of a one-off class (null recurrence).';
comment on column public.studio_classes.series_end is
  'Last date the series runs; null = open-ended.';

-- Guard the constraint so re-running is safe (matches the file''s if-not-exists style).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.class_sessions'::regclass
      and conname  = 'class_sessions_class_id_starts_at_key'
  ) then
    alter table public.class_sessions
      add constraint class_sessions_class_id_starts_at_key unique (class_id, starts_at);
  end if;
end $$;

commit;
