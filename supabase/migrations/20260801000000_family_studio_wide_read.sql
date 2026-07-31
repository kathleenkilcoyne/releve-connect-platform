-- ============================================================================
-- Relevé Connect — Migration: family reads studio-wide events (Slice 3, Phase B)
-- ----------------------------------------------------------------------------
-- A Full Studio Event / whole-studio Parent Meeting is stored with
-- studio_classes.studio_wide = true and NO enrollments (the whole studio, not a
-- picked roster). The existing family read path is enrollment-gated
-- (guardian_calendar_for_class), so a studio-wide event is currently invisible
-- to every family. This adds the ONE new read lane Slice 3 needs — additive and
-- grant-only (RLS is the OR of its policies, so this never weakens the existing
-- rules; it only opens studio-wide events to the families of that studio).
--
-- `family_sees_studio_wide(class_id)` is true when the class is studio_wide AND
-- the caller is a guardian (with the 'calendar' permission) of a student
-- AFFILIATED (active) to that class's studio. That is exactly "a family in the
-- studio may read what the studio published to the whole studio."
-- ============================================================================

begin;

create or replace function public.family_sees_studio_wide(p_class_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.studio_classes c
    join public.affiliations a
      on a.employer_id = c.employer_id
     and a.subject_kind = 'student'
     and a.status = 'active'
    join public.guardianships g
      on g.student_id = a.subject_id
    where c.class_id = p_class_id
      and c.studio_wide = true
      and g.guardian_user_id = auth.uid()
      and 'calendar' = any (g.permissions)
  );
$$;

drop policy if exists studio_classes_family_studio_wide on public.studio_classes;
create policy studio_classes_family_studio_wide on public.studio_classes
  for select to authenticated
  using (public.family_sees_studio_wide(class_id));

drop policy if exists class_sessions_family_studio_wide on public.class_sessions;
create policy class_sessions_family_studio_wide on public.class_sessions
  for select to authenticated
  using (public.family_sees_studio_wide(class_id));

commit;

-- END.
