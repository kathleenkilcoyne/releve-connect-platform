-- ============================================================================
-- ROLLBACK for supabase/migrations/20260905120000_self_managed_member_ack.sql
-- ----------------------------------------------------------------------------
-- ⚠️  NOT part of the sequential migration set — this file lives OUTSIDE
-- supabase/migrations/ on purpose, so `supabase db push` / apply_migration never
-- picks it up automatically. Run it by hand (or via apply_migration naming it
-- explicitly) only if the 2026-09-05 self-managed-member "Got it" fix needs to be
-- reversed.
--
-- What this does: restores the `event_ack_insert` policy to its exact pre-fix
-- text — byte-identical to what shipped in
-- supabase/migrations/20260808171854_event_acknowledgements.sql (filed on
-- origin/main as 20260808140000_event_acknowledgements.sql). Removes ONLY the
-- self-managed-member disjunct; the guardian/family disjuncts are reproduced
-- verbatim, unchanged.
--
-- No table, column, index, or function is touched by this rollback.
--
-- Effect: self-managed members can no longer WRITE new acknowledgements — the
-- "Got it" button reverts to failing with "Couldn't save that just now" if the
-- app-code fix is still in place, or (if the app-code fix is also reverted)
-- simply isn't offered at all, which is today's production behavior.
--
-- Rows a self-managed member already wrote under the fix are NOT deleted and
-- remain valid/readable (event_ack_select is untouched by this rollback) — they
-- simply stop being counted by the studio-wide tally until the fix is
-- re-applied, at which point they count again immediately. See
-- _review-2026-09-05/ack-proposal/ROLLBACK.md §3 for the (optional, tightly
-- scoped) cleanup query if those rows ever need to be removed instead of kept.
--
-- Full test log for both directions of this migration (applied + rolled back):
-- _review-2026-09-05/kathleen-diagnostic-2026-09-05/
--   02-pilot-branch-and-ack-test-results.md
--   03-integrated-branch-e2e-test-results.md
-- ============================================================================

begin;

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

commit;

-- END. Verify with:
--   select polname, pg_get_expr(polwithcheck, polrelid) as with_check
--   from pg_policy
--   where polrelid = 'public.event_acknowledgements'::regclass
--     and polname = 'event_ack_insert';
-- The returned expression must contain `family_sees_studio_wide` and must NOT
-- contain `is_self_student`.
