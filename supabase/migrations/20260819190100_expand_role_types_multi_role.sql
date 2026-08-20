-- Multi-role support. `profile_roles` (profile_id, role_id) already exists as a
-- join table — built ahead of need, never wired up, still empty. This migration:
--   1. Expands role_types to the founder's requested set.
--   2. Retires "Working Dancer" wording via is_active = false (soft-retire, the
--      same pattern already used for other taxonomy rows elsewhere) rather than
--      deleting the row — no live data references it today (checked: both real
--      profiles have primary_role = 'teacher'), but a row could theoretically be
--      FK-referenced from profile_roles in the future, so it is never dropped.
--   3. Relabels studio_owner to match the founder's requested wording.
--   4. Backfills profile_roles from the existing single-value primary_role column
--      for every profile that has one, so no one's existing role is lost when the
--      UI switches from single-select to multi-select. primary_role itself is left
--      untouched (deprecated in place, not dropped) — preserves the old value even
--      though the new UI reads/writes profile_roles going forward.

-- 1. New role rows (additive; sort_order continues after the existing 4).
insert into public.role_types (slug, label, is_active, sort_order)
values
  ('dancer', 'Dancer', true, 10),
  ('dancer_singer', 'Dancer / Singer', true, 11),
  ('dancer_singer_actor', 'Dancer / Singer / Actor', true, 12),
  ('adjudicator', 'Adjudicator', true, 13)
on conflict (slug) do nothing;

-- 2. Retire "Working Dancer" — soft, not deleted.
update public.role_types
  set is_active = false
  where slug = 'working_dancer';

-- 3. Relabel Studio Owner.
update public.role_types
  set label = 'Studio Owner / Director'
  where slug = 'studio_owner';

-- 4. Backfill: one profile_roles row per existing primary_role, skipping anyone
--    already backfilled (idempotent) and anyone whose primary_role doesn't match
--    a known role_types slug (defensive; none expected today).
insert into public.profile_roles (profile_id, role_id)
select tp.profile_id, rt.id
from public.talent_profiles tp
join public.role_types rt on rt.slug = tp.primary_role
where tp.primary_role is not null
on conflict (profile_id, role_id) do nothing;
