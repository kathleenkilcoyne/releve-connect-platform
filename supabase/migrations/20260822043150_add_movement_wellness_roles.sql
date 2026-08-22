-- Add four movement/wellness Professional Roles (founder-approved 2026-08-22),
-- following a read-only audit against the live role_types table (all 25 rows,
-- active and inactive) and current usage. That audit confirmed:
--   * None of the four below duplicate an existing active OR inactive role —
--     no slug or label match for "trainer", "pilates", "yoga", "gyrotonic",
--     "gyrokinesis", "conditioning", or "fitness" anywhere in the table.
--   * Only 2 talent_profiles and 1 application exist system-wide right now,
--     so there is no existing usage to reconcile either way.
--
-- Deliberately NOT included in this pass (founder decision, same day):
-- Nutrition Coach, Registered Dietitian, and Massage Therapist — held for a
-- separate pass because credential/title requirements for nutrition and
-- massage need a more deliberate decision than a straightforward addition.
--
-- Purely additive; nothing existing is touched. Same safe pattern as
-- 20260822041051_role_taxonomy_cleanup.sql: on conflict do nothing, so a
-- retry after a partial failure can never double-insert.

insert into public.role_types (slug, label, is_active, sort_order)
values
  ('personal_trainer',       'Personal Trainer',       true, 30),
  ('pilates_instructor',     'Pilates Instructor',     true, 31),
  ('yoga_instructor',        'Yoga Instructor',        true, 32),
  ('gyrotonic_practitioner', 'GYROTONIC Practitioner', true, 33)
on conflict (slug) do nothing;
