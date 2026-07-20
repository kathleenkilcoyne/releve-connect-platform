-- ============================================================================
-- COMPENSATION — teaching_engagements + teaching_earnings
--
-- ── The principle (founder direction, 2026-07-20) ──
-- A CLASS defines schedule, location and structure. It says nothing about money.
-- COMPENSATION belongs to the ENGAGEMENT between a teacher and a studio. The
-- same class taught by two teachers can pay two different rates; the same
-- teacher can be paid differently at two studios; and a rate can change next
-- term without rewriting what the class IS. Putting a rate on `studio_classes`
-- would make all three of those impossible.
--
-- ── Why TWO tables, not one ──
-- This is the decision that lets payroll, earnings, dashboards and analytics be
-- built later WITHOUT a redesign:
--
--   teaching_engagements  = the AGREEMENT.  "Kathleen teaches at Bergen Ballet
--                           for $65/hr, effective from June 1."  Mutable.
--                           Answers: what SHOULD this pay?
--
--   teaching_earnings     = the FACT.       "On July 20 she taught 75 minutes
--                           at $65/hr = $81.25, status paid."  Append-only.
--                           Answers: what WAS earned?
--
-- If only the agreement existed, every historical earning would be recomputed
-- from the CURRENT rate — so a raise in September would silently rewrite what
-- August paid, and no payroll report, tax summary or earnings chart could ever
-- be trusted. The ledger snapshots the rate at the moment it was earned, which
-- is precisely what payroll reporting requires.
--
-- ── Built for later, without building it now ──
--   · money is integer CENTS + a currency code — never floats
--   · the ledger denormalises teacher_profile_id and employer_id so earnings can
--     be grouped by person, studio or period WITHOUT joins (dashboards) and so
--     RLS evaluates cheaply
--   · work_date is a DATE, so payroll periods / tax years group naturally
--   · a status lifecycle + payout_batch_id + external_reference give a payroll
--     run somewhere to write back to
--   · source_kind distinguishes a scheduled class from a Swing sub from a
--     one-off, so analytics can segment without schema change
--
-- ── Privacy ──
-- Compensation is among the most sensitive data on the platform. Visibility is
-- role-scoped and deliberately narrow: the TEACHER sees their own, and STUDIO
-- ADMINS (owner or explicit admin) see their studio's, because they pay it.
-- Explicitly excluded: other teachers, front_desk staff, guardians, students.
-- The rule lives in ONE function (`can_see_studio_compensation`) so adding a
-- future 'payroll' or 'bookkeeper' role is a one-function change, not a rewrite
-- of every policy.
-- ============================================================================

begin;

-- ── Config: the Swing rate is a platform constant, not a literal ────────────
-- Founder rule: The Swing pays a flat $50/hr set by Relevé, identical for every
-- teacher. Everything else, the teacher sets. Stored in app_config beside
-- adult_transition_age so it can change without a deploy.
insert into public.app_config (key, int_value)
values ('swing_hourly_rate_cents', 5000)
on conflict (key) do nothing;

create or replace function public.swing_hourly_rate_cents()
returns int language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce((select int_value from public.app_config
                   where key = 'swing_hourly_rate_cents'), 5000);
$$;

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$
begin
  -- How the rate is expressed. Hourly and flat-per-session cover studio
  -- practice; per_student exists for workshop/masterclass models.
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
                 where n.nspname='public' and t.typname='rate_unit') then
    create type public.rate_unit as enum ('hourly', 'per_session', 'per_student');
  end if;

  -- WHERE the number came from. This is provenance, not decoration: a
  -- platform_set rate must not be editable into something else (see trigger).
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
                 where n.nspname='public' and t.typname='rate_source') then
    create type public.rate_source as enum ('platform_set', 'teacher_set', 'negotiated');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
                 where n.nspname='public' and t.typname='engagement_status') then
    create type public.engagement_status as enum ('active', 'ended');
  end if;

  -- What KIND of work produced an earning — lets analytics segment Swing subs
  -- from ongoing teaching without a schema change.
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
                 where n.nspname='public' and t.typname='engagement_kind') then
    create type public.engagement_kind as enum ('ongoing', 'substitution', 'one_off');
  end if;

  -- The payroll lifecycle. 'void' reverses a mistake without deleting history.
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
                 where n.nspname='public' and t.typname='earning_status') then
    create type public.earning_status as enum ('pending', 'approved', 'paid', 'void');
  end if;
end $$;

