-- ============================================================================
-- Relevé Connect — Migration: generalize the activation ledger
--   (Unified Membership Model, Slice 1′ —
--    APPLIED to production 2026-08-12, registered version 20260812192808)
-- ----------------------------------------------------------------------------
-- Evolves the Slice-1 `professional_activations` table into ONE generalized
-- `activations` ledger serving every membership family (professional · studio ·
-- team). See docs/MEMBERSHIP-MODEL-PLAN.md.
--
-- SAFE: the table is EMPTY and DORMANT — no deployed code references it
-- (production runs Slice 0; the ledger is unwired). So this rename + add-columns
-- touches no data and nothing live. It changes ONE object (the new, empty ledger)
-- and no other table, policy, trigger, function, or row.
--
-- Changes:
--   • rename table professional_activations → activations
--   • + membership_family text  (check professional|studio|team) — the discriminator
--   • + employer_id uuid        (nullable FK → employer_profiles) — for studio/team
--   • rename the RLS policy + indexes to match (cosmetic; behaviour identical)
--
-- PREREQUISITES: public.professional_activations (from 20260812024722, empty),
--   public.employer_profiles(employer_id).
-- ============================================================================

begin;

-- 1) Rename the table. Its PK, RLS, indexes, and FKs follow automatically.
alter table if exists public.professional_activations rename to activations;

-- 2) The membership-family discriminator. Team is a valid value NOW (reserved);
--    the Team flow is not built yet. Empty table → the temporary default just
--    lets us add a NOT NULL column, then we drop it so every future insert must
--    state its family explicitly.
alter table public.activations
  add column if not exists membership_family text not null default 'professional'
    check (membership_family in ('professional','studio','team'));
alter table public.activations alter column membership_family drop default;

-- 3) The org an activation belongs to (studio/team). Null for professional.
alter table public.activations
  add column if not exists employer_id uuid
    references public.employer_profiles(employer_id) on delete set null;

-- 4) Cosmetic renames so names match the new table (behaviour unchanged).
alter policy professional_activations_select_own on public.activations
  rename to activations_select_own;
alter index if exists professional_activations_user_idx   rename to activations_user_idx;
alter index if exists professional_activations_status_idx rename to activations_status_idx;

-- 5) New indexes for the new columns.
create index if not exists activations_family_idx   on public.activations (membership_family);
create index if not exists activations_employer_idx on public.activations (employer_id);

commit;

-- ============================================================================
-- END. `activations` is the one generalized ledger (professional | studio |
-- team), still owner-read / service-role-write, still empty and dormant. No
-- other object or data was altered.
-- ============================================================================
