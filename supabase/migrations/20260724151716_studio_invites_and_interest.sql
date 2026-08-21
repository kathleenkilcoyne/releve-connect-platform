-- ============================================================================
-- Relevé Connect — Migration: Studio invites (the family gate) + studio interest
--   (V1 three-paths, 2026-07-24)
-- ----------------------------------------------------------------------------
-- Two small, load-bearing tables for the V1 "three experiences" architecture:
--
--   studio_invites   The DATA-LAYER GATE for family self-join. A family can only
--                    create a Family Profile with a valid code that resolves to a
--                    PARTICIPATING studio. This is the enforcement behind "Join
--                    Through Your Studio" — words on the button AND a row in the
--                    database both prevent open family signup. Redemption happens
--                    server-side under the service role (the valid code IS the
--                    studio's authorization to enroll a family), never by the
--                    guardian's own client.
--
--   studio_interest  Submissions from the public "Become a Founding Studio"
--                    interest form. Studios are onboarded MANUALLY / white-glove
--                    by Kathleen in V1 — there is no self-serve studio signup or
--                    billing. This table is the record; an email alert is the
--                    live notification. Written server-side under the service
--                    role (the sender is a not-yet-signed-in studio owner).
--
-- LOAD-BEARING RULES honoured here:
--   • No self-serve studio account is created from the interest form.
--   • A minor is never public: this migration adds no student-facing surface; it
--     only lets a valid studio code open the EXISTING guarded family layer
--     (family_accounts / students / guardianships from the 2026-07-17 migration).
--   • Default-deny RLS. studio_interest has no authenticated policy at all — only
--     the service role touches it. studio_invites is managed by the owning studio
--     and redeemed under the service role.
--
-- Convention match: uuid PKs (gen_random_uuid), on delete cascade, per-table RLS,
-- fully idempotent. Prereqs (all exist): public.employer_profiles(employer_id,
-- owner_user_id), public.owns_employer().
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) studio_invites — the family-join gate
-- ----------------------------------------------------------------------------
create table if not exists public.studio_invites (
  invite_id   uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles(employer_id) on delete cascade,
  -- The code a family types on /join. Stored and compared UPPER-cased (the app
  -- normalises before lookup) so "tate-fall" and "TATE-FALL" are the same code.
  code        text not null,
  label       text,                                   -- studio's own note, e.g. "Fall 2026 families"
  status      text not null default 'active' check (status in ('active','disabled')),
  -- null max_uses = unlimited (a durable studio code). Set it for a capped batch.
  max_uses    int check (max_uses is null or max_uses > 0),
  use_count   int not null default 0,
  expires_at  timestamptz,                            -- null = never expires
  created_at  timestamptz not null default now()
);

-- One code is one code, globally — the lookup is by code alone, so it must be
-- unique across every studio. Case-insensitive via the upper() expression index.
create unique index if not exists studio_invites_code_key
  on public.studio_invites (upper(code));
create index if not exists studio_invites_employer_idx
  on public.studio_invites (employer_id);

-- RLS: the owning studio manages its own codes (for a future studio-side UI).
-- Redemption on /join does NOT use these policies — it runs under the service
-- role, because the family is not (yet) a member of the studio.
alter table public.studio_invites enable row level security;
drop policy if exists studio_invites_owner_rw on public.studio_invites;
create policy studio_invites_owner_rw on public.studio_invites
  for all to authenticated
  using (public.owns_employer(employer_id))
  with check (public.owns_employer(employer_id));

-- ----------------------------------------------------------------------------
-- 2) studio_interest — "Become a Founding Studio" submissions
-- ----------------------------------------------------------------------------
create table if not exists public.studio_interest (
  interest_id        uuid primary key default gen_random_uuid(),
  studio_name        text not null,
  contact_name       text not null,
  email              text not null,
  phone              text,
  city               text,
  state_province     text,
  student_count_band text check (
    student_count_band is null
    or student_count_band in ('under_50','50_99','100_199','200_plus')
  ),
  message            text,
  -- Where the submission came from, for later attribution ("homepage", "/studios").
  source             text,
  -- Kathleen's manual pipeline state. She moves these by hand as she onboards.
  status             text not null default 'new'
                       check (status in ('new','contacted','onboarded','declined')),
  created_at         timestamptz not null default now()
);
create index if not exists studio_interest_created_idx
  on public.studio_interest (created_at desc);

-- RLS on, and DELIBERATELY no authenticated policy: this table is default-deny
-- to every user. Only the service role (the interest-form server action, and any
-- future admin console) reads or writes it. A signed-out studio owner submitting
-- the form is served entirely by the server action under the service role.
alter table public.studio_interest enable row level security;

commit;

-- ============================================================================
-- END. The family gate (studio_invites) + the studio interest record. No
-- self-serve studio account, no public minor surface. Next (code, not schema):
-- the /studios interest form, the /join family flow, and a seeded pilot studio
-- + code so the family path is testable end-to-end.
-- ============================================================================
