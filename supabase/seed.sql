-- ============================================================================
-- Relevé Connect — Seed data for the controlled vocabularies (pick-lists)
-- ----------------------------------------------------------------------------
-- These are the starter category lists from CLAUDE.md Section 3A. They fill the
-- "pick-list" tables so the profile builder and search filters have options to
-- show. Safe to run more than once (existing terms are skipped).
--
-- ⚠️ These are STARTERS. The exact final lists still need Kathleen's sign-off
--    (Open Decision 3). Adding/renaming later is just an admin task — no code change.
-- ============================================================================

-- --- Professional role types ------------------------------------------------
insert into role_types (slug, label, sort_order) values
  ('teacher',        'Teacher',        1),
  ('choreographer',  'Choreographer',  2),
  ('working_dancer', 'Working Dancer', 3),
  ('studio_owner',   'Studio Owner',   4)
on conflict (slug) do nothing;

-- --- Dance styles -----------------------------------------------------------
insert into styles (slug, label, sort_order) values
  ('ballet',          'Ballet',          1),
  ('pointe',          'Pointe',          2),
  ('variations',      'Variations',      3),
  ('jazz',            'Jazz',            4),
  ('hip-hop',         'Hip-Hop',         5),
  ('contemporary',    'Contemporary',    6),
  ('modern',          'Modern',          7),
  ('tap',             'Tap',             8),
  ('lyrical',         'Lyrical',         9),
  ('musical-theatre', 'Musical Theatre', 10),
  ('latin',           'Latin',           11),
  ('ballroom',        'Ballroom',        12),
  ('acro',            'Acro',            13),
  ('improvisation',   'Improvisation',   14),
  ('other',           'Other',           99)
on conflict (slug) do nothing;

-- --- Levels (Beginner → Professional) ---------------------------------------
insert into levels (slug, label, sort_order) values
  ('beginner',         'Beginner',         1),
  ('intermediate',     'Intermediate',     2),
  ('advanced',         'Advanced',         3),
  ('pre-professional', 'Pre-Professional', 4),
  ('professional',     'Professional',     5)
on conflict (slug) do nothing;

-- --- Choreographer focus areas ----------------------------------------------
insert into focus_areas (slug, label, sort_order) values
  ('competition',          'Competition',          1),
  ('concert-stage',        'Concert / Stage',      2),
  ('commercial',           'Commercial',           3),
  ('theatre-mt',           'Theatre / MT',         4),
  ('film-tv',              'Film / TV',            5),
  ('lyrical-contemporary', 'Lyrical / Contemporary', 6),
  ('ballet',               'Ballet',               7),
  ('jazz',                 'Jazz',                 8),
  ('hip-hop',              'Hip-Hop',              9),
  ('tap',                  'Tap',                  10),
  ('other',                'Other',                99)
on conflict (slug) do nothing;

-- --- Regions (PLACEHOLDER — confirm the real list with Kathleen) -------------
insert into regions (slug, label, sort_order) values
  ('northeast',     'Northeast',      1),
  ('southeast',     'Southeast',      2),
  ('midwest',       'Midwest',        3),
  ('southwest',     'Southwest',      4),
  ('west',          'West',           5),
  ('pacific-nw',    'Pacific Northwest', 6),
  ('international',  'International',   9)
on conflict (slug) do nothing;

-- --- Open-To engagement badges (self-selected, CLAUDE.md 3B class B) ---------
insert into open_to_badges (slug, label, sort_order) values
  ('teaching-new-classes',   'Teaching new classes',              1),
  ('substituting',           'Substituting via The Swing',        2),
  ('choreographing',         'Choreographing on commission',      3),
  ('licensing',              'Licensing pieces',                  4),
  ('auditioning',            'Auditioning via The Beat',          5),
  ('speaking',               'Speaking on a panel / Relevé Live', 6),
  ('social-posting',         'Publicly posting for Relevé on social', 7),
  ('other',                  'Other',                             99)
on conflict (slug) do nothing;
