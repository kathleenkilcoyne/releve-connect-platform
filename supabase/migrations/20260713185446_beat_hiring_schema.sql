-- ============================================================================
-- Relevé Connect — Migration: THE BEAT — hiring-side schema (§9 "The Beat")
-- ----------------------------------------------------------------------------
-- The Beat is a multi-lane opportunity marketplace. This migration builds the
-- HIRING motion only — "someone posts a role, someone applies" — plus the
-- monetization scaffolding (partner packages + a transactions ledger). NO UI,
-- NO Stripe flow (Stripe columns are placeholders, left null). Payment/pricing
-- is resolved at checkout later against the existing `memberships` table.
--
-- FOUNDER DECISIONS BAKED IN (docs/The_Beat_Build_Plan_2026-07-12.md → Additions 2026-07-13):
--   • Two-level, ADMIN-MANAGED taxonomy: beat_categories (family) → beat_subcategories
--     (role/service). Both are DATA (rows), extensible without a deploy. (§B, ratified.)
--   • `opportunity_type` SPLIT: a small STABLE `beat_engagement_type` enum carries the
--     *nature* of the engagement; all subject/lane meaning lives in the taxonomy. (§B.)
--   • A post may carry MULTIPLE subcategories → join table `beat_posting_subcategories`. (§E.6.)
--   • Default post duration = 30 days → `expires_at` default now()+30d. (§A.2.)
--   • Media on posts → `portfolio_links` jsonb (useful for auditions too). (§E.4.)
--   • Setting is DEFERRED as an axis; Film/TV, Cruise, Theme Park live as SUBCATEGORIES.
--     The real future cross-cutting filter is UNION vs NON-UNION — a posting attribute to
--     be added later as a simple column; DESIGNED-FOR but NOT built now. (§E.1.)
--
-- THE BOUNDARY (§D) — hiring vs self-marketing:
--   The Beat's core motion is HIRING. The SELF-MARKETING / SERVICES motion (a person
--   selling their own skills — coaching, photography, creative & production services,
--   accompanists/musicians) is UNDECIDED: inside The Beat vs a separate vetted directory.
--   → This schema builds HIRING ONLY. There is deliberately NO `listing_type`
--     (seeking_for_hire) column, and the gated SERVICE families are NOT seeded. The
--     taxonomy structure supports them the moment §D resolves — as pure data inserts,
--     no schema change. Do NOT add the service lanes until Kathleen settles §D.
--
-- NAMING (deviates from the plan's Clerk-era "employer_id", aligned to repo conventions):
--   posters/holders/payers are the platform's Supabase user (users.user_id, which mirrors
--   auth.users.id). A poster may be a studio OR an individual member, so we use the neutral
--   `poster_user_id` / `holder_user_id` / `payer_user_id` (suffix matches owner_user_id etc.).
--
-- Idempotent. PREREQUISITES: public.users(user_id) exists.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0) Enums — small + stable. Subject/lane meaning is NOT here (it's taxonomy).
-- ----------------------------------------------------------------------------
do $$ begin create type beat_engagement_type as enum ('audition','employment','freelance_gig','other'); exception when duplicate_object then null; end $$;
do $$ begin create type beat_posting_type    as enum ('one_off','studio_included','partner_package');   exception when duplicate_object then null; end $$;
do $$ begin create type beat_posting_status  as enum ('draft','active','expired','closed');             exception when duplicate_object then null; end $$;
do $$ begin create type beat_partner_tier    as enum ('essential','premier','elite');                   exception when duplicate_object then null; end $$;
do $$ begin create type beat_partner_status  as enum ('active','expired','cancelled');                  exception when duplicate_object then null; end $$;
do $$ begin create type beat_txn_type        as enum ('one_off_post','studio_included_debit','partner_package_purchase','partner_package_debit'); exception when duplicate_object then null; end $$;
do $$ begin create type beat_txn_status      as enum ('pending','completed','failed');                  exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 1) Taxonomy — admin-managed vocab (public READ, no client writes). Level 1.
-- ----------------------------------------------------------------------------
create table if not exists public.beat_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  label      text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Level 2 — the specific role/service under a family. Slug unique WITHIN a family
-- (so "other" can exist under several families).
create table if not exists public.beat_subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.beat_categories(id) on delete cascade,
  slug        text not null,
  label       text not null,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (category_id, slug)
);
create index if not exists beat_subcategories_category_idx on public.beat_subcategories (category_id);