-- ── The AGREEMENT ───────────────────────────────────────────────────────────
create table if not exists public.teaching_engagements (
  engagement_id     uuid primary key default gen_random_uuid(),
  teacher_profile_id uuid not null references public.talent_profiles(profile_id) on delete cascade,
  employer_id        uuid not null references public.employer_profiles(employer_id) on delete cascade,

  -- NULL = the studio-wide default rate for this teacher.
  -- Set   = an override for one specific class.
  -- Resolution prefers the most specific match (see resolve_teaching_rate).
  class_id           uuid references public.studio_classes(class_id) on delete cascade,

  kind               public.engagement_kind not null default 'ongoing',

  rate_amount_cents  int not null check (rate_amount_cents >= 0),
  rate_unit          public.rate_unit  not null default 'hourly',
  rate_source        public.rate_source not null default 'teacher_set',
  currency           char(3) not null default 'USD',

  -- Effective dating: a raise is a NEW row (or a closed old one), never an
  -- in-place edit, so history stays answerable.
  effective_from     date not null default current_date,
  effective_to       date,

  status             public.engagement_status not null default 'active',
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint teaching_engagements_dates_ordered
    check (effective_to is null or effective_to >= effective_from)
);

create index if not exists teaching_engagements_teacher_idx
  on public.teaching_engagements (teacher_profile_id, effective_from desc);
create index if not exists teaching_engagements_employer_idx
  on public.teaching_engagements (employer_id, effective_from desc);
create index if not exists teaching_engagements_class_idx
  on public.teaching_engagements (class_id) where class_id is not null;

comment on table public.teaching_engagements is
  'The pay AGREEMENT between a teacher and a studio. Classes define schedule/structure only; compensation lives here.';

-- Enforce the platform rate at the DATA layer, not just in the UI.
-- A Swing engagement pays the config rate, full stop: a teacher willing to
-- accept a sub request sight-unseen is relying on that number being uniform, so
-- it must not be editable into something else by any client.
create or replace function public.enforce_platform_rate()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if new.rate_source = 'platform_set' then
    new.rate_amount_cents := public.swing_hourly_rate_cents();
    new.rate_unit         := 'hourly';
    new.currency          := 'USD';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists teaching_engagements_platform_rate on public.teaching_engagements;
create trigger teaching_engagements_platform_rate
  before insert or update on public.teaching_engagements
  for each row execute function public.enforce_platform_rate();

-- ── The FACT (append-only ledger) ───────────────────────────────────────────
create table if not exists public.teaching_earnings (
  earning_id        uuid primary key default gen_random_uuid(),

  -- Which agreement produced it. Nullable so a manual/adjustment line can exist
  -- without inventing a fake engagement.
  engagement_id     uuid references public.teaching_engagements(engagement_id) on delete set null,

  -- Denormalised ON PURPOSE: dashboards group by teacher/studio/period without
  -- joins, RLS evaluates without a lookup, and the row stays meaningful even if
  -- the engagement is later deleted.
  teacher_profile_id uuid not null references public.talent_profiles(profile_id) on delete cascade,
  employer_id        uuid not null references public.employer_profiles(employer_id) on delete cascade,

  -- What was worked. session_id is null for non-session work (a one-off, an
  -- adjustment); the ledger is not limited to scheduled classes.
  session_id        uuid references public.class_sessions(session_id) on delete set null,
  source_kind       public.engagement_kind not null default 'ongoing',

  -- DATE, not timestamp: payroll periods and tax years group on this.
  work_date         date not null,
  minutes           int check (minutes is null or minutes >= 0),

  -- The rate SNAPSHOT — the whole point of the ledger. Never recompute a past
  -- earning from the engagement's current rate.
  rate_amount_cents int not null check (rate_amount_cents >= 0),
  rate_unit         public.rate_unit not null,
  rate_source       public.rate_source not null,

  amount_cents      int not null check (amount_cents >= 0),
  currency          char(3) not null default 'USD',

  status            public.earning_status not null default 'pending',
  approved_at       timestamptz,
  paid_at           timestamptz,

  -- Somewhere for a future payroll run to write back to.
  payout_batch_id     uuid,
  external_reference  text,

  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- One earning per teacher per session: re-running a fulfilment job must not
  -- double-pay. Partial, because session_id is nullable.
  constraint teaching_earnings_one_per_session
    unique nulls not distinct (session_id, teacher_profile_id)
);

create index if not exists teaching_earnings_teacher_period_idx
  on public.teaching_earnings (teacher_profile_id, work_date desc);
create index if not exists teaching_earnings_employer_period_idx
  on public.teaching_earnings (employer_id, work_date desc);
