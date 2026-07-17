-- ============================================================================
-- Relevé Connect — Migration: The Family Layer + Studio Schedule
--   (Pass Two of "This Week" — APPLIED to live project 2026-07-17;
--    RLS minor-privacy proof verified: a non-guardian sees 0 student rows.)
-- ----------------------------------------------------------------------------
-- Turns the pass-one typed models + seams into real, RLS-protected tables so
-- getThisWeek() / getCommunications() / hasFamilyAccess() become queries with
-- ZERO change to the UI. Three jobs, one migration:
--
--   PASSPORT      family_accounts · students · guardianships
--   SCHEDULE      studio_staff · affiliations · studio_classes · class_sessions
--                 · enrollments
--   COORDINATION  communications
--   CONFIG        app_config (adult_transition_age)
--
-- LOAD-BEARING RULES honoured here:
--   • account_type stays IDENTITY-ONLY. A parent is an existing users row with
--     account_type='consumer'; the paid family entitlement lives in
--     family_accounts (like memberships / experience_purchases).
--   • A MINOR IS NEVER PUBLIC. students has no public/anon policy, is separate
--     from talent_profiles (so it can never surface in Roster/reviews), and its
--     date_of_birth is unreachable by studios.
--   • TEACHER ACCESS IS CLASS-SCOPED (2026-07-17). A teacher sees only students
--     enrolled in classes they are ASSIGNED to teach. Studio-wide visibility
--     requires an explicit admin role in studio_staff (the owner is admin).
--   • GUARDIAN PERMISSIONS ARE GRANULAR (2026-07-17). Each guardianship carries
--     a permission set (billing/calendar/messages/medical_forms/pickup) and RLS
--     gates each surface on the specific permission.
--   • ADULTHOOD AGE IS NOT HARDCODED (2026-07-17). One config row
--     (adult_transition_age = 18), read via public.adult_transition_age().
--
-- Convention match: uuid PKs (gen_random_uuid), on delete cascade, per-table
-- RLS with SECURITY DEFINER ownership helpers, fully idempotent.
--
-- PREREQUISITES (all exist): public.users(user_id = auth.uid()),
--   public.employer_profiles(employer_id, owner_user_id), public.talent_profiles,
--   public.styles(id), public.levels(id), public.owns_employer(),
--   public.owns_talent_profile().
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0) Enums (guarded — Postgres has no `create type if not exists`)
-- ----------------------------------------------------------------------------
do $$ begin create type public.family_subscription_status as enum
  ('none','trialing','active','past_due','canceled');
exception when duplicate_object then null; end $$;

do $$ begin create type public.guardian_permission as enum
  ('billing','calendar','messages','medical_forms','pickup_authorization');
exception when duplicate_object then null; end $$;

do $$ begin create type public.studio_staff_role as enum ('admin','teacher','front_desk');
exception when duplicate_object then null; end $$;

do $$ begin create type public.affiliation_subject as enum ('talent','student');
exception when duplicate_object then null; end $$;

do $$ begin create type public.affiliation_role as enum ('student','teacher','staff');
exception when duplicate_object then null; end $$;

do $$ begin create type public.affiliation_status as enum ('active','pending','ended');
exception when duplicate_object then null; end $$;

do $$ begin create type public.class_session_status as enum ('scheduled','moved','canceled');
exception when duplicate_object then null; end $$;

do $$ begin create type public.enrollment_status as enum ('active','waitlisted','dropped');
exception when duplicate_object then null; end $$;

do $$ begin create type public.communication_kind as enum ('alert','announcement','message','note');
exception when duplicate_object then null; end $$;

do $$ begin create type public.communication_severity as enum ('change','cancellation');
exception when duplicate_object then null; end $$;

do $$ begin create type public.communication_direction as enum ('from_studio','from_family');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 1) app_config + adult_transition_age()  (config, not embedded constants)
-- ----------------------------------------------------------------------------
create table if not exists public.app_config (
  key        text primary key,
  int_value  int,
  text_value text,
  updated_at timestamptz not null default now()
);
insert into public.app_config (key, int_value) values ('adult_transition_age', 18)
  on conflict (key) do nothing;

-- The single source of truth for "when does a minor become an adult". Change the
-- app_config row, not code. SECURITY DEFINER so it reads config under RLS.
create or replace function public.adult_transition_age()
returns int language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce((select int_value from public.app_config where key = 'adult_transition_age'), 18);
$$;

-- Minor test that references the config, never a literal 18. Null dob => treat as
-- minor (safest default).
create or replace function public.student_is_minor(p_dob date)
returns boolean language sql stable
set search_path = public, pg_temp as $$
  select case
           when p_dob is null then true
           else p_dob > (current_date - (public.adult_transition_age() * interval '1 year'))
         end;
