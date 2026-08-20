-- Custom (non-taxonomy) entries for Professional Roles, Dance Styles,
-- Teaching Levels, and Focus Areas (Slice D, founder-approved 2026-08-20).
-- A custom entry is free text with no matching row in role_types / styles /
-- levels / focus_areas, so it cannot join through the existing structured
-- tables. Additive, per-member, nullable array columns — never colliding
-- with or overwriting the structured taxonomy selections, which keep using
-- profile_roles / profile_styles / profile_levels / profile_focus_areas
-- exactly as before. Roster search/filtering continues to work off the
-- structured joins only; these columns are display/self-description only
-- until (if ever) a founder decision brings custom values into search.
alter table public.talent_profiles
  add column if not exists custom_roles text[],
  add column if not exists custom_styles text[],
  add column if not exists custom_levels text[],
  add column if not exists custom_focus_areas text[];
