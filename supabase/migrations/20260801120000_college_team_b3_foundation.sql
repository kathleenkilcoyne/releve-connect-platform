-- ============================================================================
-- Relevé Connect — Migration: college-team (B3) foundation
-- ----------------------------------------------------------------------------
-- The Manhattan College team (Option 1). Additive + backward-compatible:
--   · employer_profiles.org_type  — 'studio' (default) | 'college_team'. Lets the
--     coach flow relabel and lets the adult-join path recognise a team.
--   · studio_invites.kind         — 'family' (default) | 'team'. A family code is
--     redeemed only at /join; a team code only via the separate adult pathway —
--     they can never cross-redeem.
--   · students.family_id          — now NULLABLE. A self-managed adult dancer has
--     NO guardian and NO family_account (family_id null), only their transferred
--     record (transferred_to_user_id = their own account). Existing minors keep
--     their family_id unchanged.
--   · students.visibility         — allow 'self_managed' alongside 'family_only'
--     (still never public; the self-member RLS gates it).
-- ============================================================================

begin;

alter table public.employer_profiles add column if not exists org_type text not null default 'studio';
do $$ begin
  alter table public.employer_profiles
    add constraint employer_profiles_org_type_check check (org_type in ('studio', 'college_team'));
exception when duplicate_object then null; end $$;

alter table public.studio_invites add column if not exists kind text not null default 'family';
do $$ begin
  alter table public.studio_invites
    add constraint studio_invites_kind_check check (kind in ('family', 'team'));
exception when duplicate_object then null; end $$;

alter table public.students alter column family_id drop not null;

-- Widen the visibility check to allow the self-managed adult value.
do $$
declare cn text;
begin
  select conname into cn from pg_constraint
   where conrelid = 'public.students'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%visibility%';
  if cn is not null then execute format('alter table public.students drop constraint %I', cn); end if;
end $$;
alter table public.students
  add constraint students_visibility_check check (visibility in ('family_only', 'self_managed'));

commit;

-- END.