-- ----------------------------------------------------------------------------
-- 2) Partner packages — annual prepaid posting-credit bundles (College/University
--    pitch vehicle). credits_remaining is derived. Holder = a platform user.
-- ----------------------------------------------------------------------------
create table if not exists public.beat_partner_packages (
  id                uuid primary key default gen_random_uuid(),
  holder_user_id    uuid not null references public.users(user_id) on delete cascade,
  package_type      beat_partner_tier not null,
  total_credits     int not null check (total_credits >= 0),
  credits_used      int not null default 0 check (credits_used >= 0),
  credits_remaining int generated always as (total_credits - credits_used) stored,
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz,                       -- annual term end (nullable until set)
  status            beat_partner_status not null default 'active',
  created_at        timestamptz not null default now()
);
create index if not exists beat_partner_packages_holder_idx on public.beat_partner_packages (holder_user_id);

-- ----------------------------------------------------------------------------
-- 3) Postings — the HIRING post. category_id required; subcategories via join.
--    Studio "included" posts (annual allowance, RESET ANNUALLY per §A.1) are just
--    posting_type='studio_included'; the annual cap is enforced at post/checkout
--    time later by counting a studio's studio_included posts within its current
--    membership year (policy, not a column here).
-- ----------------------------------------------------------------------------
create table if not exists public.beat_postings (
  id                 uuid primary key default gen_random_uuid(),
  poster_user_id     uuid not null references public.users(user_id) on delete cascade,
  title              text not null,
  description        text,
  category_id        uuid not null references public.beat_categories(id),
  engagement_type    beat_engagement_type not null default 'other',
  posting_type       beat_posting_type not null default 'one_off',
  status             beat_posting_status not null default 'draft',
  location           text,                              -- freeform now (city/state); geocode later like studios
  compensation_info  text,
  application_method text,                              -- how to apply (email / link / instructions)
  portfolio_links    jsonb not null default '[]'::jsonb, -- [{label,url}] — media/samples (§E.4)
  partner_package_id uuid references public.beat_partner_packages(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  expires_at         timestamptz not null default (now() + interval '30 days')  -- §A.2
  -- NOTE (§E.1): union_status is the planned future cross-cutting filter — add as a
  -- nullable column when built; intentionally omitted now.
);
create index if not exists beat_postings_poster_idx   on public.beat_postings (poster_user_id);
create index if not exists beat_postings_category_idx on public.beat_postings (category_id);
create index if not exists beat_postings_status_idx    on public.beat_postings (status);
create index if not exists beat_postings_expires_idx   on public.beat_postings (expires_at);
create index if not exists beat_postings_partner_idx   on public.beat_postings (partner_package_id);

-- A post ↔ many subcategories (§E.6 — join table, resolved).
create table if not exists public.beat_posting_subcategories (
  posting_id     uuid not null references public.beat_postings(id) on delete cascade,
  subcategory_id uuid not null references public.beat_subcategories(id),
  primary key (posting_id, subcategory_id)
);
create index if not exists beat_posting_subcategories_sub_idx on public.beat_posting_subcategories (subcategory_id);

-- ----------------------------------------------------------------------------
-- 4) Transactions — the ledger. Stripe fields placeholder/null (no flow yet).
-- ----------------------------------------------------------------------------
create table if not exists public.beat_transactions (
  id                       uuid primary key default gen_random_uuid(),
  payer_user_id            uuid not null references public.users(user_id) on delete cascade,
  amount_cents             int not null default 0,       -- cents, like memberships.price_cents
  transaction_type         beat_txn_type not null,
  posting_id               uuid references public.beat_postings(id) on delete set null,
  partner_package_id       uuid references public.beat_partner_packages(id) on delete set null,
  status                   beat_txn_status not null default 'pending',
  stripe_payment_intent_id text,                          -- null until the Stripe flow is built
  stripe_session_id        text,                          -- null until the Stripe flow is built
  created_at               timestamptz not null default now()
);
create index if not exists beat_transactions_payer_idx   on public.beat_transactions (payer_user_id);
create index if not exists beat_transactions_posting_idx on public.beat_transactions (posting_id);
create index if not exists beat_transactions_partner_idx on public.beat_transactions (partner_package_id);

