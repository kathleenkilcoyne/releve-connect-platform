-- ============================================================================
-- Relevé Connect — Migration: application auto-save + resume-email columns
-- ----------------------------------------------------------------------------
-- ⚠️  RECONSTRUCTED FROM LIVE PRODUCTION STATE — 2026-08-17. DO NOT REAPPLY.
--
-- This file did not exist in Git. The change was applied by hand directly in the
-- Supabase SQL editor on 2026-07-20 and is recorded in the Supabase migration
-- ledger as version `20260720172555 application_draft_fields`. It is reproduced
-- here from the LIVE database catalog so the repository documents what production
-- actually contains.
--
-- ── Status ──
-- ALREADY APPLIED to production, and LOAD-BEARING: `src/app/apply/draft.ts` reads
-- and writes every column below on the live /apply flow. This file is
-- DOCUMENTATION, not a pending change. Every statement is `if not exists`, so an
-- accidental replay is a no-op — but the intent is that it is never executed.
--
-- ── How it was reconstructed ──
--   · columns → information_schema.columns
--   · index   → pg_indexes
-- The ORIGINAL text is unrecoverable; only the resulting shape is known. The
-- commentary is inferred from `src/app/apply/draft.ts`, which is the only
-- consumer, and is therefore explanatory rather than historical.
--
-- ── Attribution caveat ──
-- `applications_resume_token_idx` (the partial index below) appears in neither
-- schema.sql nor any Git migration, so it is attributed here. `resume_token` and
-- `resume_expires_at` themselves are OLDER — they are declared in schema.sql and
-- were created with the applications table, so they are deliberately NOT
-- reproduced in this file.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) The auto-saved draft snapshot
-- ----------------------------------------------------------------------------
-- The application is 13 role-branched sections; nobody finishes it in one
-- sitting. The form auto-saves ~2.5s after typing stops, into `draft_fields` —
-- the WHOLE form as JSON, not a column per question, so adding or reordering a
-- question never needs a migration and never invalidates someone's saved draft.
--
-- Stored while `state = 'draft'`. On submit the payload is promoted into the
-- structured `answers` column; `draft_fields` is the work-in-progress, `answers`
-- is the submission.
alter table public.applications
  add column if not exists draft_fields jsonb;

-- When that snapshot was last written. Drives "we saved your progress" in the UI
-- and makes an abandoned draft findable.
alter table public.applications
  add column if not exists draft_saved_at timestamptz;

-- ----------------------------------------------------------------------------
-- 2) The resume-email guard
-- ----------------------------------------------------------------------------
-- The first auto-save mints a `resume_token` and emails the applicant a link back
-- into their draft (14-day window). Auto-save then keeps firing every few
-- seconds. Without this stamp, every single save would send another email —
-- which is exactly the "clean email discipline" guardrail (CLAUDE.md §7.5)
-- failing in the most embarrassing possible way.
--
-- The send is written as a conditional update `… where resume_email_sent_at is
-- null`, so the database itself decides who wins if two saves race. This column
-- is that decision.
alter table public.applications
  add column if not exists resume_email_sent_at timestamptz;

-- ----------------------------------------------------------------------------
-- 3) Fast lookup when someone follows their resume link
-- ----------------------------------------------------------------------------
-- Partial: only a minority of rows ever carry a token, and a null token is never
-- something we search for.
create index if not exists applications_resume_token_idx
  on public.applications (resume_token)
  where resume_token is not null;

commit;

-- ============================================================================
-- END (reconstruction). Live state confirmed 2026-08-17:
--   · applications.draft_fields         jsonb        NULL
--   · applications.draft_saved_at       timestamptz  NULL
--   · applications.resume_email_sent_at timestamptz  NULL
--   · index applications_resume_token_idx (partial, resume_token IS NOT NULL)
--
-- NO ROLLBACK IS OFFERED. These columns carry live applicant drafts and the
-- send-once guard for a real email. Dropping them would lose in-progress
-- applications and re-open duplicate resume emails.
-- ============================================================================
