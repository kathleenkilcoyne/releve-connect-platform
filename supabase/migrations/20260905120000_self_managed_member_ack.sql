-- ============================================================================
-- Relevé Connect — Migration: "Got it" for self-managed members (dance teams)
-- ----------------------------------------------------------------------------
-- A dance team's dancers are ADULTS. They join through /team-join, which creates
-- their `students` row with `family_id: null`, `visibility='self_managed'` and
-- `transferred_to_user_id = <their own user>` — no guardian, no guardianship row,
-- no family_account. The self-managed READ lane already exists for exactly this
-- shape (20260731125427_self_managed_member_read.sql, filed on this branch as
-- 20260801010000_self_managed_member_read.sql — same content, different local
-- timestamp; see the 2026-09-05 diagnostic note): `is_self_student`,
-- `self_calendar_for_class` and `self_sees_studio_wide`.
--
-- The acknowledgement WRITE lane was never extended to it. The insert policy in
-- 20260808171854_event_acknowledgements.sql (filed here as
-- 20260808140000_event_acknowledgements.sql) has two disjuncts, both guardian-only:
--
--     (student_id is not null and is_guardian_of(student_id)
--        and guardian_calendar_for_class(cs.class_id))
--     or (student_id is null and family_sees_studio_wide(cs.class_id))
--
-- A team member satisfies NEITHER — they have no guardianship row — so every
-- "Got it" write from a team member is refused by RLS. This migration adds ONE
-- grant-only disjunct that mirrors the self READ policies exactly: a self-managed
-- member may acknowledge, AS THEMSELVES (student_id = their own student row), an
-- occurrence they can actually see — a class they are enrolled in, or a
-- studio-wide event at a team they are actively affiliated to.
--
-- Row shape for that lane: student_id = their own student row, family_id = null
-- (they have no family account to acknowledge with). The existing partial unique
-- index `event_ack_targeted_uq (session_id, student_id) where student_id is not
-- null` already makes one tap per occurrence idempotent — no new index needed.
--
-- PURELY ADDITIVE and policy-only. No table, column, index, function or data
-- change. Nothing in the guardian/family lane is altered: both existing disjuncts
-- are reproduced verbatim, and the new one can only be satisfied by a caller whose
-- own `students.transferred_to_user_id = auth.uid()`.
--
-- VERIFIED 2026-09-05: tested end-to-end (both directions) against an isolated,
-- disposable Supabase project rebuilt from this branch's own migrations — never
-- against production. See
-- _review-2026-09-05/kathleen-diagnostic-2026-09-05/02-pilot-branch-and-ack-test-results.md
-- for the full test log (14 checks: self-managed join/read/write/idempotency/
-- isolation, coach numerator/denominator, and a full studio/family regression
-- pass proving this migration changes nothing for the existing guardian lane).
-- ============================================================================

begin;

-- INSERT: a guardian acknowledging AS THEMSELVES for an event they can see
-- (unchanged), OR a self-managed member acknowledging AS THEMSELVES for an event
-- they can see. Same gates as each side's read lane.
drop policy if exists event_ack_insert on public.event_acknowledgements;
create policy event_ack_insert on public.event_acknowledgements
  for insert to authenticated with check (
    acknowledged_by = auth.uid()
    and exists (
      select 1
      from public.class_sessions cs
      where cs.session_id = event_acknowledgements.session_id
        and (
          -- Guardian · targeted (unchanged).
          (event_acknowledgements.student_id is not null
             and public.is_guardian_of(event_acknowledgements.student_id)
             and public.guardian_calendar_for_class(cs.class_id))
          -- Guardian · studio-wide, family-level (unchanged).
          or (event_acknowledgements.student_id is null
             and public.family_sees_studio_wide(cs.class_id))
          -- NEW · self-managed member (dance team) acknowledging as their own
          -- student row. They have no family_account, so family_id must be null;
          -- the class must be one they are enrolled in or a studio-wide event at
          -- their team — the SAME predicates as studio_classes_self_read.
          or (event_acknowledgements.student_id is not null
             and event_acknowledgements.family_id is null
             and public.is_self_student(event_acknowledgements.student_id)
             and (public.self_calendar_for_class(cs.class_id)
                  or public.self_sees_studio_wide(cs.class_id)))
        )
    )
  );

commit;

-- END.
--
-- NOT changed, and deliberately so:
--   · event_ack_select — a self member already reads their own rows through the
--     existing `acknowledged_by = auth.uid()` clause, and the coach already reads
--     the whole set through `is_studio_admin(c.employer_id)`.
--   · event_ack_delete_own — `acknowledged_by = auth.uid()` already covers them.
--   · the table, its columns, and all three indexes.
--
-- ROLLBACK (if ever needed) — see also
-- _review-2026-09-05/ack-proposal/ROLLBACK.md and the paired file
-- 20260905120000_self_managed_member_ack_ROLLBACK.sql in this same directory:
--   begin;
--   drop policy if exists event_ack_insert on public.event_acknowledgements;
--   create policy event_ack_insert on public.event_acknowledgements
--     for insert to authenticated with check (
--       acknowledged_by = auth.uid()
--       and exists (
--         select 1
--         from public.class_sessions cs
--         where cs.session_id = event_acknowledgements.session_id
--           and (
--             (event_acknowledgements.student_id is not null
--                and public.is_guardian_of(event_acknowledgements.student_id)
--                and public.guardian_calendar_for_class(cs.class_id))
--             or (event_acknowledgements.student_id is null
--                and public.family_sees_studio_wide(cs.class_id))
--           )
--       )
--     );
--   commit;
-- Effect: self-managed members can no longer WRITE new acknowledgements. Existing
-- rows they already wrote remain valid and readable (see ROLLBACK.md §3) — nothing
-- is deleted, and re-applying this migration makes them count again immediately.
-- ============================================================================
