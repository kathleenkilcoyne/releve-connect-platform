-- ============================================================================
-- Relevé Connect — Migration: Private Audition Coaching → Private Coaching
-- ----------------------------------------------------------------------------
-- ✅ APPLIED to production 2026-08-18, on the founder's explicit instruction.
--    Ledger version 20260818153810, name `merge_private_audition_coaching`.
--    Pre-flight showed exactly one delete (the placeholder) and one rename
--    (the member row, $125/hour preserved). Verified after: five services,
--    ordered 1-5; the surviving row kept id 8a5648d9…, created_at 2026-08-13,
--    type session, pricing hourly, "$125 / hour", and its own description.
--    `private-audition-coaching` no longer appears in any live service_slugs,
--    and /roster?svc=private-audition-coaching still resolves via the alias.
--
-- ── Why ──
-- Founder, 2026-08-18: "Merge Private Audition Coaching into Private Coaching as
-- the single canonical My Service… Audition Prep should remain a
-- specialization/use case of Private Coaching, not a separate top-level service."
--
-- The top-level service set becomes, and stays, five:
--   Choreography · Master Classes · Private Coaching · Adjudication · Guest Teaching
--
-- The product decision this preserves: Private Coaching is the container, and
-- Audition Prep / College Audition Coaching / Technique / Solo Coaching / Career
-- Coaching are SPECIALIZATIONS within it. Modelling each as its own top-level
-- service would turn My Services into twenty near-identical buttons and make the
-- Roster's Services facet useless. **No specialties schema is created in this
-- slice** (founder instruction) — this comment and the DECISIONS.md entry are
-- where the decision lives until there is something to build.
--
-- ── Which row survives, and why it matters ──
-- The two rows are NOT equivalent:
--
--   "Private Audition Coaching"  — the MEMBER'S OWN, created 2026-08-13.
--       type 'session', pricing_type 'hourly', price_display '$125 / hour',
--       and their own description.
--   "Private Coaching"           — a machine placeholder inserted by migration
--       20260818152849 today. type 'service', pricing_type 'contact', no price.
--
-- So the merge KEEPS the member's row and RENAMES it, and deletes the
-- placeholder. Doing it the other way round would have silently destroyed a real
-- price, a real description, the row's id and its created_at — the founder's
-- instruction was "preserve all existing data and references", and only this
-- direction does that. The surviving row keeps its original id, so any future
-- reference to it stays valid. (Checked: no foreign key anywhere references
-- professional_offerings.id today.)
--
-- ── Old links keep working ──
-- The Roster resolves the retired slug `private-audition-coaching` to
-- `private-coaching` in `src/lib/roster/services.ts`
-- (LEGACY_SERVICE_ALIASES). `/roster?svc=private-audition-coaching` therefore
-- still finds the right professionals — before and after this migration.
--
-- ── Safety ──
-- Idempotent: after it runs no row is titled "Private Audition Coaching", so a
-- second run matches nothing. The placeholder delete is guarded so it can only
-- remove an UNTOUCHED machine-inserted row — if a member had genuinely built
-- their own "Private Coaching", both rows are left alone rather than guessed at.
-- No schema change: data only.
-- ============================================================================

-- 1 ── Remove the untouched placeholder, but ONLY where the member's own
--      "Private Audition Coaching" exists to take its place.
delete from professional_offerings ph
 where lower(ph.title) = 'private coaching'
   -- Only ever an unedited row created by 20260818152849.
   and ph.pricing_type = 'contact'
   and ph.price_display is null
   and ph.price_cents is null
   and ph.long_description is null
   and ph.image_url is null
   and ph.external_url is null
   and ph.signature_work_id is null
   and ph.short_description = 'Private coaching sessions.'
   and exists (
     select 1 from professional_offerings src
      where src.profile_id = ph.profile_id
        and lower(src.title) = 'private audition coaching'
   );

-- 2 ── Rename the member's row to the canonical title and put it in position 3.
--      Everything else on the row — type, pricing, description, id, created_at —
--      is untouched. Guarded so it can never create a duplicate title.
update professional_offerings src
   set title = 'Private Coaching',
       sort_order = 3,
       updated_at = now()
 where lower(src.title) = 'private audition coaching'
   and not exists (
     select 1 from professional_offerings other
      where other.profile_id = src.profile_id
        and other.id <> src.id
        and lower(other.title) = 'private coaching'
   );

-- ============================================================================
-- ⚠ FOR THE FOUNDER
-- The surviving row keeps its original description verbatim:
--   "Individual coaching for dancers preparing for college, professional, or
--    company auditions."
-- That is deliberately NOT rewritten — it is the member's own copy, and
-- rewriting it would be inventing words. It now reads narrower than the title,
-- since Private Coaching is the general container. Broaden it in the editor
-- whenever you like; nothing depends on its wording.
-- ============================================================================