-- ----------------------------------------------------------------------------
-- 5) Ownership helper (mirrors owns_talent_profile / owns_employer).
-- ----------------------------------------------------------------------------
create or replace function public.owns_beat_posting(p_posting_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.beat_postings p
    where p.id = p_posting_id and p.poster_user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 6) RLS
-- ----------------------------------------------------------------------------
-- Taxonomy: world-readable, no client writes (service role seeds).
alter table public.beat_categories enable row level security;
drop policy if exists beat_categories_read_all on public.beat_categories;
create policy beat_categories_read_all on public.beat_categories for select using (true);

alter table public.beat_subcategories enable row level security;
drop policy if exists beat_subcategories_read_all on public.beat_subcategories;
create policy beat_subcategories_read_all on public.beat_subcategories for select using (true);

-- Postings: ACTIVE postings are world-readable (job seekers browse); a poster can
-- always see + manage their OWN rows (incl. drafts).
alter table public.beat_postings enable row level security;
drop policy if exists beat_postings_read_active on public.beat_postings;
create policy beat_postings_read_active on public.beat_postings
  for select using (status = 'active');
drop policy if exists beat_postings_read_own on public.beat_postings;
create policy beat_postings_read_own on public.beat_postings
  for select to authenticated using (poster_user_id = auth.uid());
drop policy if exists beat_postings_insert_own on public.beat_postings;
create policy beat_postings_insert_own on public.beat_postings
  for insert to authenticated with check (poster_user_id = auth.uid());
drop policy if exists beat_postings_update_own on public.beat_postings;
create policy beat_postings_update_own on public.beat_postings
  for update to authenticated using (poster_user_id = auth.uid()) with check (poster_user_id = auth.uid());
drop policy if exists beat_postings_delete_own on public.beat_postings;
create policy beat_postings_delete_own on public.beat_postings
  for delete to authenticated using (poster_user_id = auth.uid());

-- Posting↔subcategory: readable when the parent posting is readable (active or own);
-- writable only by the posting's owner.
alter table public.beat_posting_subcategories enable row level security;
drop policy if exists beat_posting_subcats_read on public.beat_posting_subcategories;
create policy beat_posting_subcats_read on public.beat_posting_subcategories
  for select using (
    exists (select 1 from public.beat_postings p
            where p.id = posting_id and (p.status = 'active' or p.poster_user_id = auth.uid()))
  );
drop policy if exists beat_posting_subcats_insert_own on public.beat_posting_subcategories;
create policy beat_posting_subcats_insert_own on public.beat_posting_subcategories
  for insert to authenticated with check (public.owns_beat_posting(posting_id));
drop policy if exists beat_posting_subcats_delete_own on public.beat_posting_subcategories;
create policy beat_posting_subcats_delete_own on public.beat_posting_subcategories
  for delete to authenticated using (public.owns_beat_posting(posting_id));

-- Partner packages: private to the holder.
alter table public.beat_partner_packages enable row level security;
drop policy if exists beat_partner_packages_select_own on public.beat_partner_packages;
create policy beat_partner_packages_select_own on public.beat_partner_packages
  for select to authenticated using (holder_user_id = auth.uid());
