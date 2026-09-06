# Rollback — `20260905120000_self_managed_member_ack.sql`

The migration changes exactly one thing: the `event_ack_insert` policy on
`public.event_acknowledgements`. It creates no table, column, index or function,
and writes no data. Rollback is therefore a single statement that restores the
policy verbatim from `20260808140000_event_acknowledgements.sql:80-96`.

## 1. Reverse the migration

Run as a migration of its own (preferred, so the history stays linear) or in the
SQL editor:

```sql
begin;

-- Restore the pre-20260905120000 policy exactly as shipped in
-- 20260808140000_event_acknowledgements.sql.
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
```

Effect: self-managed members can no longer *write* new acknowledgements. Nothing
else changes — guardian/family writes, all reads, and all deletes are untouched.

## 2. Reverse the application code

```sh
git revert <commit>       # or: git checkout <base> -- <the 8 source + 3 test files>
```

Order does not matter, but **revert the app code first** if you are doing them
separately: with the old policy and the new app code, a team member's tap fails
RLS and the button reverts with "Couldn't save that just now — please try again."
(no crash, no data written). With the new policy and the old app code, nothing at
all happens — the button is simply never offered, i.e. today's behavior.

## 3. What happens to rows already written by self-managed members

A self-managed ack row looks like:

```
student_id  = <the member's own students.student_id>
family_id   = null
acknowledged_by = <their user_id>
```

After rollback these rows **remain and stay valid**:

* `event_ack_select` still returns them (`acknowledged_by = auth.uid()` for the
  member; `is_studio_admin(...)` for the coach) — no orphaned or unreadable data.
* `markFamilyAcks` (reverted) reads studio-wide cards from the `student_id is
  null` map, so the member's card simply shows grey again; the row is ignored, not
  mis-rendered.
* `summarizeClassAcks` (reverted) ignores them for a studio-wide tally
  (`r.student_id === null && r.family_id` is false), so the coach's readout returns
  to "no recipients yet" rather than showing a wrong number.
* They can never collide with a guardian row: the targeted unique index is keyed
  on `(session_id, student_id)`.

**Recommendation: do not delete them.** They are a true record that a member
acknowledged, and re-applying the migration makes them count again immediately —
no backfill needed.

If you nonetheless must remove them (e.g. a botched pilot you want to re-run
clean), scope the delete tightly and **dry-run the select first**:

```sql
-- DRY RUN — inspect before deleting.
select a.ack_id, a.session_id, a.student_id, a.acknowledged_at
from public.event_acknowledgements a
join public.students s on s.student_id = a.student_id
where a.family_id is null
  and s.family_id is null
  and s.transferred_to_user_id is not null
  and a.acknowledged_at >= '<migration deploy timestamp>';

-- Then, with the same predicate:
-- delete from public.event_acknowledgements a
-- using public.students s
-- where s.student_id = a.student_id
--   and a.family_id is null
--   and s.family_id is null
--   and s.transferred_to_user_id is not null
--   and a.acknowledged_at >= '<migration deploy timestamp>';
```

The `acknowledged_at` bound matters: without it the same predicate would also
match a self-managed member's *targeted* ack rows, which this migration is not the
only possible source of.

## 4. Verifying the rollback took

```sql
select polname, pg_get_expr(polwithcheck, polrelid) as with_check
from pg_policy
where polrelid = 'public.event_acknowledgements'::regclass
  and polname = 'event_ack_insert';
```

The returned expression must contain `family_sees_studio_wide` and **must not**
contain `is_self_student`.
