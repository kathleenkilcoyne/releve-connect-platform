-- ============================================================================
-- Relevé Connect — ONE-PASTE database setup
-- ----------------------------------------------------------------------------
-- This file is schema.sql + supabase/seed.sql combined, so you can set up the
-- whole database in a single copy-paste into the Supabase SQL Editor.
-- Safe to run more than once.
-- ============================================================================

-- ============================================================================
-- Relevé Connect — Database Schema (DRAFT for review)
-- ============================================================================
-- This is the blueprint for how all data is stored. It is a DRAFT: we review it
-- together in plain English before turning it into real database migrations in
-- Supabase. Nothing here has been applied to a live database yet.
--
-- How to read this file (for a non-engineer):
--   • A "table" is like a spreadsheet tab. Each row is one record.
--   • A "column" is a field on that record (e.g. a person's email).
--   • A "primary key" (PK) is the unique ID for a row.
--   • A "foreign key" (FK) is a column that points at another table's row —
--     that's how a profile "belongs to" a user, for example.
--   • A "join table" links two tables in a many-to-many way (e.g. one profile
--     can have many styles, and one style belongs to many profiles).
--
-- Design priorities (from CLAUDE.md):
--   1. Search & scale — categories are structured, controlled, and indexed.
--   2. No re-architecture later — the connection record is built to grow into
--      messaging / booking / ratings without being torn up.
--   3. Data portability — plain Postgres, fully exportable.
--
-- Target: PostgreSQL (via Supabase). Uses gen_random_uuid() for IDs.
-- ============================================================================

-- Needed for UUID generation and full-text search helpers.
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ============================================================================
-- SECTION 1 — CONTROLLED VOCABULARIES (the categorization spine)
-- ----------------------------------------------------------------------------
-- These are the "pick lists" that keep search consistent. An admin can add new
-- terms to these tables WITHOUT a code change. Everything a profile is tagged
-- with points back to one of these rows — never free text.
-- ============================================================================

-- Dance styles: Ballet, Jazz, Hip-Hop, Contemporary, Tap, etc.
create table styles (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- machine name, e.g. 'hip-hop'
  label       text not null,                 -- display name, e.g. 'Hip-Hop'
  sort_order  int  not null default 0,
  is_active   boolean not null default true, -- hide without deleting
  created_at  timestamptz not null default now()
);

-- Teaching / dancing levels: Beginner → Professional.
create table levels (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  label       text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Choreographer focus areas: Competition, Concert/Stage, Commercial, Film/TV, etc.
create table focus_areas (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  label       text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Geographic regions (for coarse "where" filtering, above city/state).
create table regions (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  label       text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Professional role types: teacher, choreographer, working_dancer, studio_owner.
-- (Kept as a table so it's consistent and future terms are easy to add.)
create table role_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  label       text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Disciplines — a broader grouping if we need it later (kept per CLAUDE.md 3).
create table disciplines (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  label       text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- SECTION 2 — ACCOUNTS
-- ----------------------------------------------------------------------------
-- One row per person or studio who can log in. account_type keeps talent and
-- employers strictly separate (Guardrail #3).
-- ============================================================================

create type account_type as enum ('talent', 'employer', 'admin');
create type account_status as enum ('invited', 'active', 'suspended');

create table users (
  user_id       uuid primary key default gen_random_uuid(),
  -- Note: with Supabase Auth this id will mirror auth.users.id. Kept explicit
  -- here so the schema reads on its own.
  email         text unique not null,
  account_type  account_type not null,
  display_name  text,
  status        account_status not null default 'invited',
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- SECTION 3 — TALENT PROFILE (the product)
-- ----------------------------------------------------------------------------
-- The rich, self-managed professional identity. This is what employers search.
-- ============================================================================

create type age_range        as enum ('18-24', '25-34', '35-50', '50+');
create type profile_review    as enum ('pending', 'in-review', 'approved');
create type publish_status     as enum ('draft', 'published');
create type visibility_status  as enum ('public', 'unlisted');
create type choreographer_tier as enum ('emerging', 'established', 'featured', 'signature');
create type founder_distinction as enum ('none', 'founding_25', 'first_50');

create table talent_profiles (
  profile_id      uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(user_id) on delete cascade,

  -- Identity
  display_name    text not null,
  public_slug     text unique not null,     -- the shareable URL handle
  primary_role    text,                     -- explicit primary designation (FK-ish to role_types.slug)
  city            text,
  state_province  text,
  country         text,
  region_id       uuid references regions(id),
  age_range       age_range,

  -- Presentation
  headshot_url    text,
  bio             text,                      -- narrative story (min word count enforced in app)
  years_experience text,                     -- stored as the chosen band, e.g. '6-10'
  credentials     text,
  availability    text,
  resume_url      text,                      -- uploaded file

  -- Media — stored as JSON so the shape can grow (labels, ordering, type).
  -- Designed so reels can LATER become sellable catalog pieces (CLAUDE.md 3).
  social_links    jsonb not null default '{}'::jsonb,   -- {website, instagram, vimeo, youtube, linkedin}
  video_reels     jsonb not null default '[]'::jsonb,   -- [{label, url, kind:'teaching|choreography|performance', order}]

  -- Status & standing
  status              profile_review     not null default 'pending',
  profile_status      publish_status     not null default 'draft',
  visibility          visibility_status  not null default 'public',
  verification_flag   boolean            not null default false, -- Certified (admin-granted)
  certified_eligible_at timestamptz,       -- set ~60 days after activation; admin grants after
  choreographer_tier  choreographer_tier not null default 'emerging',
  founder_distinction founder_distinction not null default 'none',

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Full-text search vector over name + bio (kept up to date by a trigger below).
  search_tsv      tsvector
);

-- Structured resume entries (training, companies, credits, education) — separate
-- rows so a resume can have many entries and stay queryable.
create type resume_entry_kind as enum ('training', 'company', 'credit', 'education');

create table resume_entries (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references talent_profiles(profile_id) on delete cascade,
  kind        resume_entry_kind not null,
  title       text not null,          -- e.g. role, program, or organization
  organization text,
  detail      text,
  start_year  int,
  end_year    int,
  sort_order  int not null default 0
);

-- ------ Join tables: profile ↔ controlled vocabularies (many-to-many) ------

create table profile_roles (
  profile_id uuid not null references talent_profiles(profile_id) on delete cascade,
  role_id    uuid not null references role_types(id),
  primary key (profile_id, role_id)
);

create table profile_styles (
  profile_id uuid not null references talent_profiles(profile_id) on delete cascade,
  style_id   uuid not null references styles(id),
  primary key (profile_id, style_id)
);

create table profile_levels (
  profile_id uuid not null references talent_profiles(profile_id) on delete cascade,
  level_id   uuid not null references levels(id),
  primary key (profile_id, level_id)
);

create table profile_focus_areas (
  profile_id    uuid not null references talent_profiles(profile_id) on delete cascade,
  focus_area_id uuid not null references focus_areas(id),
  primary key (profile_id, focus_area_id)
);

-- ============================================================================
-- SECTION 4 — EMPLOYER PROFILE (Studio)
-- ----------------------------------------------------------------------------
-- Lighter than a talent profile. Its real surface is the search tools, not
-- self-promotion.
-- ============================================================================

create table employer_profiles (
  employer_id   uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(user_id) on delete cascade,
  name          text not null,
  city          text,
  state_province text,
  country       text,
  logo_url      text,
  bio           text,
  links         jsonb not null default '{}'::jsonb,
  verified      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================================
-- SECTION 5 — BADGES
-- ----------------------------------------------------------------------------
-- Three DISTINCT classes (CLAUDE.md 3B). Credential + Founder distinction are
-- mostly derived/admin-set on the profile itself. The self-selected "Open-To"
-- engagement badges live here as their own controlled list + join table.
-- ============================================================================

create table open_to_badges (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  label      text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

create table profile_open_to_badges (
  profile_id uuid not null references talent_profiles(profile_id) on delete cascade,
  badge_id   uuid not null references open_to_badges(id),
  primary key (profile_id, badge_id)
);

-- Credential badges are rendered from evidence captured in the application:
-- degrees, certifications, union affiliations. Stored structured so the badge
-- can be rendered from the fact.
create table profile_credentials (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references talent_profiles(profile_id) on delete cascade,
  kind       text not null,   -- 'degree' | 'certification' | 'union'
  value      text not null,   -- e.g. 'BFA', 'AEA', 'ABT Certified'
  created_at timestamptz not null default now()
);

-- ============================================================================
-- SECTION 6 — CONNECTION / CONTACT (built to grow — do NOT make fire-and-forget)
-- ----------------------------------------------------------------------------
-- The durable home of a working relationship. Today it records views, saves,
-- and the lean in-app intro request. Tomorrow, messaging / scheduling / booking
-- / ratings layer on top WITHOUT re-architecture (CLAUDE.md 6).
-- ============================================================================

create type connection_type as enum ('view', 'save', 'message-request');

create table connections (
  connection_id uuid primary key default gen_random_uuid(),
  from_user_id  uuid not null references users(user_id) on delete cascade,
  to_profile_id uuid not null references talent_profiles(profile_id) on delete cascade,
  type          connection_type not null,
  message       text,                 -- the intro note, when type = message-request
  status        text not null default 'open',  -- open | responded | closed (extensible)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Employer shortlist (saved talent, with private notes).
create table shortlists (
  shortlist_id uuid primary key default gen_random_uuid(),
  employer_id  uuid not null references employer_profiles(employer_id) on delete cascade,
  profile_id   uuid not null references talent_profiles(profile_id) on delete cascade,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (employer_id, profile_id)
);

-- ============================================================================
-- SECTION 7 — RATINGS / REVIEWS (schema now; flow is a later rail)
-- ----------------------------------------------------------------------------
-- Two-sided peer reputation. A review can ONLY exist against a recorded
-- connection. HARD RULE: never about a student or minor — enforced in app copy
-- and moderation, and structurally by tying every review to a professional
-- connection between the two parties.
-- ============================================================================

create type review_direction as enum ('studio_to_teacher', 'teacher_to_studio');
create type reveal_status    as enum ('hidden', 'revealed');

create table reviews (
  review_id     uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connections(connection_id) on delete cascade,
  reviewer_id   uuid not null references users(user_id),
  reviewee_id   uuid not null references users(user_id),
  direction     review_direction not null,

  -- Structured scores (1–5). Which set applies depends on direction.
  -- studio → teacher: professionalism, timeliness, preparedness
  -- teacher → studio: courtesy, professionalism, payment_clean
  score_a       int check (score_a between 1 and 5),
  score_b       int check (score_b between 1 and 5),
  score_c       int check (score_c between 1 and 5),

  comment       text,
  reciprocal_reveal_status reveal_status not null default 'hidden',
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- SECTION 8 — MEMBERSHIP (payment / activation — simple, one-way)
-- ----------------------------------------------------------------------------
-- A profile publishes and appears in search ONLY when membership_status = active.
-- Simple one-way Stripe charge. No split, no Stripe Connect (that's out of scope).
-- ============================================================================

create type membership_status as enum ('pending', 'active', 'lapsed', 'canceled');

create table memberships (
  membership_id        uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(user_id) on delete cascade,
  tier                 text not null,     -- e.g. 'individual_99', 'studio_249' (maps to a Stripe Price)
  price_cents          int,
  term                 text not null default 'annual',
  stripe_customer_id   text,
  stripe_subscription_id text,
  membership_status    membership_status not null default 'pending',
  renewal_date         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ============================================================================
-- SECTION 9 — APPLICATION INTAKE (the 13-section form, CLAUDE.md 3A)
-- ----------------------------------------------------------------------------
-- Captures a submission (or an in-progress draft) as one DB source of truth.
-- The full role-branched answers are held in JSONB so the form can evolve; the
-- key routing fields are promoted to real columns for querying and admin review.
-- On approval, an admin action promotes this into a talent/employer profile.
-- ============================================================================

create type application_state as enum ('draft', 'submitted', 'in-review', 'approved', 'more-info', 'declined');

create table applications (
  application_id  uuid primary key default gen_random_uuid(),
  user_id         uuid references users(user_id) on delete set null, -- may be null pre-account
  email           text not null,
  first_name      text,
  last_name       text,
  roles           text[],            -- selected role slugs (branch the form)
  primary_role    text,
  state           application_state not null default 'draft',

  answers         jsonb not null default '{}'::jsonb,  -- full 13-section payload
  consents        jsonb not null default '{}'::jsonb,  -- the five Section-13 agreements

  resume_token    text unique,       -- for the save-and-resume link
  resume_expires_at timestamptz,     -- 14-day window
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================================
-- SECTION 10 — INDEXES (make search fast at national scale)
-- ============================================================================

-- Full-text search over talent name + bio.
create index talent_profiles_search_idx on talent_profiles using gin (search_tsv);

-- Fuzzy name matching for the directory search box.
create index talent_profiles_name_trgm_idx on talent_profiles using gin (display_name gin_trgm_ops);

-- Common filter/lookup indexes.
create index talent_profiles_publish_idx  on talent_profiles (profile_status, visibility);
create index talent_profiles_region_idx   on talent_profiles (region_id);
create index profile_styles_style_idx     on profile_styles (style_id);
create index profile_levels_level_idx     on profile_levels (level_id);
create index profile_focus_focus_idx      on profile_focus_areas (focus_area_id);
create index connections_to_profile_idx   on connections (to_profile_id);
create index shortlists_employer_idx      on shortlists (employer_id);
create index memberships_user_idx         on memberships (user_id);
create index applications_state_idx       on applications (state);

-- ============================================================================
-- SECTION 11 — KEEP THE SEARCH VECTOR UP TO DATE
-- ----------------------------------------------------------------------------
-- Whenever a profile's name or bio changes, refresh its full-text search field.
-- ============================================================================

create or replace function talent_profiles_tsv_refresh() returns trigger as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('english', coalesce(new.display_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.bio, '')), 'B');
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger talent_profiles_tsv_trg
  before insert or update of display_name, bio on talent_profiles
  for each row execute function talent_profiles_tsv_refresh();

-- ============================================================================
-- END OF DRAFT SCHEMA
-- ----------------------------------------------------------------------------
-- Not yet applied to any database. Next step after review: turn this into
-- Supabase migrations, seed the controlled-vocabulary tables with the starter
-- lists from CLAUDE.md 3A, and add Row-Level Security policies so people can
-- only see/edit what they should.
-- ============================================================================


-- ============================================================================
-- Relevé Connect — Seed data for the controlled vocabularies (pick-lists)
-- ----------------------------------------------------------------------------
-- These are the starter category lists from CLAUDE.md Section 3A. They fill the
-- "pick-list" tables so the profile builder and search filters have options to
-- show. Safe to run more than once (existing terms are skipped).
--
-- ⚠️ These are STARTERS. The exact final lists still need Kathleen's sign-off
--    (Open Decision 3). Adding/renaming later is just an admin task — no code change.
-- ============================================================================

-- --- Professional role types ------------------------------------------------
insert into role_types (slug, label, sort_order) values
  ('teacher',        'Teacher',        1),
  ('choreographer',  'Choreographer',  2),
  ('working_dancer', 'Working Dancer', 3),
  ('studio_owner',   'Studio Owner',   4)
on conflict (slug) do nothing;

-- --- Dance styles -----------------------------------------------------------
insert into styles (slug, label, sort_order) values
  ('ballet',          'Ballet',          1),
  ('pointe',          'Pointe',          2),
  ('variations',      'Variations',      3),
  ('jazz',            'Jazz',            4),
  ('hip-hop',         'Hip-Hop',         5),
  ('contemporary',    'Contemporary',    6),
  ('modern',          'Modern',          7),
  ('tap',             'Tap',             8),
  ('lyrical',         'Lyrical',         9),
  ('musical-theatre', 'Musical Theatre', 10),
  ('latin',           'Latin',           11),
  ('ballroom',        'Ballroom',        12),
  ('acro',            'Acro',            13),
  ('improvisation',   'Improvisation',   14),
  ('other',           'Other',           99)
on conflict (slug) do nothing;

-- --- Levels (Beginner → Professional) ---------------------------------------
insert into levels (slug, label, sort_order) values
  ('beginner',         'Beginner',         1),
  ('intermediate',     'Intermediate',     2),
  ('advanced',         'Advanced',         3),
  ('pre-professional', 'Pre-Professional', 4),
  ('professional',     'Professional',     5)
on conflict (slug) do nothing;

-- --- Choreographer focus areas ----------------------------------------------
insert into focus_areas (slug, label, sort_order) values
  ('competition',          'Competition',          1),
  ('concert-stage',        'Concert / Stage',      2),
  ('commercial',           'Commercial',           3),
  ('theatre-mt',           'Theatre / MT',         4),
  ('film-tv',              'Film / TV',            5),
  ('lyrical-contemporary', 'Lyrical / Contemporary', 6),
  ('ballet',               'Ballet',               7),
  ('jazz',                 'Jazz',                 8),
  ('hip-hop',              'Hip-Hop',              9),
  ('tap',                  'Tap',                  10),
  ('other',                'Other',                99)
on conflict (slug) do nothing;

-- --- Regions (PLACEHOLDER — confirm the real list with Kathleen) -------------
insert into regions (slug, label, sort_order) values
  ('northeast',     'Northeast',      1),
  ('southeast',     'Southeast',      2),
  ('midwest',       'Midwest',        3),
  ('southwest',     'Southwest',      4),
  ('west',          'West',           5),
  ('pacific-nw',    'Pacific Northwest', 6),
  ('international',  'International',   9)
on conflict (slug) do nothing;

-- --- Open-To engagement badges (self-selected, CLAUDE.md 3B class B) ---------
insert into open_to_badges (slug, label, sort_order) values
  ('teaching-new-classes',   'Teaching new classes',              1),
  ('substituting',           'Substituting via The Swing',        2),
  ('choreographing',         'Choreographing on commission',      3),
  ('licensing',              'Licensing pieces',                  4),
  ('auditioning',            'Auditioning via The Beat',          5),
  ('speaking',               'Speaking on a panel / Relevé Live', 6),
  ('social-posting',         'Publicly posting for Relevé on social', 7),
  ('other',                  'Other',                             99)
on conflict (slug) do nothing;
