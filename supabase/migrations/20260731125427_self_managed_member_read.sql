-- ============================================================================
-- Relevé Connect — Migration: self-managed member read path (Slice 3, Phase D)
-- ----------------------------------------------------------------------------
-- Option A for the Manhattan College team: an ADULT, self-managed dancer with NO
-- guardian layer. They are a `students` row whose adulthood was transferred to
-- their own account (`transferred_to_user_id = auth.uid()`) — the table already
-- carries these transfer columns for exactly this. Their week resolves per-self:
-- own enrollments + their team's studio_wide events; no guardianship, no sibling
-- merge (studio-wide de-dupe by session id still holds in the merge layer).
--
-- These are ADDITIVE, grant-only SELECT policies that mirror the guardian lane
-- for a self member — they never weaken the existing rules. A self member can
-- read ONLY their own transferred record and the schedule targeted at them.
-- ============================================================================

begin;

-- The caller's own adulthood-transferred record.
create or replace function public.is_self_student(p_student_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.students s
    where s.student_id = p_student_id and s.transferred_to_user_id = auth.uid()
  );
$$;

-- The caller (as a self member) is enrolled in this class.
create or replace function public.self_calendar_for_class(p_class_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.enrollments e
    join public.students s on s.student_id = e.student_id
    where e.class_id = p_class_id and e.status = 'active'
      and s.transferred_to_user_id = auth.uid()
  );
$$;

-- The class is studio-wide and the caller (self member) is affiliated to its studio.
create or replace function public.self_sees_studio_wide(p_class_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.studio_classes c
    join public.affiliations a
      on a.employer_id = c.employer_id and a.subject_kind = 'student' and a.status = 'active'
    join public.students s on s.student_id = a.subject_id
    where c.class_id = p_class_id and c.studio_wide = true
      and s.transferred_to_user_id = auth.uid()
  );
$$;

-- Read own record / enrollments / affiliation.
drop policy if exists students_self_read on public.students;
create policy students_self_read on public.students
  for select to authenticated using (public.is_self_student(student_id));

drop policy if exists enrollments_self_read on public.enrollments;
create policy enrollments_self_read on public.enrollments
  for select to authenticated using (public.is_self_student(student_id));

drop policy if exists affiliations_self_read on public.affiliations;
create policy affiliations_self_read on public.affiliations
  for select to authenticated
  using (subject_kind = 'student' and public.is_self_student(subject_id));

-- Read the classes / sessions targeted at them (own enrollments + team studio-wide).
drop policy if exists studio_classes_self_read on public.studio_classes;
create policy studio_classes_self_read on public.studio_classes
  for select to authenticated
  using (public.self_calendar_for_class(class_id) or public.self_sees_studio_wide(class_id));

drop policy if exists class_sessions_self_read on public.class_sessions;
create policy class_sessions_self_read on public.class_sessions
  for select to authenticated
  using (public.self_calendar_for_class(class_id) or public.self_sees_studio_wide(class_id));

commit;

-- END.
