-- ============================================================================
-- Relevé Connect — Migration: Profile V2, activation + provenance
-- ----------------------------------------------------------------------------
-- ✅ APPLIED to production 2026-08-17, on the founder's explicit approval.
--    Registered in the Supabase migration ledger as version 20260817221638,
--    name `profile_v2_activation` — this filename matches that version on
--    purpose. Pre-flight checks in the Safety block below were re-run
--    immediately before applying and all passed.
--
--    This header was updated the moment it went live. The reconciliation pass
--    earlier the same day exists precisely because two files were left claiming
--    "NOT APPLIED" long after they were live; that mistake is not repeated here.
--
-- ── What this supports ──
-- The ratified Professional journey:
--   Apply → Relevé accepts → activate/pay → Relevé creates the DRAFT profile
--   → member reviews/completes → member publishes
--
-- A talent_profiles row is created at ACTIVATION — approved AND (paid membership
-- OR an authorized comp/founding grant) — never at application or approval alone.
-- It is seeded ONCE from the accepted application and is thereafter the
-- member-controlled record. The application is preserved unchanged as the
-- historical vetting record. There is no two-way sync.
--
-- ── Safety ──
-- Purely additive. No existing column, constraint, policy, or row is modified or
-- dropped. Verified read-only against production 2026-08-17 before writing:
--   · talent_profiles rows                     = 1
--   · duplicate user_id groups                 = 0   ← §1 cannot fail
--   · rows with null user_id                   = 0
--   · existing unique index on user_id         = none
--   · prefilled_from_application_id            = does not exist
--   · approved applications with no profile    = 0   ← no backfill needed
-- Re-run these checks immediately before applying; if §1's count is no longer 0,
-- STOP — the index will fail and that failure is the point.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) ONE PROFILE PER PERSON — enforced by the database, not by hope
-- ----------------------------------------------------------------------------
-- Founder decision 2026-08-17: "Do not rely only on an application-level
-- existence check."
--
-- Activation fires from a Stripe webhook, an admin approve click, and a sign-in
-- claim. Stripe delivers at-least-once; admins double-click; sign-ins race with
-- webhooks. An application-level "does a profile exist?" check has a window
-- between the SELECT and the INSERT, and every one of those callers can be in
-- that window at the same moment. This index closes it: the second writer gets a
-- unique violation, which the activation code catches and treats as success
-- (someone else already created it) rather than as an error.
--
-- Note `talent_profiles` has NO unique constraint on user_id today — only the PK
-- on profile_id and a unique public_slug. Two profiles for one person have always
-- been possible; nothing has triggered it because saveProfile was the only writer.
-- Adding writers without adding this would be how that latent bug finally fires.
create unique index if not exists talent_profiles_user_id_key
  on public.talent_profiles (user_id);

-- ----------------------------------------------------------------------------
-- 2) PROVENANCE — which accepted application seeded this profile
-- ----------------------------------------------------------------------------
-- Founder decision 2026-08-17: "Relevé is a vetted professional network.
-- Traceability is part of the trust model."
--
-- ON DELETE SET NULL, deliberately: if an application row is ever removed, the
-- PROFILE must survive. A member's professional record cannot depend on the
-- retention of their paperwork. The link degrades to "seeded by an application we
-- no longer hold" rather than cascading into deleting a live profile.
--
-- NULL is meaningful and expected, not missing data. It means one of:
--   · a Founding Professional, who was invited and never applied;
--   · a profile created before this migration (the founder's own);
--   · a member who built their profile under the old lazy-creation behaviour.
alter table public.talent_profiles
  add column if not exists prefilled_from_application_id uuid
    references public.applications(application_id) on delete set null;

-- WHEN the one-time seed ran. Together with the column above this is the audit
-- trail: which application, and when it was carried across. Also the belt to the
-- braces on idempotency — a non-null value means the seed has already happened
-- and must never run again, independent of what the profile now contains.
alter table public.talent_profiles
  add column if not exists prefilled_at timestamptz;

comment on column public.talent_profiles.prefilled_from_application_id is
  'The accepted application this profile was seeded from, once, at activation. NULL for Founding Professionals (never applied) and for profiles predating Profile V2. One-way: later profile edits never write back to the application.';
comment on column public.talent_profiles.prefilled_at is
  'When the one-time application seed ran. Non-null means the seed is done and must never repeat.';

create index if not exists talent_profiles_prefilled_from_idx
  on public.talent_profiles (prefilled_from_application_id)
  where prefilled_from_application_id is not null;

-- ----------------------------------------------------------------------------
-- 3) THREE NARRATIVE COLUMNS the application already collects and V1 discarded
-- ----------------------------------------------------------------------------
-- Founder decision 2026-08-17 §4: "Do not simply drop valuable professional
-- information from the application." These three have NO existing structured
-- home, so they are the only new content columns in this migration. Everything
-- else in §4 reuses tables that already exist:
--
--   unions[]                → profile_credentials (kind='union')      [exists, empty, RLS complete]
--   degrees[]               → profile_credentials (kind='degree')     [exists, empty, RLS complete]
--   teaching styles/levels  → profile_styles / profile_levels         [exact slug match]
--   choreographer focus     → profile_focus_areas                     [exact slug match]
--   open_to[]               → profile_open_to_badges                  [exact slug match]
--   work links + the        → talent_profiles.video_reels jsonb, whose designed
--   choreography/performance  shape is [{label, url, kind:'teaching|choreography
--   reels                     |performance', order}] — built for exactly this and
--                             never used (0 rows carry a non-empty value)
--
-- Narrative prose about HOW someone teaches. Four prompts in the application;
-- stored as one text field because it is read as prose, never filtered on.
alter table public.talent_profiles
  add column if not exists teaching_philosophy text;

-- Adaptive / inclusive dance experience. Its own column rather than folded into
-- the philosophy: for a studio serving adaptive dancers this is a search-worthy
-- fact, and burying it in prose would make it unfindable later.
alter table public.talent_profiles
  add column if not exists adaptive_experience text;

-- Years choreographing — DISTINCT from years_experience, which is overall career
-- length. Text, not an integer, because the application asks for free text and
-- the honest thing is to preserve what the person actually wrote.
alter table public.talent_profiles
  add column if not exists choreographer_years text;

commit;

-- ============================================================================
-- END. Adds: one unique index (user_id), two provenance columns + their index,
-- and three narrative columns. No data is written, no existing object altered,
-- no RLS or grant touched. Every statement is IF NOT EXISTS.
--
-- WHAT THIS MIGRATION DOES NOT DO (deliberately):
--   · Does not create, prefill, or publish any profile — that is application code.
--   · Does not touch `works` or `available_for_licensing`. Choreo License is a
--     later pass; profile ownership and identity settle first.
--   · Does not add a `members_only` visibility value. Founder decision 2026-08-17
--     §7 chose D1: `unlisted` becomes genuinely link-only, which is a code change
--     to the public-profile read, not a schema change.
--   · Does not backfill. There are 0 approved applications without a profile.
--
-- ROLLBACK:
--   begin;
--   drop index if exists public.talent_profiles_prefilled_from_idx;
--   drop index if exists public.talent_profiles_user_id_key;
--   alter table public.talent_profiles
--     drop column if exists prefilled_from_application_id,
--     drop column if exists prefilled_at,
--     drop column if exists teaching_philosophy,
--     drop column if exists adaptive_experience,
--     drop column if exists choreographer_years;
--   commit;
-- ============================================================================
