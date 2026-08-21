-- ============================================================================
-- Relevé Connect — Migration: Studio profile → "studio story" fields
--   (spec: STUDIO-PROFILE-FROM-KATHLEEN.md, 2026-07-24)
-- ----------------------------------------------------------------------------
-- The studio profile is being reframed from a database form into a studio STORY
-- for professional decision-making (a teacher deciding whether to teach there,
-- and Swing/Flex matching). The story leads with people and culture, not the
-- year it opened. These three columns are the new story fields:
--
--   artistic_director  The person(s) behind the studio — teachers know a name
--                      before a studio. text[] because co-directors / leadership
--                      may be more than one.
--   unique_note        "What makes your studio unique?" — one or two sentences.
--   mission            "Your studio in one line."
--
-- culture_note ("What's it like to teach here?") already exists. All three are
-- OPTIONAL and warmly prompted; the ONE gated field is Location (city + state),
-- enforced in the app layer (lib/studio/profile.ts) — not a DB constraint, so the
-- light first-save flow isn't broken by a hard NOT NULL.
--
-- Applied live 2026-07-25. Idempotent.
-- ============================================================================

alter table public.employer_profiles
  add column if not exists artistic_director text[] not null default '{}',
  add column if not exists unique_note       text,
  add column if not exists mission           text;
