-- ============================================================================
-- Onboarding gateway — "How are you joining Relevé?" (2026-08-06)
-- ============================================================================
-- A brand-new signed-in user with no linkage used to fall through
-- resolveSignedInDestination() to the PROFESSIONAL default (/profile/edit →
-- /subscribe → /apply) — so studios, dance teams, and industry partners were
-- all funneled into the Roster application. This adds:
--
--   1) users.onboarding_intent — the gateway choice, persisted so a returning
--      user routes straight to their own flow and never re-sees the gateway.
--   2) team_interest    — Dance Team (Director) inquiries.
--   3) partner_interest — Industry Partner / The Beat inquiries.
--
-- Both interest tables mirror studio_interest: a short inquiry captured now,
-- worked by hand later — NOT a self-serve account or dashboard. Like
-- studio_interest they are DEFAULT-DENY under RLS (no authenticated policy):
-- only the service role (the form server actions) reads or writes them.
-- ============================================================================

begin;

-- 1) users.onboarding_intent -------------------------------------------------
-- Nullable: null means "hasn't chosen yet" → show the gateway. The four values
-- are the four doors. account_type (talent|employer|admin|consumer) can't carry
-- this — studio and team both map to employer, and partner has no value — so the
-- intent lives in its own column.
alter table public.users
  add column if not exists onboarding_intent text
    check (
      onboarding_intent is null
      or onboarding_intent in ('professional', 'studio', 'team', 'partner')
    );

-- 2) team_interest — Dance Team (Director) inquiry ---------------------------
create table if not exists public.team_interest (
  interest_id  uuid primary key default gen_random_uuid(),
  -- Who submitted it (the gateway requires sign-in). Kept nullable / set-null so
  -- a deleted account never erases the inquiry record.
  user_id      uuid references public.users(user_id) on delete set null,
  team_name    text not null,
  school_org   text,
  team_level   text check (
    team_level is null
    or team_level in ('middle_school', 'high_school', 'college', 'professional', 'independent')
  ),
  coach_name   text,
  email        text not null,
  city_state   text,
  -- What they want to use Relevé for.
  use_case     text,
  message      text,
  -- Kathleen's manual pipeline state, moved by hand as she onboards.
  status       text not null default 'new'
                 check (status in ('new', 'contacted', 'onboarded', 'declined')),
  created_at   timestamptz not null default now()
);
create index if not exists team_interest_created_idx on public.team_interest (created_at desc);
create index if not exists team_interest_user_idx on public.team_interest (user_id);
alter table public.team_interest enable row level security;

-- 3) partner_interest — Industry Partner / The Beat inquiry ------------------
create table if not exists public.partner_interest (
  interest_id       uuid primary key default gen_random_uuid(),
  user_id           uuid references public.users(user_id) on delete set null,
  org_name          text not null,
  -- Free text on purpose — advertiser, vendor, media, education, etc. — kept open
  -- until the partner taxonomy is settled.
  org_type          text,
  contact_name      text not null,
  contact_title     text,
  website_or_social text,
  -- How they want to participate (advertise on The Beat, sponsor, etc.).
  participation     text,
  message           text,
  status            text not null default 'new'
                      check (status in ('new', 'contacted', 'onboarded', 'declined')),
  created_at        timestamptz not null default now()
);
create index if not exists partner_interest_created_idx on public.partner_interest (created_at desc);
create index if not exists partner_interest_user_idx on public.partner_interest (user_id);
alter table public.partner_interest enable row level security;

commit;
