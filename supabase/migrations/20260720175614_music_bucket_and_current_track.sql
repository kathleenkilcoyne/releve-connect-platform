-- ============================================================================
-- Relevé Connect — Migration: the `music` bucket + This Week's current track
-- ----------------------------------------------------------------------------
-- ⚠️  RECONSTRUCTED FROM LIVE PRODUCTION STATE — 2026-08-17. DO NOT REAPPLY.
--
-- This file did not exist in Git. The change was applied by hand directly in the
-- Supabase SQL editor on 2026-07-20 and is recorded in the Supabase migration
-- ledger as version `20260720175614 music_bucket_and_current_track`. It is
-- reproduced here from the LIVE database catalog so the repository documents what
-- production actually contains.
--
-- ── Status ──
-- ALREADY APPLIED to production. This file is DOCUMENTATION, not a pending
-- change. Every statement is guarded or `on conflict do nothing`, so an
-- accidental replay is a no-op — but the intent is that it is never executed.
--
-- ── How it was reconstructed ──
--   · bucket       → storage.buckets (id='music', public=true, created 2026-07-20)
--   · policy       → pg_policies on storage.objects
--   · config rows  → public.app_config
-- The ORIGINAL text is unrecoverable; only the resulting shape is known. The
-- commentary is inferred from `src/lib/this-week/music.ts` and GO-LIVE-CHECKLIST
-- §9, and is therefore explanatory rather than historical.
--
-- ── What this is ──
-- "This Week" can play ONE track, chosen by Kathleen, at the top of the calendar.
-- Tap-to-play, never autoplay, `preload="none"`. The whole feature is two config
-- values and a storage bucket: no table, no player state, no per-user anything.
-- No track set = no player rendered, which is the normal resting state.
--
-- ⚠️ STANDING LICENSING HAZARD (GO-LIVE-CHECKLIST §9). The bucket is PUBLIC, on a
-- real domain — putting a file in it is publication. ONLY (a) royalty-free tracks
-- Relevé has licensed, or (b) a member's ORIGINAL work may go in it. Never
-- commercial music, not as a placeholder, not for a demo, not "just to test".
-- This is a legal exposure, not a style preference.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) The bucket
-- ----------------------------------------------------------------------------
-- Public read, because the audio is served straight to the browser on a page that
-- logged-out visitors can reach. No write policy exists (see §2) — uploads happen
-- through the Supabase dashboard or the service role, by Kathleen, deliberately.
insert into storage.buckets (id, name, public)
values ('music', 'music', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2) Read policy
-- ----------------------------------------------------------------------------
-- Guarded rather than the repo's usual `drop policy if exists` + `create policy`
-- pattern: dropping a live policy, even momentarily, is a real change to
-- production, and this file must never make one.
--
-- Note the policy NAME carries spaces — it was created in the Supabase dashboard,
-- not by a migration, which is itself a fingerprint of how this change was made.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'music is publicly readable'
  ) then
    create policy "music is publicly readable" on storage.objects
      for select to public
      using (bucket_id = 'music');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3) The two config keys
-- ----------------------------------------------------------------------------
-- Inserted with NO value on purpose. `app_config` is the same
-- config-not-constants pattern used for `adult_transition_age` and
-- `swing_hourly_rate_cents`: the rows exist so the keys are discoverable and
-- settable without a deploy, and both sit NULL until Kathleen chooses a track.
--
--   this_week_current_track        → the filename inside the `music` bucket
--   this_week_current_track_credit → optional "who made this" line under the player
--
-- (public.app_config itself is created by
--  20260717214525_family_layer_and_studio_schedule.sql — not by this migration.)
insert into public.app_config (key, text_value)
values ('this_week_current_track', null),
       ('this_week_current_track_credit', null)
on conflict (key) do nothing;

commit;

-- ============================================================================
-- END (reconstruction). Live state confirmed 2026-08-17:
--   · storage bucket `music`, public = true
--   · storage.objects policy "music is publicly readable" (SELECT, role public)
--   · app_config `this_week_current_track`         → text_value NULL
--   · app_config `this_week_current_track_credit`  → text_value NULL
--
-- ROLLBACK (do not run without cause):
--   begin;
--   drop policy if exists "music is publicly readable" on storage.objects;
--   delete from public.app_config
--     where key in ('this_week_current_track', 'this_week_current_track_credit');
--   -- Only if the bucket is empty:
--   -- delete from storage.buckets where id = 'music';
--   commit;
-- ============================================================================