drop policy if exists beat_partner_packages_insert_own on public.beat_partner_packages;
create policy beat_partner_packages_insert_own on public.beat_partner_packages
  for insert to authenticated with check (holder_user_id = auth.uid());
drop policy if exists beat_partner_packages_update_own on public.beat_partner_packages;
create policy beat_partner_packages_update_own on public.beat_partner_packages
  for update to authenticated using (holder_user_id = auth.uid()) with check (holder_user_id = auth.uid());

-- Transactions: private to the payer (read + insert own). Lifecycle (status flips,
-- Stripe ids) is handled server-side via the service role, which bypasses RLS.
alter table public.beat_transactions enable row level security;
drop policy if exists beat_transactions_select_own on public.beat_transactions;
create policy beat_transactions_select_own on public.beat_transactions
  for select to authenticated using (payer_user_id = auth.uid());
drop policy if exists beat_transactions_insert_own on public.beat_transactions;
create policy beat_transactions_insert_own on public.beat_transactions
  for insert to authenticated with check (payer_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7) Seed — HIRING families only (§D: the gated SERVICE families — Creative &
--    Production Services, Photography & Content Creation, Coaching/Training — are
--    DELIBERATELY NOT seeded until §D is settled; add them as data then).
--    Film/TV, Cruise, Theme Park live as SUBCATEGORIES (setting deferred, §E.1).
-- ----------------------------------------------------------------------------
insert into public.beat_categories (slug, label, sort_order) values
  ('teaching-classes',    'Teaching & Classes',   1),
  ('choreography',        'Choreography',         2),
  ('auditions-company',   'Auditions & Company',  3),
  ('studio-admin-support','Studio Admin & Support', 4)
on conflict (slug) do nothing;

insert into public.beat_subcategories (category_id, slug, label, sort_order)
select c.id, v.slug, v.label, v.sort_order
from (values
  ('teaching-classes','pop-up-class','Pop-up Class',1),
  ('teaching-classes','faculty-sub','Faculty Sub',2),
  ('teaching-classes','guest-teacher','Guest Teacher',3),
  ('teaching-classes','summer-intensive','Summer Intensive',4),
  ('teaching-classes','masterclass','Masterclass',5),
  ('teaching-classes','college-event','College Event',6),
  ('choreography','competition','Competition',1),
  ('choreography','concert-stage','Concert / Stage',2),
  ('choreography','commercial','Commercial',3),
  ('choreography','recital','Recital',4),
  ('choreography','musical-theatre','Musical Theatre',5),
  ('choreography','other','Other',9),
  ('auditions-company','dance-company-audition','Dance Company Audition',1),
  ('auditions-company','commercial-audition','Commercial / Industry Audition',2),
  ('auditions-company','film-television','Film & Television',3),
  ('auditions-company','cruise-line','Cruise Line',4),
  ('auditions-company','theme-park','Theme Park',5),
  ('auditions-company','other','Other',9),
  ('studio-admin-support','front-desk','Front Desk / Reception',1),
  ('studio-admin-support','recital-coordination','Recital Coordination',2),
  ('studio-admin-support','competition-prep','Competition Prep',3),
  ('studio-admin-support','studio-management','Studio Management',4),
  ('studio-admin-support','other','Other',9)
) as v(cat_slug, slug, label, sort_order)
join public.beat_categories c on c.slug = v.cat_slug
on conflict (category_id, slug) do nothing;

commit;

-- ============================================================================
-- END. The Beat hiring-side is ready: admin-managed taxonomy, postings (multi-
-- subcategory, 30-day expiry, portfolio media), partner packages, a transactions
-- ledger, and own-row/active-public RLS. Self-marketing/service lanes are gated
-- behind §D; Stripe checkout + member-pricing lookups come in the next step.
-- ============================================================================
