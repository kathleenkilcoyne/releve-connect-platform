-- ============================================================================
-- Relevé Connect — Migration: Private Invited Professional (billing + Verified
--                              Member, structurally separate from Founding
--                              Professional and Founding 25)
-- ----------------------------------------------------------------------------
-- A second, independent invited pathway. Like a Founding Professional, a
-- privately invited professional never applies — but unlike a Founding
-- Professional, they receive NO public distinction. They get:
--   · a complimentary Professional membership (admin-selected: permanent or
--     12-month), and
--   · the Verified Member mark (verification_flag),
-- and NOTHING ELSE. `founder_distinction` is never set for this pathway — it
-- stays at its default 'none'. Founding 25 is untouched by construction: it
-- lives on `applications.is_founding_25`, which this pathway never reads or
-- writes.
--
-- WHY A SEPARATE TABLE, not a column on founding_professional_grants:
-- Kathleen's explicit requirement is that this stay STRUCTURALLY separate from
-- Founding Professional — not just logically separate behind a flag someone
-- could forget to set. A second table means:
--   · founding_professional_grants and every row in it is untouched — this
--     migration does not ALTER that table at all.
--   · the two cohorts can never be confused in a query — they are different
--     tables, not different values of the same column.
--   · future reporting ("how many are comp because they're Founding
--     Professionals, vs privately invited?") is answerable by which TABLE a
--     grant lives in, not by remembering to check a flag.
--
-- WHY DISTINCT MEMBERSHIP SOURCES (invited_professional_permanent /
-- invited_professional_term), not the existing complimentary_permanent /
-- complimentary_term: same reasoning, one level down. If this pathway reused
-- the Founding Professional billing sources, the two cohorts' complimentary
-- memberships would be indistinguishable in the `memberships` table itself —
-- undoing the separation this migration exists to create. No memberships
-- schema change is needed; `source` is free text with no check constraint.
--
-- Additive + reversible (see rollback note). No existing table, column, policy,
-- or founder_distinction enum value is touched.
--
-- PREREQUISITES (all present on main): tables public.users and
--   public.talent_profiles.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- CONFERRAL / AUDIT record — one row per privately invited professional.
-- Mirrors founding_professional_grants in shape (proven pattern), but is a
-- wholly separate table: no foreign key, no shared row, no shared identity
-- concept with that table.
-- ----------------------------------------------------------------------------
create table if not exists public.private_invitations (
  id                uuid primary key default gen_random_uuid(),

  -- WHO was invited (lower-cased in the app; matched case-insensitively on claim).
  email             text not null,

  -- Filled once we know their account (immediately if they already exist, else on
  -- first sign-in). ON DELETE SET NULL so removing a user never erases the audit.
  user_id           uuid references public.users(user_id) on delete set null,

  -- BILLING flavor for THIS person — the admin's deliberate choice:
  --   'permanent' → permanent complimentary Professional membership (never billed)
  --   'comp_12mo' → 12 months complimentary, then the ordinary Professional model
  -- Same two flavors as Founding Professional, by deliberate parallel design —
  -- but this table's rows never touch founder_distinction, and materialize
  -- through their OWN distinctly-named membership sources (see app code).
  entitlement_kind  text not null
                      check (entitlement_kind in ('permanent','comp_12mo')),

  -- AUDIT: who conferred it, when, and why. granted_by is the acting admin.
  granted_by        uuid not null references public.users(user_id),
  granted_at        timestamptz not null default now(),
  note              text,

  -- Lifecycle: claimed_at set when materialized into a membership; revoked_at
  -- lets a grant be rescinded (before OR after claim) if it was a mistake, and
  -- revoked_by records WHICH admin revoked it. Grant rows are never deleted.
  claimed_at        timestamptz,
  revoked_at        timestamptz,
  revoked_by        uuid references public.users(user_id),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One ACTIVE (non-revoked) invitation per email; re-inviting after a revoke is
-- allowed.
create unique index if not exists private_invitations_email_active_uniq
  on public.private_invitations (lower(email))
  where revoked_at is null;

-- Fast lookup by claimed account.
create index if not exists private_invitations_user_idx
  on public.private_invitations (user_id) where user_id is not null;

-- ----------------------------------------------------------------------------
-- RLS — ADMIN / SERVICE-ROLE ONLY, identical posture to
-- founding_professional_grants: no member may read or write it; deny by
-- default; service_role bypasses RLS and holds the only Data-API grant.
-- ----------------------------------------------------------------------------
alter table public.private_invitations enable row level security;
-- (intentionally NO policies for anon/authenticated — deny by default)

revoke all on public.private_invitations from anon, authenticated;
grant select, insert, update, delete
  on public.private_invitations to service_role;

commit;

-- ============================================================================
-- END. Adds:
--   · table public.private_invitations (conferral/audit, service-role only)
-- Does NOT touch: founding_professional_grants (schema or rows), the
-- founder_distinction enum, any existing membership row, Stripe, the $30
-- apply/fee-checkout path, or applications.is_founding_25.
--
-- New membership `source` values this pathway's app code will write (no schema
-- change required — source is free text):
--   · invited_professional_permanent  (renewal_date NULL)
--   · invited_professional_term       (renewal_date +12 months)
--
-- ROLLBACK (if ever needed):
--   begin;
--   drop table if exists public.private_invitations cascade;
--   commit;
--   -- Membership rows already materialized with the invited_professional_*
--   -- sources are NOT touched by this rollback — they remain ordinary
--   -- memberships rows (by design, the row carries no dependency on this
--   -- table). Deactivate them separately if that's ever needed.
-- ============================================================================