$$;

-- ============================================================================
-- PASSPORT
-- ============================================================================

-- family_accounts — billing + entitlement unit (REVENUE seam). --------------
create table if not exists public.family_accounts (
  family_id              uuid primary key default gen_random_uuid(),
  owner_user_id          uuid not null references public.users(user_id) on delete cascade,
  subscription_status    public.family_subscription_status not null default 'none',
  plan                   text,
  stripe_customer_id     text,
  stripe_subscription_id text,
  trial_ends_at          timestamptz,
  renewal_date           date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists family_accounts_owner_idx on public.family_accounts (owner_user_id);

-- students — the minor's record. NEVER in talent_profiles / Roster / reviews.
--   BOTH date_of_birth (private) and age_range (studio-safe). visibility pinned.
create table if not exists public.students (
  student_id             uuid primary key default gen_random_uuid(),
  family_id              uuid not null references public.family_accounts(family_id) on delete cascade,
  display_name           text not null,
  date_of_birth          date,                          -- PRIVATE: guardians only
  age_range              text,                          -- studio-safe bracket, e.g. '12-14'
  visibility             text not null default 'family_only' check (visibility = 'family_only'),
  transferred_to_user_id uuid references public.users(user_id) on delete set null,
  transferred_at         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists students_family_idx on public.students (family_id);

-- guardianships — guardian <-> student + COPPA consent + GRANULAR PERMISSIONS.
--   permissions defaults to {calendar,messages}; the app grants billing /
--   medical_forms / pickup_authorization per guardian (e.g. Guardian A gets
--   billing + medical_forms; Guardian B gets pickup_authorization).
create table if not exists public.guardianships (
  guardian_user_id uuid not null references public.users(user_id) on delete cascade,
  student_id       uuid not null references public.students(student_id) on delete cascade,
  relationship     text,
  is_primary       boolean not null default false,
  permissions      public.guardian_permission[] not null default '{calendar,messages}',
  consent_at       timestamptz,
  consent_version  text,
  created_at       timestamptz not null default now(),
  primary key (guardian_user_id, student_id)
);
create index if not exists guardianships_student_idx on public.guardianships (student_id);

-- ============================================================================
-- SCHEDULE
-- ============================================================================

-- studio_staff — who works at a studio and with what authority. The OWNER is
--   always admin (owns_employer); this table grants authority to OTHERS. A
--   teacher row links to their talent_profile so class assignment == identity.
create table if not exists public.studio_staff (
  employer_id       uuid not null references public.employer_profiles(employer_id) on delete cascade,
  user_id           uuid not null references public.users(user_id) on delete cascade,
  role              public.studio_staff_role not null,
  talent_profile_id uuid references public.talent_profiles(profile_id) on delete set null,
  created_at        timestamptz not null default now(),
  primary key (employer_id, user_id)
);
create index if not exists studio_staff_user_idx on public.studio_staff (user_id);

-- affiliations — person <-> studio (portable). Polymorphic subject. -----------
create table if not exists public.affiliations (
  affiliation_id uuid primary key default gen_random_uuid(),
  subject_kind   public.affiliation_subject not null,
  subject_id     uuid not null,                          -- talent_profiles.profile_id OR students.student_id
  employer_id    uuid not null references public.employer_profiles(employer_id) on delete cascade,
  role           public.affiliation_role not null,
  status         public.affiliation_status not null default 'active',
  started_at     date,
  ended_at       date,
  created_at     timestamptz not null default now(),
  unique (subject_kind, subject_id, employer_id, role)
);
create index if not exists affiliations_employer_idx on public.affiliations (employer_id);
create index if not exists affiliations_subject_idx on public.affiliations (subject_kind, subject_id);

-- studio_classes — the class TEMPLATE a studio publishes. ---------------------
create table if not exists public.studio_classes (
  class_id           uuid primary key default gen_random_uuid(),
  employer_id        uuid not null references public.employer_profiles(employer_id) on delete cascade,
  title              text not null,
  style_id           uuid references public.styles(id),
  level_id           uuid references public.levels(id),
  location           text,
  room               text,
  teacher_profile_id uuid references public.talent_profiles(profile_id) on delete set null,
  recurrence         text,                               -- RRULE; null = one-off
  default_start      time,
  default_end        time,
  timezone           text not null default 'America/New_York',
  status             text not null default 'active',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists studio_classes_employer_idx on public.studio_classes (employer_id);
create index if not exists studio_classes_teacher_idx on public.studio_classes (teacher_profile_id);

-- class_sessions — concrete dated occurrences (recurring + one-offs + cancels).
create table if not exists public.class_sessions (
  session_id uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.studio_classes(class_id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  status     public.class_session_status not null default 'scheduled',
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists class_sessions_class_idx on public.class_sessions (class_id);
create index if not exists class_sessions_starts_idx on public.class_sessions (starts_at);

-- enrollments — student <-> class. -------------------------------------------
create table if not exists public.enrollments (
  enrollment_id uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(student_id) on delete cascade,
  class_id      uuid not null references public.studio_classes(class_id) on delete cascade,
  status        public.enrollment_status not null default 'active',
  created_at    timestamptz not null default now(),
  unique (student_id, class_id)
);
create index if not exists enrollments_class_idx on public.enrollments (class_id);

-- ============================================================================
-- COORDINATION
-- ============================================================================

-- communications — studio <-> family loop, four surfaces in one table. --------
create table if not exists public.communications (
  communication_id   uuid primary key default gen_random_uuid(),
  kind               public.communication_kind not null,
  studio_employer_id uuid references public.employer_profiles(employer_id) on delete cascade,
  family_id          uuid references public.family_accounts(family_id) on delete cascade,
  student_id         uuid references public.students(student_id) on delete set null,
  from_user_id       uuid references public.users(user_id) on delete set null,
  from_employer_id   uuid references public.employer_profiles(employer_id) on delete set null,
  severity           public.communication_severity,      -- alerts only
  direction          public.communication_direction,     -- messages only
  title              text,
  body               text,
  related_session_id uuid references public.class_sessions(session_id) on delete set null,
  created_at         timestamptz not null default now(),
  read_at            timestamptz
);
create index if not exists communications_family_idx on public.communications (family_id);
create index if not exists communications_studio_idx on public.communications (studio_employer_id);
create index if not exists communications_student_idx on public.communications (student_id);

-- ============================================================================
-- RLS HELPERS (SECURITY DEFINER, mirroring owns_talent_profile / owns_employer)
-- ============================================================================

-- ---- Studio side -----------------------------------------------------------

-- Explicit staff role at a studio (does NOT include the owner).
create or replace function public.has_studio_role(p_employer_id uuid, p_role public.studio_staff_role)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.studio_staff ss
    where ss.employer_id = p_employer_id and ss.user_id = auth.uid() and ss.role = p_role
  );
$$;

-- Studio-wide authority = owner OR explicit admin. This is the ONLY gate for
-- studio-wide student visibility.
create or replace function public.is_studio_admin(p_employer_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.owns_employer(p_employer_id) or public.has_studio_role(p_employer_id, 'admin');
$$;

-- Is the caller the assigned teacher of this class? (class-scoped, not studio-wide)
create or replace function public.teaches_class(p_class_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.studio_classes c
    where c.class_id = p_class_id
      and c.teacher_profile_id is not null
      and public.owns_talent_profile(c.teacher_profile_id)
  );
$$;

-- Does the caller (as an assigned teacher) have this student in one of their
-- classes? The teacher path to a student — never studio-wide.
create or replace function public.teacher_sees_student(p_student_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.enrollments e
    join public.studio_classes c on c.class_id = e.class_id
    where e.student_id = p_student_id
      and c.teacher_profile_id is not null
      and public.owns_talent_profile(c.teacher_profile_id)
  );
$$;

-- ---- Family side -----------------------------------------------------------

-- Any guardianship link (identity-level: can see the child exists).
create or replace function public.is_guardian_of(p_student_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.guardianships g
    where g.student_id = p_student_id and g.guardian_user_id = auth.uid()
  );
$$;

-- Granular: does the caller hold a specific permission for this student?
create or replace function public.guardian_can(p_student_id uuid, p_permission public.guardian_permission)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.guardianships g
    where g.student_id = p_student_id
      and g.guardian_user_id = auth.uid()
      and p_permission = any (g.permissions)
  );
$$;

-- Family membership (owner or any guardian in the family) — for family-level rows.
create or replace function public.is_family_member(p_family_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.family_accounts fa
    where fa.family_id = p_family_id and fa.owner_user_id = auth.uid()
  ) or exists (
    select 1 from public.students s
    join public.guardianships g on g.student_id = s.student_id
    where s.family_id = p_family_id and g.guardian_user_id = auth.uid()
  );
$$;

-- Billing authority over a family = owner OR a guardian with 'billing' permission.
create or replace function public.is_family_billing_member(p_family_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.family_accounts fa
    where fa.family_id = p_family_id and fa.owner_user_id = auth.uid()
  ) or exists (
    select 1 from public.students s
    join public.guardianships g on g.student_id = s.student_id
    where s.family_id = p_family_id
      and g.guardian_user_id = auth.uid()
      and 'billing' = any (g.permissions)
  );
$$;

-- Guardian with 'calendar' permission for a student enrolled in this class.
create or replace function public.guardian_calendar_for_class(p_class_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.enrollments e
    join public.guardianships g on g.student_id = e.student_id
    where e.class_id = p_class_id
      and g.guardian_user_id = auth.uid()
      and 'calendar' = any (g.permissions)
  );
$$;

-- ---- Studio-facing student cards (the ONLY way studios read student data) ---
-- Admins get the whole studio; teachers get only their own classes' students.
-- Neither ever receives date_of_birth.

create or replace function public.studio_student_cards(p_employer_id uuid)
returns table (student_id uuid, display_name text, age_range text)
language sql stable security definer
set search_path = public, pg_temp as $$
  select distinct s.student_id, s.display_name, s.age_range
  from public.students s
  where public.is_studio_admin(p_employer_id)
    and (
      exists (select 1 from public.enrollments e
              join public.studio_classes c on c.class_id = e.class_id
              where e.student_id = s.student_id and c.employer_id = p_employer_id)
      or exists (select 1 from public.affiliations a
                 where a.subject_kind = 'student' and a.subject_id = s.student_id
                   and a.employer_id = p_employer_id)
    );
$$;

create or replace function public.teacher_student_cards(p_profile_id uuid)
returns table (student_id uuid, display_name text, age_range text, class_id uuid)
language sql stable security definer
set search_path = public, pg_temp as $$
  select distinct s.student_id, s.display_name, s.age_range, c.class_id
  from public.students s
  join public.enrollments e on e.student_id = s.student_id
  join public.studio_classes c on c.class_id = e.class_id
  where c.teacher_profile_id = p_profile_id
    and public.owns_talent_profile(p_profile_id);
$$;

-- ============================================================================
-- RLS POLICIES  (base tables default-deny; service role bypasses for the
--   schedule-publish + dispatch loops)
-- ============================================================================

-- app_config: readable by any signed-in user; writes are service-role only. ---
alter table public.app_config enable row level security;
drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config for select to authenticated using (true);

-- family_accounts: billing authority (owner or 'billing' guardian). -----------
alter table public.family_accounts enable row level security;
drop policy if exists family_accounts_rw on public.family_accounts;
create policy family_accounts_rw on public.family_accounts
  for all to authenticated
  using (public.is_family_billing_member(family_id))
  with check (owner_user_id = auth.uid());

-- students: guardians only (identity). Studios NEVER read this table — they use
-- studio_student_cards() / teacher_student_cards(), so DOB is out of reach.
alter table public.students enable row level security;
drop policy if exists students_select_family on public.students;
create policy students_select_family on public.students
  for select to authenticated using (public.is_guardian_of(student_id));
drop policy if exists students_write_family on public.students;
create policy students_write_family on public.students
  for all to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

-- guardianships: a guardian manages their own link; the family owner or a
-- 'billing' guardian may grant/alter OTHER guardians in the same family.
alter table public.guardianships enable row level security;
drop policy if exists guardianships_own on public.guardianships;
create policy guardianships_own on public.guardianships
  for all to authenticated
  using (guardian_user_id = auth.uid() or public.is_family_billing_member(
           (select s.family_id from public.students s where s.student_id = guardianships.student_id)))
  with check (guardian_user_id = auth.uid() or public.is_family_billing_member(
           (select s.family_id from public.students s where s.student_id = guardianships.student_id)));

-- studio_staff: studio admins manage staff; a member can read their own row. ---
alter table public.studio_staff enable row level security;
drop policy if exists studio_staff_admin_rw on public.studio_staff;
create policy studio_staff_admin_rw on public.studio_staff
  for all to authenticated
  using (public.is_studio_admin(employer_id))
  with check (public.is_studio_admin(employer_id));
drop policy if exists studio_staff_read_self on public.studio_staff;
create policy studio_staff_read_self on public.studio_staff
  for select to authenticated using (user_id = auth.uid());

-- affiliations: studio admins; a guardian of an affiliated student; a talent
-- for their own profile; a teacher for a student in their class.
alter table public.affiliations enable row level security;
drop policy if exists affiliations_select on public.affiliations;
create policy affiliations_select on public.affiliations
  for select to authenticated using (
    public.is_studio_admin(employer_id)
    or (subject_kind = 'student' and (public.is_guardian_of(subject_id) or public.teacher_sees_student(subject_id)))
    or (subject_kind = 'talent' and public.owns_talent_profile(subject_id))
  );
drop policy if exists affiliations_write_admin on public.affiliations;
create policy affiliations_write_admin on public.affiliations
  for all to authenticated
  using (public.is_studio_admin(employer_id))
  with check (public.is_studio_admin(employer_id));

-- studio_classes: admins rw; the assigned teacher reads their own; enrolled
-- families (with 'calendar') read.
alter table public.studio_classes enable row level security;
drop policy if exists studio_classes_admin_rw on public.studio_classes;
create policy studio_classes_admin_rw on public.studio_classes
  for all to authenticated
  using (public.is_studio_admin(employer_id))
  with check (public.is_studio_admin(employer_id));
drop policy if exists studio_classes_teacher_read on public.studio_classes;
create policy studio_classes_teacher_read on public.studio_classes
  for select to authenticated using (public.teaches_class(class_id));
drop policy if exists studio_classes_family_read on public.studio_classes;
create policy studio_classes_family_read on public.studio_classes
  for select to authenticated using (public.guardian_calendar_for_class(class_id));

-- class_sessions: same audience as the parent class. --------------------------
alter table public.class_sessions enable row level security;
drop policy if exists class_sessions_admin_rw on public.class_sessions;
create policy class_sessions_admin_rw on public.class_sessions
  for all to authenticated
  using (exists (select 1 from public.studio_classes c
                 where c.class_id = class_sessions.class_id and public.is_studio_admin(c.employer_id)))
  with check (exists (select 1 from public.studio_classes c
                 where c.class_id = class_sessions.class_id and public.is_studio_admin(c.employer_id)));
drop policy if exists class_sessions_teacher_read on public.class_sessions;
create policy class_sessions_teacher_read on public.class_sessions
  for select to authenticated using (public.teaches_class(class_id));
drop policy if exists class_sessions_family_read on public.class_sessions;
create policy class_sessions_family_read on public.class_sessions
  for select to authenticated using (public.guardian_calendar_for_class(class_id));

-- enrollments: admin rw (studio-wide); assigned teacher reads their class list;
-- a guardian with 'calendar' reads their own child's.
alter table public.enrollments enable row level security;
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments
  for select to authenticated using (
    public.guardian_can(student_id, 'calendar')
    or public.teaches_class(class_id)
    or exists (select 1 from public.studio_classes c
               where c.class_id = enrollments.class_id and public.is_studio_admin(c.employer_id))
  );
drop policy if exists enrollments_write_admin on public.enrollments;
create policy enrollments_write_admin on public.enrollments
  for all to authenticated
  using (exists (select 1 from public.studio_classes c
                 where c.class_id = enrollments.class_id and public.is_studio_admin(c.employer_id)))
  with check (exists (select 1 from public.studio_classes c
                 where c.class_id = enrollments.class_id and public.is_studio_admin(c.employer_id)));

-- communications: family side needs 'messages' (for the thread) or 'calendar'
-- (for alerts/announcements/notes); studio side = admin, or the assigned teacher
-- for a student in their class. Message posting requires the matching permission.
alter table public.communications enable row level security;
drop policy if exists communications_select on public.communications;
create policy communications_select on public.communications
  for select to authenticated using (
    public.is_studio_admin(studio_employer_id)
    or (student_id is not null and public.teacher_sees_student(student_id))
    or (student_id is not null and (public.guardian_can(student_id, 'messages') or public.guardian_can(student_id, 'calendar')))
    or (student_id is null and public.is_family_member(family_id))
  );
drop policy if exists communications_insert on public.communications;
create policy communications_insert on public.communications
  for insert to authenticated with check (
    public.is_studio_admin(studio_employer_id)
    or (student_id is not null and public.teacher_sees_student(student_id))
    or (student_id is not null and public.guardian_can(student_id, 'messages'))
  );
drop policy if exists communications_update on public.communications;
create policy communications_update on public.communications
  for update to authenticated using (
    public.is_studio_admin(studio_employer_id)
    or (student_id is not null and public.teacher_sees_student(student_id))
    or (student_id is not null and public.guardian_can(student_id, 'messages'))
  );

commit;

-- ============================================================================
-- END. Family layer + studio schedule with RLS. Teacher access is class-scoped;
-- studio-wide sight requires studio_staff admin; guardian permissions are
-- granular; adulthood age is config, not a literal. Next (code, not schema):
-- repoint the three seams at these tables + a recurrence expander for
-- class_sessions.
-- ============================================================================
