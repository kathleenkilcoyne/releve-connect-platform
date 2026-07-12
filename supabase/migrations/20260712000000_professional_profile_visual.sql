-- ============================================================================
-- Relevé Connect — Migration: the visual-first Professional profile (Step 3)
-- ----------------------------------------------------------------------------
-- WHAT THIS DOES
--   1. Adds three columns to `talent_profiles` for the visual-first profile
--      (build spec §6):
--        • honorifics       — editorial marks carried over from the approved
--                             application (Master Teacher, Founding Artist…).
--                             SERVER-STAMPED ONLY — never set from the profile
--                             form (§13: conferred by Kathleen, not self-selected).
--        • teaching_reel_url — the hero video (Vimeo/YouTube), the highest-value
--                             item above the fold.
--        • gallery_urls      — an ordered list of up to 8 photo URLs, rendered as
--                             a grid. JSONB so the shape can grow (captions later).
--      (`resume_url` and `video_reels` already exist from the base schema and are
--      reused for the CV PDF and role-conditional reels respectively.)
--   2. Creates two PUBLIC Storage buckets — `gallery` and `resumes` — mirroring
--      the existing public `headshots` bucket. Uploads go through the service-role
--      client (which bypasses RLS), reads are public; that matches how headshots
--      already works, so no storage.objects policies are needed.
--
-- WHAT THIS DOES NOT DO
--   • Adds no rows to talent_profiles; changes/removes nothing existing. Safe to
--     run more than once (add-column-if-not-exists, on-conflict-do-nothing).
--   • Does NOT grant Verified Member — that stays a ~60-day earned, admin-granted
--     mark (§13). The app stamps `certified_eligible_at` at profile creation and
--     leaves `verification_flag` false.
--
-- PREREQUISITE: schema.sql + prior migrations applied (talent_profiles exists).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) talent_profiles — visual-first fields
-- ----------------------------------------------------------------------------
alter table public.talent_profiles
  add column if not exists honorifics        text[] not null default '{}',
  add column if not exists teaching_reel_url text,
  add column if not exists gallery_urls      jsonb  not null default '[]'::jsonb;

-- ----------------------------------------------------------------------------
-- 2) Storage buckets — public read, service-role write (same as `headshots`)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('gallery', 'gallery', true),
  ('resumes', 'resumes', true)
on conflict (id) do nothing;

commit;

-- ============================================================================
-- END. talent_profiles now carries the Teaching Reel, an 8-image gallery, and
-- the honorifics carried from approval; `gallery` + `resumes` buckets exist.
-- ============================================================================
