-- ============================================================================
-- Let people affiliated with a studio READ that studio's profile row.
--
-- ── The gap this closes ──
-- `employer_profiles` had exactly one select policy: the OWNER. That meant a
-- teacher on staff could not read the name of the studio they teach at, and a
-- parent could not read the name of the studio their child attends. In "This
-- Week" it surfaced as a calendar that said "Your studio" to someone who very
-- much knows which studio it is.
--
-- ── Why a SECURITY DEFINER helper rather than an inline policy expression ──
-- The obvious inline check would call `is_studio_admin()`, which calls
-- `owns_employer()`, which reads `employer_profiles` — the table being
-- protected. A policy that re-queries its own table recurses. Running the check
-- inside a SECURITY DEFINER function evaluates it without re-entering RLS.
--
-- ── Scope ──
-- Affiliation means one of: on staff, assigned to teach one of its classes, or a
-- guardian of a student enrolled in one of its classes. Nothing broader.
-- A studio's presence page is public-facing by design (CLAUDE.md §4D), so the
-- row carries no secret; this is about not making affiliated people blind to it,
-- not about exposing anything new.
--
-- The existing owner-only insert/update/delete policies are UNCHANGED — this
-- grants read, never write.
-- ============================================================================

begin;

create or replace function public.is_affiliated_with_studio(p_employer_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  -- on staff
  select exists (select 1 from public.studio_staff ss
                 where ss.employer_id = p_employer_id and ss.user_id = auth.uid())
  -- assigned to teach one of its classes
      or exists (select 1 from public.studio_classes c
                 join public.talent_profiles t on t.profile_id = c.teacher_profile_id
                 where c.employer_id = p_employer_id and t.user_id = auth.uid())
  -- guardian of a student enrolled in one of its classes
      or exists (select 1 from public.studio_classes c
                 join public.enrollments e   on e.class_id  = c.class_id
                 join public.guardianships g on g.student_id = e.student_id
                 where c.employer_id = p_employer_id and g.guardian_user_id = auth.uid());
$$;

drop policy if exists employer_profiles_select_affiliated on public.employer_profiles;
create policy employer_profiles_select_affiliated on public.employer_profiles
  for select to authenticated using (public.is_affiliated_with_studio(employer_id));

commit;
