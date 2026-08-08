-- ============================================================================
-- Relevé Connect — Migration: event acknowledgements ("Got it")
-- ----------------------------------------------------------------------------
-- The family-facing "Got it" loop. A guardian taps a This Week event to confirm
-- they saw it; the studio/admin sees who acknowledged. This is PURELY ADDITIVE —
-- one new table + RLS. It does NOT touch studio_classes, class_sessions,
-- enrollments, affiliations, communications, or the calendar build. It reuses the
-- exact schedule/family/dancer relationships already in place:
--
--   · TARGETED events (a private, duet, class, team…) — a per-dancer ack that
--     identifies the occurrence (class_sessions.session_id), the dancer
--     (students.student_id) and family, the guardian who tapped
--     (acknowledged_by), and when (acknowledged_at).
--   · STUDIO-WIDE events (Full Studio Event, whole-studio Parent Meeting) — a
--     FAMILY-level ack keyed to the occurrence + family_account, resolved through
--     the studio affiliation the family already has (family_sees_studio_wide).
--     student_id is NULL for these (the whole-studio event has no single dancer).
--
-- This deliberately does NOT use communications.read_at (that is message read
-- state, a different surface).
-- ============================================================================

begin;

create table if not exists public.event_acknowledgements (
  ack_id          uuid primary key default gen_random_uuid(),
  -- The exact dated occurrence the family saw on their week.
  session_id      uuid not null references public.class_sessions(session_id) on delete cascade,
  -- TARGETED ack: the enrolled dancer. NULL for a studio-wide (family-level) ack.
  student_id      uuid references public.students(student_id) on delete cascade,
  -- The acknowledging family. Set on studio-wide (family-level) acks and carried
  -- on targeted acks too (for the studio readout). NULL only for a self-managed
  -- adult (college team) with no family_account — not part of this slice.
  family_id       uuid references public.family_accounts(family_id) on delete cascade,
  -- The guardian who tapped "Got it".
  acknowledged_by uuid not null references public.users(user_id) on delete cascade,
  acknowledged_at timestamptz not null default now()
);

-- One targeted ack per (occurrence, dancer).
create unique index if not exists event_ack_targeted_uq
  on public.event_acknowledgements (session_id, student_id)
  where student_id is not null;

-- One studio-wide ack per (occurrence, family).
create unique index if not exists event_ack_family_uq
  on public.event_acknowledgements (session_id, family_id)
  where student_id is null and family_id is not null;

create index if not exists event_ack_session_idx
  on public.event_acknowledgements (session_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Default-deny, then grant exactly the family (who make + read their own acks)
-- and the studio side (owner/admin + the assigned teacher, read-only) — reusing
-- the SAME predicates the calendar already trusts.
alter table public.event_acknowledgements enable row level security;

-- SELECT: the guardian who made it; a guardian of the acknowledged dancer; any
-- member of the acknowledging family; OR the studio admin / assigned teacher of
-- the session's class (so they can build the readout).
drop policy if exists event_ack_select on public.event_acknowledgements;
create policy event_ack_select on public.event_acknowledgements
  for select to authenticated using (
    acknowledged_by = auth.uid()
    or (student_id is not null and public.is_guardian_of(student_id))
    or (family_id is not null and public.is_family_member(family_id))
    or exists (
      select 1
      from public.class_sessions cs
      join public.studio_classes c on c.class_id = cs.class_id
      where cs.session_id = event_acknowledgements.session_id
        and (public.is_studio_admin(c.employer_id) or public.teaches_class(c.class_id))
    )
  );

-- INSERT: only a guardian acknowledging AS THEMSELVES, and only for an event they
-- can actually see — a class their dancer is enrolled in (targeted) or a
-- studio-wide event at their studio (family-level). Same gates as the family read.
drop policy if exists event_ack_insert on public.event_acknowledgements;
create policy event_ack_insert on public.event_acknowledgements
  for insert to authenticated with check (
    acknowledged_by = auth.uid()
    and exists (
      select 1
      from public.class_sessions cs
      where cs.session_id = event_acknowledgements.session_id
        and (
          (event_acknowledgements.student_id is not null
             and public.is_guardian_of(event_acknowledgements.student_id)
             and public.guardian_calendar_for_class(cs.class_id))
          or (event_acknowledgements.student_id is null
             and public.family_sees_studio_wide(cs.class_id))
        )
    )
  );

-- DELETE: a guardian may undo their OWN ack (mis-tap / toggle). No one else can.
drop policy if exists event_ack_delete_own on public.event_acknowledgements;
create policy event_ack_delete_own on public.event_acknowledgements
  for delete to authenticated using (acknowledged_by = auth.uid());

commit;

-- END.
