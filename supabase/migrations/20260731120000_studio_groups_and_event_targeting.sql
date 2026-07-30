-- ============================================================================
-- Relevé Connect — Migration: Smart Calendar Slice C (reusable groups)
-- ----------------------------------------------------------------------------
-- The "enter once" fix. Comp teams are STABLE units scheduled over and over, so
-- they become a SAVED thing (a group), not a per-event re-pick. Additive only —
-- the This Week read path is unchanged: `enrollments` is still the resolved
-- roster it reads. It just becomes DERIVED from an event's targets.
--
--   studio_groups         — a persistent, named roster scoped to one studio
--                           (Jazz 3, Teen Company…). A dancer may be in several.
--   studio_group_members  — group ↔ student.
--   studio_class_groups   — which GROUPS an event targets.
--   studio_class_dancers  — individually-added dancers an event targets (on top
--                           of any groups). These two + studio_wide are the
--                           event's TARGETS; enrollments is recomputed from them:
--                           enrollments(event) = distinct(members of targeted
--                           groups ∪ individually-added dancers).
--
-- Boundary: groups exist ONLY for schedule targeting. No registration, tuition,
-- costumes, attendance, or payroll.
--
-- RLS: studio-admin only (owner or studio_staff admin), scoped to the studio —
-- a studio can only reach its own groups and its own affiliated dancers. Writes
-- run under the service role from routes already scoped to the caller's studio;
-- these policies are the default-deny backstop.
-- ============================================================================

begin;

create table if not exists public.studio_groups (
  group_id    uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles(employer_id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (employer_id, name)
);
create index if not exists studio_groups_employer_idx on public.studio_groups (employer_id);

create table if not exists public.studio_group_members (
  group_id   uuid not null references public.studio_groups(group_id) on delete cascade,
  student_id uuid not null references public.students(student_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, student_id)
);
create index if not exists studio_group_members_student_idx on public.studio_group_members (student_id);

create table if not exists public.studio_class_groups (
  class_id uuid not null references public.studio_classes(class_id) on delete cascade,
  group_id uuid not null references public.studio_groups(group_id) on delete cascade,
  primary key (class_id, group_id)
);
create index if not exists studio_class_groups_group_idx on public.studio_class_groups (group_id);

create table if not exists public.studio_class_dancers (
  class_id   uuid not null references public.studio_classes(class_id) on delete cascade,
  student_id uuid not null references public.students(student_id) on delete cascade,
  primary key (class_id, student_id)
);

-- ── RLS (studio-admin only) ─────────────────────────────────────────────────
alter table public.studio_groups enable row level security;
drop policy if exists studio_groups_admin_rw on public.studio_groups;
create policy studio_groups_admin_rw on public.studio_groups
  for all to authenticated
  using (public.is_studio_admin(employer_id))
  with check (public.is_studio_admin(employer_id));

alter table public.studio_group_members enable row level security;
drop policy if exists studio_group_members_admin_rw on public.studio_group_members;
create policy studio_group_members_admin_rw on public.studio_group_members
  for all to authenticated
  using (exists (select 1 from public.studio_groups g
                 where g.group_id = studio_group_members.group_id and public.is_studio_admin(g.employer_id)))
  with check (exists (select 1 from public.studio_groups g
                 where g.group_id = studio_group_members.group_id and public.is_studio_admin(g.employer_id)));

alter table public.studio_class_groups enable row level security;
drop policy if exists studio_class_groups_admin_rw on public.studio_class_groups;
create policy studio_class_groups_admin_rw on public.studio_class_groups
  for all to authenticated
  using (exists (select 1 from public.studio_classes c
                 where c.class_id = studio_class_groups.class_id and public.is_studio_admin(c.employer_id)))
  with check (exists (select 1 from public.studio_classes c
                 where c.class_id = studio_class_groups.class_id and public.is_studio_admin(c.employer_id)));

alter table public.studio_class_dancers enable row level security;
drop policy if exists studio_class_dancers_admin_rw on public.studio_class_dancers;
create policy studio_class_dancers_admin_rw on public.studio_class_dancers
  for all to authenticated
  using (exists (select 1 from public.studio_classes c
                 where c.class_id = studio_class_dancers.class_id and public.is_studio_admin(c.employer_id)))
  with check (exists (select 1 from public.studio_classes c
                 where c.class_id = studio_class_dancers.class_id and public.is_studio_admin(c.employer_id)));

commit;

-- END.