create index if not exists teaching_earnings_status_idx
  on public.teaching_earnings (status, work_date desc);
create index if not exists teaching_earnings_batch_idx
  on public.teaching_earnings (payout_batch_id) where payout_batch_id is not null;

comment on table public.teaching_earnings is
  'Append-only ledger of what was actually earned, with the rate snapshotted. Payroll/earnings/analytics read this, never recompute from current rates.';

-- Money that has been PAID is history. Let status move on (e.g. to void, for a
-- reversal) but never let the amount of a paid line be edited underneath it.
create or replace function public.protect_paid_earnings()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if old.status = 'paid' and (
       new.amount_cents      is distinct from old.amount_cents
    or new.rate_amount_cents is distinct from old.rate_amount_cents
    or new.work_date         is distinct from old.work_date
    or new.teacher_profile_id is distinct from old.teacher_profile_id
  ) then
    raise exception
      'Cannot alter a paid earning (%). Void it and record a correcting line instead.',
      old.earning_id;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists teaching_earnings_protect_paid on public.teaching_earnings;
create trigger teaching_earnings_protect_paid
  before update on public.teaching_earnings
  for each row execute function public.protect_paid_earnings();

-- ── Rate resolution ─────────────────────────────────────────────────────────
-- Most specific wins: a class-scoped engagement beats the studio-wide default.
-- Returned as a row so callers get the provenance too, not just a number.
create or replace function public.resolve_teaching_rate(
  p_teacher_profile_id uuid,
  p_employer_id        uuid,
  p_class_id           uuid,
  p_on_date            date default current_date
)
returns table (
  engagement_id     uuid,
  rate_amount_cents int,
  rate_unit         public.rate_unit,
  rate_source       public.rate_source,
  currency          char(3)
)
language sql stable security definer
set search_path = public, pg_temp as $$
  select e.engagement_id, e.rate_amount_cents, e.rate_unit, e.rate_source, e.currency
  from public.teaching_engagements e
  where e.teacher_profile_id = p_teacher_profile_id
    and e.employer_id        = p_employer_id
    and e.status             = 'active'
    and e.effective_from    <= p_on_date
    and (e.effective_to is null or e.effective_to >= p_on_date)
    and (e.class_id is null or e.class_id = p_class_id)
  order by (e.class_id is not null) desc,   -- class-specific first
           e.effective_from desc            -- then most recently effective
  limit 1;
$$;

-- ── Who may see compensation ────────────────────────────────────────────────
-- ONE function, so widening this later (a 'payroll' or 'bookkeeper' role) is a
-- single edit rather than a rewrite of four policies.
-- Note this is NOT is_studio_admin alone: front_desk and teacher staff roles are
-- excluded on purpose. Studio-wide compensation sight is owner/admin only.
create or replace function public.can_see_studio_compensation(p_employer_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.is_studio_admin(p_employer_id);
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.teaching_engagements enable row level security;
alter table public.teaching_earnings    enable row level security;

-- Read: the teacher sees their own; a studio admin sees their studio's.
drop policy if exists teaching_engagements_select on public.teaching_engagements;
create policy teaching_engagements_select on public.teaching_engagements
  for select to authenticated using (
    public.owns_talent_profile(teacher_profile_id)
    or public.can_see_studio_compensation(employer_id)
  );

-- Write: studio admins manage the studio's agreements. A teacher does not
-- self-serve a raise into the table; the founder rule is that the teacher SETS
-- their rate, which the app captures and an admin records — modelling that as
-- teacher-writable would let anyone rewrite their own pay.
drop policy if exists teaching_engagements_write on public.teaching_engagements;
create policy teaching_engagements_write on public.teaching_engagements
  for all to authenticated
  using (public.can_see_studio_compensation(employer_id))
  with check (public.can_see_studio_compensation(employer_id));

drop policy if exists teaching_earnings_select on public.teaching_earnings;
create policy teaching_earnings_select on public.teaching_earnings
  for select to authenticated using (
    public.owns_talent_profile(teacher_profile_id)
    or public.can_see_studio_compensation(employer_id)
  );

-- The ledger is written by the platform (fulfilment / payroll jobs run as the
-- service role, which bypasses RLS) and by studio admins. Never by the teacher
-- who is paid by it.
drop policy if exists teaching_earnings_write on public.teaching_earnings;
create policy teaching_earnings_write on public.teaching_earnings
  for all to authenticated
  using (public.can_see_studio_compensation(employer_id))
  with check (public.can_see_studio_compensation(employer_id));

commit;
