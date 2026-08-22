-- Role taxonomy cleanup (founder-approved 2026-08-22), following a read-only
-- audit against the live role_types table, every profile_roles row, both real
-- profiles' full role sets, and the applications table. That audit confirmed:
--   * None of the four additions below duplicate an existing active OR
--     inactive role.
--   * Generic "coach" has ZERO usage anywhere (0 profile_roles rows, neither
--     real profile holds it, 0 applications reference it) — deactivating it
--     orphans no one.
--   * "performer" was also considered (same broad-vs-specific shape as coach)
--     but is explicitly KEPT ACTIVE for now — its neighbors (Dancer, Dancer/
--     Singer, Dancer/Singer/Actor) don't fully cover "performs but isn't
--     primarily a dancer" the way Vocal/Acting/Dance/Audition Coach fully
--     cover "coaches", so it isn't the same kind of redundant.
--
-- 1. Four new role_types rows — Costume Designer, Lighting Designer, Digital
--    Content Creator, and Arts Administrator / Company Manager (deliberately
--    distinct from studio_owner, which is specifically about owning/running a
--    dance studio business, not general arts administration or company
--    management). Purely additive; nothing existing is touched.
-- 2. Soft-retire generic "Coach" — same pattern already used for
--    working_dancer: is_active = false, never deleted, in case anything ever
--    references it by FK. /apply and the Roster both read role_types live by
--    is_active already, so no code change is needed for this to take effect.

insert into public.role_types (slug, label, is_active, sort_order)
values
  ('costume_designer',                   'Costume Designer',                     true, 26),
  ('lighting_designer',                  'Lighting Designer',                    true, 27),
  ('digital_content_creator',            'Digital Content Creator',              true, 28),
  ('arts_administrator_company_manager', 'Arts Administrator / Company Manager', true, 29)
on conflict (slug) do nothing;

update public.role_types
  set is_active = false
  where slug = 'coach';
