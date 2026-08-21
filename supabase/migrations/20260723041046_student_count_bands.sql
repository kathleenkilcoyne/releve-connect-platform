-- Relevé Connect — Migration: re-band studio student counts (2026-07-23)
--
-- WHY
-- Kathleen applied as a studio owner on 2026-07-23 and found the application
-- never asks how big the studio is — the whole studio branch was one free-text
-- box, so her application captured only "Bergen pac englewood". Studio size is
-- the single most useful fact about an employer (it drives who they need, how
-- often, and eventually which tier fits), so it becomes a real question.
--
-- Her first draft of the bands was `0-50, 50-100, 100-150, 200-above`, which has
-- a HOLE and two OVERLAPS: a studio with 175 students has nowhere to click, and
-- one with exactly 100 fits two boxes. Ratified instead (founder, 2026-07-23):
--
--     under_50   → "Under 50"
--     50_99      → "50–99"
--     100_199    → "100–199"
--     200_plus   → "200+"
--
-- Contiguous, no gaps, no overlap, every possible studio lands in exactly one.
--
-- SAFETY
-- The old bands were `under_100 / 100_299 / 300_plus`. No employer_profiles row
-- has ever set the column (verified against the live DB before writing this), so
-- there is nothing to migrate. The remap below is written anyway, and runs
-- BEFORE the new constraint is applied, so this stays correct if it is ever
-- replayed against a database that does hold old values:
--   under_100 → under_50 is NOT safe (a 90-student studio is not "under 50"),
--   so old under_100 maps to 50_99 — the band that overlaps it most — and
--   100_299 → 100_199, 300_plus → 200_plus. Any such rows are worth a human
--   re-check; they are logged by the notice below.

do $$
declare
  stale integer;
begin
  select count(*) into stale
  from public.employer_profiles
  where student_count_band in ('under_100', '100_299', '300_plus');

  if stale > 0 then
    raise notice 'Re-banding % employer_profiles row(s) from the old student-count bands. These are approximations — worth a human re-check.', stale;
  end if;
end $$;

-- Drop first: the remap writes values the OLD constraint would reject.
alter table public.employer_profiles
  drop constraint if exists employer_student_band_chk;

update public.employer_profiles
set student_count_band = case student_count_band
  when 'under_100' then '50_99'      -- approximate; see note above
  when '100_299'   then '100_199'
  when '300_plus'  then '200_plus'
  else student_count_band
end
where student_count_band in ('under_100', '100_299', '300_plus');

alter table public.employer_profiles
  add constraint employer_student_band_chk
  check (
    student_count_band is null
    or student_count_band in ('under_50', '50_99', '100_199', '200_plus')
  );
