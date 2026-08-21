-- Roster search rebuild, Phase 1 (founder-approved 2026-08-21). Part 1 of 3:
-- the approved Professional Role additions, plus a structural marker for
-- which roles belong on the talent Roster.
--
--   1. Nine new role_types rows — the four Coach specialties named explicitly
--      by the founder (Vocal / Acting / Dance / Audition Coach), three
--      broader performing-arts titles (Music Director / Accompanist, Stage
--      Manager, Casting Director), one performer/choreographer crossover
--      (Dance Captain / Assistant Choreographer), and College / University
--      Faculty (deliberately a ROLE per founder decision 2026-08-21 — NOT a
--      teaching-context facet; that idea was raised and explicitly deferred).
--      Purely additive: existing roles (including generic "Coach", "Dancer /
--      Singer", "Dancer / Singer / Actor") are UNCHANGED. Nobody's existing
--      selection is touched — a member who already picked "Coach" stays
--      "Coach" until they choose to edit it themselves (founder instruction:
--      never guess someone into a more specific title).
--   2. role_types.show_in_roster — a structural flag so the Roster's role
--      filter can read its option list straight from this table (no
--      hardcoded array to keep in sync) while still keeping employer-side
--      roles out of the talent directory. Defaults true; only studio_owner
--      is set false. This replaces the ROSTER_CATEGORIES hardcoded array in
--      src/lib/roster/filters.ts, which excluded studio_owner the same way
--      but as code, not data.

insert into public.role_types (slug, label, is_active, sort_order)
values
  ('vocal_coach',                        'Vocal Coach',                          true, 17),
  ('acting_coach',                       'Acting Coach',                         true, 18),
  ('dance_coach',                        'Dance Coach',                          true, 19),
  ('audition_coach',                     'Audition Coach',                       true, 20),
  ('music_director_accompanist',         'Music Director / Accompanist',         true, 21),
  ('stage_manager',                      'Stage Manager',                        true, 22),
  ('casting_director',                   'Casting Director / Associate',         true, 23),
  ('dance_captain_asst_choreographer',   'Dance Captain / Assistant Choreographer', true, 24),
  ('college_university_faculty',         'College / University Faculty',         true, 25)
on conflict (slug) do nothing;

alter table public.role_types
  add column if not exists show_in_roster boolean not null default true;

update public.role_types
  set show_in_roster = false
  where slug = 'studio_owner';
