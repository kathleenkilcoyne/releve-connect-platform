-- Add "Competition Team" as a team_interest.team_level option.
--
-- Purely additive: widens the existing CHECK constraint by one value. No
-- existing row is touched (all 5 prior values remain valid), no column type
-- changes, nothing else on team_interest is altered. This is the PUBLIC
-- interest-capture field (team_interest.team_level) — NOT
-- employer_profiles.team_type (src/lib/studio/team-types.ts), a separate,
-- unrelated display-only vocabulary for already-onboarded org accounts like
-- Manhattan University Dance Team. Do not confuse the two.
--
-- Stored value: 'competition'. Public-facing label: "Competition Team".

alter table public.team_interest
  drop constraint team_interest_team_level_check;

alter table public.team_interest
  add constraint team_interest_team_level_check
  check (
    team_level is null
    or team_level in ('middle_school', 'high_school', 'college', 'professional', 'competition', 'independent')
  );
