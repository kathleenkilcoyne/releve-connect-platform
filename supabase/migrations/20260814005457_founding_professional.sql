-- ============================================================================
-- Relevé Connect — Migration: Founding Professional (identity + complimentary
--                              entitlement, DECOUPLED)
-- ----------------------------------------------------------------------------
-- Founding Professionals are a hand-selected, personally-invited cohort who help
-- establish the Professional Roster. This migration lays the DATA FOUNDATION for
-- TWO INDEPENDENT AXES that must never be coupled:
--
--   1) IDENTITY  — a durable, public distinction ("Founding Professional"),
--      represented by a new value on the existing founder_distinction enum and
--      set on talent_profiles. This NEVER changes based on billing.
--
--   2) BILLING ENTITLEMENT — a complimentary Professional membership, represented
--      by an ordinary `memberships` row (what every gate already reads). Two
--      flavors, both identity-agnostic on the membership itself:
--        · permanent complimentary  → source='complimentary_permanent', renewal_date NULL
--        · 12-month complimentary    → source='complimentary_term',      renewal_date=+12mo
--      NO memberships schema change is needed (source + renewal_date already exist
--      and are nullable). The membership row carries NO "founder" concept, so no
--      code can ever infer "founder ⇒ free forever".
--
-- The CONFERRAL/AUDIT record (this migration's new table) is the single place that
-- ties a person to BOTH axes at grant time: who was invited, which billing flavor,
-- who granted it, when, and why. It is written ONLY by the admin (service role) —
-- there is no self-select path.
--
-- Guardrails honored:
--   * $30 activation model UNCHANGED and still OFF. Founders never enter the apply
--     flow, so they structurally never reach fee-checkout — no payment-code branch.
--   * COMPLIMENTARY MEMBERSHIP ≠ COMPLIMENTARY MARKETPLACE/LICENSING. This table
--     grants membership entitlement ONLY. Transaction economics (labor / product /
--     event fees, licensing revenue share) are a SEPARATE future system and are
--     NOT created, referenced, or coupled here.
--   * Additive + reversible (see rollback note). No existing table/column/policy
--     is modified — only a new enum value and a new table are added.
--
-- PREREQUISITES (all present on main): type public.founder_distinction,
--   tables public.users and public.talent_profiles.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) IDENTITY axis — new durable public distinction on the founder_distinction
--    enum. IF NOT EXISTS makes this idempotent. Not USED in this migration (only
--    the app stamps it onto talent_profiles), so adding it here is safe even in a
--    single transaction. NOTE: Postgres cannot DROP an enum value, so this value
--    is effectively PERMANENT once applied (see rollback note).
-- ----------------------------------------------------------------------------
alter type public.founder_distinction add value if not exists 'founding_professional';

begin;

-- ----------------------------------------------------------------------------
-- 2) CONFERRAL / AUDIT record — one row per invited Founding Professional.
--    Keyed by email so a grant can exist BEFORE the person's first sign-in; it is
--    materialized into a membership when they sign in (or immediately, if they
--    already have an account). `entitlement_kind` chooses the billing flavor —
--    assigned by the admin PER PERSON, never hardcoded.
-- ----------------------------------------------------------------------------
create table if not exists public.founding_professional_grants (
  id                uuid primary key default gen_random_uuid(),

  -- WHO was invited (lower-cased in the app; matched case-insensitively on claim).
  email             text not null,

  -- Filled once we know their account (immediately if they already exist, else on
  -- first sign-in). ON DELETE SET NULL so removing a user never erases the audit.
  user_id           uuid references public.users(user_id) on delete set null,

  -- BILLING flavor for THIS person — the admin's deliberate choice:
  --   'permanent' → permanent complimentary Professional membership (never billed)
  --   'comp_12mo' → 12 months complimentary, then the ordinary Professional model
  entitlement_kind  text not null
                      check (entitlement_kind in ('permanent','comp_12mo')),

  -- AUDIT: who conferred it, when, and why. granted_by is the acting admin.
  granted_by        uuid not null references public.users(user_id),
  granted_at        timestamptz not null default now(),
  note              text,

  -- Lifecycle: claimed_at set when materialized into a membership; revoked_at lets
  -- a grant be rescinded (before OR after claim) if it was a mistake, and
  -- revoked_by records WHICH admin revoked it — a full who/when audit trail
  -- alongside granted_by/granted_at. Grant rows are never deleted, so the history
  -- of a correction survives.
  claimed_at        timestamptz,
  revoked_at        timestamptz,
  revoked_by        uuid references public.users(user_id),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One ACTIVE (non-revoked) grant per email; re-granting after a revoke is allowed.
create unique index if not exists founding_professional_grants_email_active_uniq
  on public.founding_professional_grants (lower(email))
  where revoked_at is null;

-- Fast lookup by claimed account.
create index if not exists founding_professional_grants_user_idx
  on public.founding_professional_grants (user_id) where user_id is not null;

-- ----------------------------------------------------------------------------
-- 3) RLS — ADMIN / SERVICE-ROLE ONLY. This is a privileged conferral ledger: no
--    member may read or write it (that is the self-select guard at the data
--    layer). RLS is enabled with NO permissive policies, so anon/authenticated
--    get nothing; the admin console's service-role client bypasses RLS. We grant
--    the Data-API privilege to service_role only (never to anon/authenticated),
--    so the table is not even exposed to ordinary callers.
-- ----------------------------------------------------------------------------
alter table public.founding_professional_grants enable row level security;
-- (intentionally NO policies for anon/authenticated — deny by default)

-- Defense-in-depth: strip the default public-schema grants so this ledger is not
-- even exposed on the Data API to ordinary callers (RLS already blocks every row;
-- this also removes the table-level privilege). service_role keeps full access and
-- bypasses RLS.
revoke all on public.founding_professional_grants from anon, authenticated;
grant select, insert, update, delete
  on public.founding_professional_grants to service_role;

commit;

-- ============================================================================
-- END. Adds:
--   · enum value public.founder_distinction 'founding_professional' (identity)
--   · table public.founding_professional_grants (conferral/audit, service-role only)
-- No memberships change (billing uses existing source + renewal_date). No change
-- to gates, Stripe, pricing, the $30 apply/fee-checkout path, or any marketplace/
-- licensing object. Purely additive.
--
-- ROLLBACK (if ever needed):
--   begin;
--   drop table if exists public.founding_professional_grants cascade;
--   commit;
--   -- NOTE: the enum value 'founding_professional' CANNOT be dropped in Postgres
--   -- without recreating the founder_distinction type (and rewriting every column
--   -- that uses it). It is harmless if unused, so it is left in place. Treat the
--   -- enum value as effectively PERMANENT once applied.
-- ============================================================================
