-- ============================================================================
-- Relevé Connect — Migration: Dance Teams umbrella (generalize "college team")
-- ----------------------------------------------------------------------------
-- A rename + generalization, NOT a behavior change. The structure stays binary
-- (studio vs team); team "flavor" is display-only metadata.
--   · employer_profiles.org_type   — widen 'college_team' → the umbrella
--     'dance_team'. There are no college_team rows today, so the UPDATE is a
--     no-op in practice; it is included so the migration is correct even if one
--     were created before deploy.
--   · employer_profiles.team_type   — NEW, nullable. The team's flavor:
--     college | pro_sports | pro_company | independent | other. Display-only;
--     it never branches the join structure.
--   · employer_profiles.member_label — NEW, nullable. What this team calls its
--     members ("Dancers", "Athletes", …). Copy falls back to "Team Members".
-- Additive + backward-compatible: existing studios (org_type='studio') are
-- untouched; the two new columns default to NULL.
-- ============================================================================

begin;

-- Drop the existing org_type check (name is auto-generated / may vary) so we can
-- widen the allowed set. Find it dynamically by its definition.
do $$
declare cn text;
begin
  select conname into cn from pg_constraint
   where conrelid = 'public.employer_profiles'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%org_type%';
  if cn is not null then execute format('alter table public.employer_profiles drop constraint %I', cn); end if;
end $$;

-- Migrate any legacy value to the umbrella (no rows today; safe if one exists).
update public.employer_profiles set org_type = 'dance_team' where org_type = 'college_team';

-- Re-add the check with the generalized set.
alter table public.employer_profiles
  add constraint employer_profiles_org_type_check check (org_type in ('studio', 'dance_team'));

-- The team flavor (display-only) and what the team calls its members.
alter table public.employer_profiles add column if not exists team_type text;
do $$ begin
  alter table public.employer_profiles
    add constraint employer_profiles_team_type_check
    check (team_type in ('college', 'pro_sports', 'pro_company', 'independent', 'other'));
exception when duplicate_object then null; end $$;

alter table public.employer_profiles add column if not exists member_label text;

commit;

-- END.
