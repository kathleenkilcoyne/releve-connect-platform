-- ============================================================================
-- Relevé Connect — Database Schema (documentation of the LIVE database)
-- ============================================================================
-- This is the blueprint for how all data is stored.
--
-- ⚠️ WHAT THIS FILE IS, AS OF 2026-08-17 — READ THIS FIRST.
--   This file started life as a DRAFT written before anything existed ("nothing
--   here has been applied to a live database yet"). That has not been true for a
--   long time. Sections 1–19 below describe tables that are LIVE in the Supabase
--   project, and for a while this file documented only about half of what
--   production actually contained.
--
--   It is NOT executable and it is NOT the source of truth. The executable
--   source of truth is `supabase/migrations/*.sql`, applied in filename order.
--   THIS file is the readable narrative — what each table is FOR — kept in step
--   with the database so a non-engineer can understand the shape of the system.
--
--   SECTION 20 (at the foot of this file) is the reconciliation: every object
--   that exists live but was never written up here, generated directly from the
--   live catalog on 2026-08-17 so it is mechanically faithful rather than
--   remembered. Section 20 also records the exact query to re-verify.
--
--   If you are adding a table: write the migration first, apply it, THEN update
--   this file. If the two disagree, the database wins and this file is stale.
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

-- account_type is IDENTITY only. What someone BOUGHT (Live Pass, Studio Growth,
-- Accelerator, Senior Spotlight license, Founding-25) lives in the entitlements
-- layer (memberships / experience_purchases / founder_distinction) — NEVER here.
-- 'consumer' = an individual who buys but isn't vetted talent or an employer studio
-- (e.g. Live Pass members, one-time Senior Spotlight $499 buyers). Ratified 2026-07-11.
create type account_type as enum ('talent', 'employer', 'admin', 'consumer');
create type account_status as enum ('invited', 'active', 'suspended');

create table users (
  user_id       uuid primary key default gen_random_uuid(),
  -- Note: with Supabase Auth this id will mirror auth.users.id. Kept explicit
  -- here so the schema reads on its own.
  email         text unique not null,
  account_type  account_type not null,
  display_name  text,
  status        account_status not null default 'invited',
  -- The onboarding gateway choice ("How are you joining Relevé?"), persisted so a
  -- returning user routes straight to their flow and never re-sees the gateway.
  -- Null = hasn't chosen yet. Added by migration 20260806120000_onboarding_gateway.
  onboarding_intent text
    check (onboarding_intent is null
           or onboarding_intent in ('professional', 'studio', 'team', 'partner')),
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
  -- Visual-first profile media (build spec §6; migration 20260712000000):
  teaching_reel_url text,                                -- the hero video (Vimeo/YouTube), highest-value item above the fold
  gallery_urls    jsonb not null default '[]'::jsonb,    -- ordered list of up to 8 photo URLs, rendered as a grid

  -- Status & standing
  status              profile_review     not null default 'pending',
  profile_status      publish_status     not null default 'draft',
  visibility          visibility_status  not null default 'public',
  verification_flag   boolean            not null default false, -- Verified Member: identity/standing mark, NOT a competence stamp. Granted at profile creation once vetting is complete (approved + paid) — no waiting period (founder decision 2026-07-12, supersedes the old ~60-day rule)
  certified_eligible_at timestamptz,       -- timestamp the Verified Member mark was granted (set when verification_flag flips true)
  -- Editorial honorifics carried from the approved application (build spec §13). SERVER-STAMPED
  -- at profile creation — never set from the profile form (conferred by Kathleen, not self-selected).
  honorifics          text[]             not null default '{}',
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

-- §7 studio profile. Fleshed out by migration 20260713000000_studio_profile_and_accounts.sql
-- (applied live + mirrored here). Studios sign up via LIGHT ONBOARDING — no $30 fee,
-- no approval queue (founder decision 2026-07-13): they are the buyer side, not vetted talent.
create table employer_profiles (
  employer_id   uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(user_id) on delete cascade,
  name          text not null,
  website       text,
  -- Full address (drives the map pin + accessibility block, §7).
  address_line1  text,
  address_line2  text,
  city          text,
  state_province text,
  postal_code   text,
  country       text,
  -- Map pin — NULLABLE, geocoded from the address in a later slice ("build the
  -- column, fill it later"). Unlocks the deferred radius search (§8) + Swing geo-match.
  lat           double precision,
  lng           double precision,
  geocoded_at   timestamptz,
  -- Studio facts a sub needs (§7).
  year_founded       int check (year_founded is null or (year_founded between 1800 and (extract(year from now())::int + 1))),
  student_count_band text check (student_count_band is null or student_count_band in ('under_50','50_99','100_199','200_plus')),
  staff_count        int check (staff_count is null or staff_count >= 0),
  room_count         int check (room_count is null or room_count >= 0),
  -- Accessibility / "getting there" block (§7) — the differentiator.
  nearest_transit    text,    -- nearest train line(s)/station, bus route(s) — free text
  car_required       boolean,
  parking            text check (parking is null or parking in ('onsite','street','none')),
  directions_note    text,
  culture_note       text,
  logo_url      text,
  bio           text,
  links         jsonb not null default '{}'::jsonb,
  verified      boolean not null default false,       -- Verified Employer badge (Growth tier); set by admin, not self
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index employer_profiles_geo_idx on employer_profiles (lat, lng) where lat is not null and lng is not null;

-- §7 concentration/focus vocab (studio-specific — distinct from choreographer focus_areas).
create table studio_concentrations (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,   -- competition, technique-recreational, conservatory-pre-professional
  label      text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Studio ↔ vocab joins (own-row RLS via owns_employer). Styles offered + certs valued
-- reuse the existing styles/certifications vocab; concentration uses studio_concentrations.
create table employer_styles (
  employer_id uuid not null references employer_profiles(employer_id) on delete cascade,
  style_id    uuid not null references styles(id),
  primary key (employer_id, style_id)
);
create index employer_styles_style_idx on employer_styles (style_id);

create table employer_concentrations (
  employer_id      uuid not null references employer_profiles(employer_id) on delete cascade,
  concentration_id uuid not null references studio_concentrations(id),
  primary key (employer_id, concentration_id)
);
create index employer_concentrations_conc_idx on employer_concentrations (concentration_id);

create table employer_certifications (
  employer_id      uuid not null references employer_profiles(employer_id) on delete cascade,
  certification_id uuid not null references certifications(id),
  primary key (employer_id, certification_id)
);
create index employer_certifications_cert_idx on employer_certifications (certification_id);

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

  -- Admin review / decision (added 2026-07-11, vetting-gate migration). The
  -- lifecycle stays in `state`; these hold the DECISION detail.
  city            text,              -- promoted for the admin queue's location filter
  state_province  text,              -- geographic state (NOT the lifecycle `state`)
  approved_tier   choreographer_tier, -- set when a choreographer is approved at a tier
  honorifics      text[] not null default '{}', -- editorial marks conferred by admin
  is_founding_25  boolean not null default false, -- $30 fee waived for invited honorees
  reviewed_by     uuid references users(user_id),
  reviewed_at     timestamptz,
  admin_notes     text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- The $30 application fee ledger — one row per attempt. Written ONLY by the
-- server (service_role: the fee-checkout route + the Stripe webhook); the
-- applicant may read their own. Lifecycle mirrors the ratified rule:
--   pending -> paid -> credited   (accepted AND they subscribe -> $30 off)
--                    -> refunded  (NOT accepted -> full refund)
--                    -> forfeited (accepted but they decline to subscribe)
--   waived  = Founding 25 (invited; never charged)
-- Applied via migration 20260711010000_vetting_gate_application_fee.sql.
create table application_fee_payments (
  id                         uuid primary key default gen_random_uuid(),
  application_id             uuid not null references applications(application_id) on delete cascade,
  user_id                    uuid references users(user_id) on delete set null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text,
  amount_cents               int  not null default 3000,   -- $30.00
  status                     text not null default 'pending'
                               check (status in ('pending','paid','refunded','credited','forfeited','waived')),
  paid_at                    timestamptz,
  resolved_at                timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
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
create index connections_to_profile_idx   on connections (to_profile_id);   -- requests I received
create index connections_from_user_idx    on connections (from_user_id);    -- my saves / sent (migration 20260712020000)
-- One connection of a given type per (sender → target): makes "save" idempotent + upsertable.
create unique index connections_sender_target_type_uniq on connections (from_user_id, to_profile_id, type);
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
-- SECTION 12 — STRIPE CONNECT: THE $499 SIGNATURE EXPERIENCE (Phase-2 seam)
-- ----------------------------------------------------------------------------
-- This is the ONE place Relevé uses Stripe Connect + an 80/20 split. Memberships
-- (Section 8) stay simple one-way charges. See docs/STRIPE-CONNECT-499-LICENSING.md.
-- Applied via migration 20260708120000_stripe_connect_signature_experience.sql.
--
-- talent_profiles gains two columns (shown here for the blueprint):
--   stripe_account_id text            -- the artist's Express "acct_…" (nullable)
--   payouts_enabled   boolean         -- true once Stripe confirms they can be paid
-- memberships gains one column:
--   source            text            -- e.g. 'signature_experience_bundle'
-- ============================================================================

-- The sellable catalog piece — a choreographer's $499 licensable work.
create table signature_works (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references talent_profiles(profile_id) on delete cascade,
  title                 text not null,
  style                 text,
  length_label          text,               -- e.g. '2 min'
  level                 text,
  built_for             text,
  price_cents           int  not null default 49900,   -- $499.00
  vimeo_performance_url text,               -- private / domain-locked (gated)
  vimeo_breakdown_url   text,               -- private / domain-locked (gated)
  count_sheet_url       text,
  music_note            text,
  artistic_intent       text,
  status                publish_status not null default 'draft',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- One purchase = one order + the buyer relationship. Written ONLY by the Stripe
-- webhook (service_role). status: pending → paid → refunded | failed.
create table experience_purchases (
  id                         uuid primary key default gen_random_uuid(),
  signature_work_id          uuid not null references signature_works(id) on delete restrict,
  buyer_user_id              uuid references users(user_id) on delete set null,
  buyer_email                text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text,
  amount_cents               int not null,
  application_fee_cents      int not null default 0,   -- Relevé's 20% (0 if founder no-split)
  artist_transfer_cents      int not null default 0,   -- artist's 80%
  status                     text not null default 'pending'
                               check (status in ('pending', 'paid', 'refunded', 'failed')),
  access_granted_at          timestamptz,
  welcome_booked_at          timestamptz,
  checkin_booked_at          timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- ============================================================================
-- SECTION 13 — THE ROSTER: CERT TAGS + SEARCH VIEW (Step 4)
-- ----------------------------------------------------------------------------
-- Applied via migration 20260712010000_roster_certifications_and_view.sql.
-- ============================================================================

-- Structured, filterable certification vocabulary (build spec §6). Same shape as
-- styles/levels; world-readable; self-reported / searchable, NOT endorsed (§13).
create table certifications (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,   -- abt-ntc, rad, cecchetti, vaganova-balanchine, pbt, acrobatic-arts, other
  label      text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

-- profile ↔ certification (own-row RLS, like profile_styles/profile_levels).
create table profile_certifications (
  profile_id       uuid not null references talent_profiles(profile_id) on delete cascade,
  certification_id uuid not null references certifications(id),
  primary key (profile_id, certification_id)
);
create index profile_certifications_cert_idx on profile_certifications (certification_id);

-- The Roster search view: PUBLISHED + public profiles only, each profile's
-- style/level/cert slugs pre-aggregated as arrays (one array-overlap per facet),
-- plus `owner_active` (does the owner hold an ACTIVE membership right now, so
-- lapsed members drop out of discovery). Read by the SERVER (service role) only —
-- SELECT is revoked from anon/authenticated so the gated directory can't be scraped.
create or replace view roster_profiles as
select
  p.profile_id, p.user_id, p.display_name, p.public_slug, p.primary_role,
  p.city, p.state_province, p.country, p.region_id, p.headshot_url,
  p.verification_flag, p.honorifics, p.years_experience, p.search_tsv,
  coalesce((select array_agg(distinct s.slug)
            from profile_styles ps join styles s on s.id = ps.style_id
            where ps.profile_id = p.profile_id), '{}') as style_slugs,
  coalesce((select array_agg(distinct l.slug)
       
-- ============================================================================
-- SECTION 15 — THE BEAT (hiring-side marketplace) — §9
-- ----------------------------------------------------------------------------
-- Applied via migration 20260713120000_beat_hiring_schema.sql (live + mirrored
-- here). HIRING motion only — "post a role, someone applies". The self-marketing
-- / service motion (coaching, photography, creative & production services,
-- accompanists) is GATED behind founder decision §D (inside The Beat vs a separate
-- vetted directory) — deliberately NOT built here; the gated SERVICE families are
-- NOT seeded. Two-level ADMIN-MANAGED taxonomy; a small stable engagement enum;
-- multi-subcategory postings; 30-day expiry; portfolio media. RLS is defined in
-- the migration (active postings world-readable; poster manages own; packages +
-- transactions private). Naming: poster/holder/payer = the platform user
-- (users.user_id); neutral because a poster may be a studio OR an individual.
-- ============================================================================

create type beat_engagement_type as enum ('audition','employment','freelance_gig','other');
create type beat_posting_type    as enum ('one_off','studio_included','partner_package');
create type beat_posting_status  as enum ('draft','active','expired','closed');
create type beat_partner_tier    as enum ('essential','premier','elite');
create type beat_partner_status  as enum ('active','expired','cancelled');
create type beat_txn_type        as enum ('one_off_post','studio_included_debit','partner_package_purchase','partner_package_debit');
create type beat_txn_status      as enum ('pending','completed','failed');

-- Two-level taxonomy (admin-managed vocab).
create table beat_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, label text not null,
  sort_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table beat_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references beat_categories(id) on delete cascade,
  slug text not null, label text not null,
  sort_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category_id, slug)          -- slug unique WITHIN a family (so "other" can repeat)
);
create index beat_subcategories_category_idx on beat_subcategories (category_id);

-- Annual prepaid posting-credit bundles (College/University partner packages).
create table beat_partner_packages (
  id uuid primary key default gen_random_uuid(),
  holder_user_id uuid not null references users(user_id) on delete cascade,
  package_type beat_partner_tier not null,
  total_credits int not null check (total_credits >= 0),
  credits_used int not null default 0 check (credits_used >= 0),
  credits_remaining int generated always as (total_credits - credits_used) stored,
  starts_at timestamptz not null default now(), ends_at timestamptz,
  status beat_partner_status not null default 'active',
  created_at timestamptz not null default now()
);
create index beat_partner_packages_holder_idx on beat_partner_packages (holder_user_id);

-- The hiring post. Studio "included" posts (annual allowance, reset annually) are
-- just posting_type='studio_included'; the yearly cap is enforced at post-time by
-- counting within the membership year (policy, not a column). union_status is the
-- planned future cross-cutting filter (add as a nullable column when built).
create table beat_postings (
  id uuid primary key default gen_random_uuid(),
  poster_user_id uuid not null references users(user_id) on delete cascade,
  title text not null, description text,
  category_id uuid not null references beat_categories(id),
  engagement_type beat_engagement_type not null default 'other',
  posting_type beat_posting_type not null default 'one_off',
  status beat_posting_status not null default 'draft',
  location text, compensation_info text, application_method text,
  portfolio_links jsonb not null default '[]'::jsonb,     -- [{label,url}] media/samples
  partner_package_id uuid references beat_partner_packages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index beat_postings_poster_idx   on beat_postings (poster_user_id);
create index beat_postings_category_idx on beat_postings (category_id);
create index beat_postings_status_idx   on beat_postings (status);
create index beat_postings_expires_idx  on beat_postings (expires_at);
create index beat_postings_partner_idx  on beat_postings (partner_package_id);

-- A post ↔ many subcategories.
create table beat_posting_subcategories (
  posting_id uuid not null references beat_postings(id) on delete cascade,
  subcategory_id uuid not null references beat_subcategories(id),
  primary key (posting_id, subcategory_id)
);
create index beat_posting_subcategories_sub_idx on beat_posting_subcategories (subcategory_id);

-- Transactions ledger. Stripe columns null until the checkout flow is built.
create table beat_transactions (
  id uuid primary key default gen_random_uuid(),
  payer_user_id uuid not null references users(user_id) on delete cascade,
  amount_cents int not null default 0,
  transaction_type beat_txn_type not null,
  posting_id uuid references beat_postings(id) on delete set null,
  partner_package_id uuid references beat_partner_packages(id) on delete set null,
  status beat_txn_status not null default 'pending',
  stripe_payment_intent_id text, stripe_session_id text,
  created_at timestamptz not null default now()
);
create index beat_transactions_payer_idx   on beat_transactions (payer_user_id);
create index beat_transactions_posting_idx on beat_transactions (posting_id);
create index beat_transactions_partner_idx on beat_transactions (partner_package_id);

-- Ownership helper for posting-scoped RLS (see the migration for policies).
-- create function owns_beat_posting(uuid) returns boolean ... (in migration)

-- ============================================================================
-- ============================================================================
-- SECTION 20 — LIVE-SCHEMA RECONCILIATION (2026-08-17)
-- ============================================================================
-- Everything above this line was written by hand as the system was designed.
-- Everything below was generated FROM THE LIVE SUPABASE CATALOG on 2026-08-17
-- and then annotated, because Sections 1-19 had drifted badly: they documented
-- 37 tables while production carried 74.
--
-- -- Why this section exists --
-- Three tables (`works`, `activations`, `profile_views`) existed in production
-- with no migration file anywhere on the working branch, and four migrations had
-- been applied by hand in the Supabase SQL editor with no file in Git at all.
-- Before Profile V2 or Choreo License writes any database code, this file has to
-- stop being a partial fiction. Nothing in the live database was changed to
-- produce this section — it is a read-only transcription.
--
-- -- Project transcribed --
--   Supabase project `hmqqxbkhcqspqmsjxodq` ("Releve connect project", us-east-2)
--   — the same project configured in .env.local. Postgres 17.6.
--
-- -- HOW TO RE-VERIFY (run read-only whenever you suspect drift) --
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_type = 'BASE TABLE'
--   order by table_name;
--   ...then grep this file for each name. 74 tables + 1 view as of 2026-08-17.
--
-- -- Style note --
-- The DDL below is machine-derived, so it is verbose where the hand-written
-- sections are chatty: constraints are named explicitly and types are spelled the
-- way Postgres spells them (timestamp with time zone, not timestamptz). That is
-- deliberate — a transcription diffable against the catalog is worth more here
-- than one that reads prettily.
--
-- -- NOT executable --
-- Nothing in Section 20 should ever be run against the live database. Every
-- object below ALREADY EXISTS. The statements are written with IF NOT EXISTS so
-- an accidental run is a no-op, but the source of truth for applying changes is
-- supabase/migrations/*.sql, never this file.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 20.1 — ENUM TYPES (complete live inventory, 39 types)
-- ----------------------------------------------------------------------------
-- Labels are listed in creation order, which is also sort order. Adding a label
-- is `alter type ... add value if not exists`; labels can never be removed.
--
--   account_status              = invited, active, suspended
--   account_type                = talent, employer, admin, consumer
--   affiliation_role            = student, teacher, staff
--   affiliation_status          = active, pending, ended
--   affiliation_subject         = talent, student
--   age_range                   = 18-24, 25-34, 35-50, 50+
--   application_state           = draft, submitted, in-review, approved, more-info, declined
--   beat_engagement_type        = audition, employment, freelance_gig, other
--   beat_partner_status         = active, expired, cancelled
--   beat_partner_tier           = essential, premier, elite
--   beat_posting_status         = draft, active, expired, closed
--   beat_posting_type           = one_off, studio_included, partner_package
--   beat_txn_status             = pending, completed, failed
--   beat_txn_type               = one_off_post, studio_included_debit, partner_package_purchase, partner_package_debit
--   choreographer_tier          = emerging, established, featured, signature
--   class_session_status        = scheduled, moved, canceled
--   communication_direction     = from_studio, from_family
--   communication_kind          = alert, announcement, message, note
--   communication_severity      = change, cancellation
--   connection_type             = view, save, message-request
--   earning_status              = pending, approved, paid, void
--   engagement_kind             = ongoing, substitution, one_off
--   engagement_status           = active, ended
--   enrollment_status           = active, waitlisted, dropped
--   family_subscription_status  = none, trialing, active, past_due, canceled
--   founder_distinction         = none, founding_25, first_50, founding_professional
--   guardian_permission         = billing, calendar, messages, medical_forms, pickup_authorization
--   membership_status           = pending, active, lapsed, canceled
--   personal_event_category     = taking, rehearsing, auditioning, coaching, performance, personal, deadline, availability
--   profile_review              = pending, in-review, approved
--   publish_status              = draft, published
--   rate_source                 = platform_set, teacher_set, negotiated
--   rate_unit                   = hourly, per_session, per_student
--   resume_entry_kind           = training, company, credit, education
--   reveal_status               = hidden, revealed
--   review_direction            = studio_to_teacher, teacher_to_studio
--   studio_class_kind           = class, rehearsal, performance, competition, audition, workshop, deadline
--   studio_staff_role           = admin, teacher, front_desk
--   visibility_status           = public, unlisted
--
-- Note: choreographer_tier carries FOUR labels live — "featured" sits between
-- established and signature — while the pricing SSOT names only three. Not a bug
-- to fix here; just a fact the next tier decision has to account for.


-- ----------------------------------------------------------------------------
-- 20.2 — COLUMNS ADDED TO TABLES THAT SECTIONS 1-19 ALREADY DESCRIBE
-- ----------------------------------------------------------------------------
-- These tables ARE written up above, but those descriptions predate later
-- migrations. Shown as `alter table` for readability. ALL ARE ALREADY APPLIED.

-- talent_profiles: five columns the sections above never list as real columns.
-- (stripe_account_id / payouts_enabled appear above only inside a comment block.)
alter table public.talent_profiles
  add column if not exists stripe_account_id       text,
  add column if not exists payouts_enabled         boolean not null default false,
  add column if not exists teaching_at             text,
  add column if not exists touring_with            text,
  add column if not exists available_for_licensing boolean not null default false;
-- stripe_account_id        Stripe Connect "acct_..." for the Signature Experience
-- payouts_enabled          flipped true by the account.updated webhook
-- teaching_at              free-text "Teaching at ..." line on the public profile
-- touring_with             free-text "Touring with ..." line
-- available_for_licensing  the Licensing capability switch — see `works` in 20.3

-- PROFILE V2 — activation + provenance (migration 20260817221638, applied
-- 2026-08-17). A talent_profiles row is created at ACTIVATION (approved AND an
-- active profile-bearing membership, paid or authorized comp), seeded ONCE from
-- the accepted application, and always created as a DRAFT. The application is
-- preserved unchanged as the historical vetting record; there is no two-way sync.
alter table public.talent_profiles
  add column if not exists prefilled_from_application_id uuid
    references public.applications(application_id) on delete set null,
  add column if not exists prefilled_at        timestamptz,
  add column if not exists teaching_philosophy text,
  add column if not exists adaptive_experience text,
  add column if not exists choreographer_years text;
-- prefilled_from_application_id  provenance: which accepted application seeded this
--                               profile. ON DELETE SET NULL — a member's professional
--                               record must survive deletion of their paperwork.
--                               NULL is meaningful: a Founding Professional (never
--                               applied), or a profile predating Profile V2.
-- prefilled_at                   when the one-time seed ran. Non-null = done, never repeat.
-- teaching_philosophy            narrative; the application's four teaching prompts
-- adaptive_experience            adaptive / inclusive dance experience (its own column
--                               so it stays findable rather than buried in prose)
-- choreographer_years            years choreographing — DISTINCT from years_experience
--                               (overall career length). Text, because the application
--                               asks for free text and we preserve what was written.
--
-- ONE PROFILE PER PERSON, enforced by the database rather than by an application-
-- level existence check — activation fires from a Stripe webhook, an admin approve
-- click, and a sign-in claim, any two of which can race:
create unique index if not exists talent_profiles_user_id_key
  on public.talent_profiles (user_id);
create index if not exists talent_profiles_prefilled_from_idx
  on public.talent_profiles (prefilled_from_application_id)
  where prefilled_from_application_id is not null;

-- users: the onboarding gateway's memory of which door someone chose.
alter table public.users
  add column if not exists onboarding_intent text;   -- professional | studio | team | partner

-- connections: the intro-request rail grew a body and a lifecycle.
alter table public.connections
  add column if not exists message    text,
  add column if not exists status     text,
  add column if not exists updated_at timestamp with time zone;

-- memberships: how the row came to exist (founding_comp, signature_experience_bundle, ...).
alter table public.memberships
  add column if not exists source text;

-- employer_profiles: described above as a light stub; live it carries 48 columns
-- (address + geocoding, story fields, branding, org_type/team_type for the Dance
-- Teams umbrella, public_slug, and the invited-studio status lifecycle). Rather
-- than restate them all, see the migrations that built it, in order:
--   20260713000000_studio_profile_and_accounts . 20260723000000_student_count_bands
--   20260725000000_studio_story_fields . 20260728000000_founding_studio_onboarding
--   20260729190000_employer_public_slug . 20260805120000_dance_teams_umbrella
--   20260806120000_org_branding
-- applications: see 20260720172555_application_draft_fields (draft_fields,
--   draft_saved_at, resume_email_sent_at) and 20260711010000_vetting_gate_application_fee.
-- studio_classes: gains `kind`, `event_type`, `studio_wide`, `series_start/end` —
--   see 20.4 for the full live definition.


-- ----------------------------------------------------------------------------
-- 20.3 — THE PROFESSIONAL / PROFILE LAYER (tables never documented above)
-- ----------------------------------------------------------------------------

-- WORKS — choreography a professional makes available to license.
-- Live since 2026-08-11 (migration 20260811235453_works_and_licensing). This is
-- the table the Choreo License build must reckon with BEFORE designing anything
-- new: it is a reviewed portfolio, not a listing. Currently 0 rows.
--   · One owner, via profile_id. No co-creators, no splits.
--   · `license_type` is FREEFORM TEXT despite its name — the UI labels it
--     "Licensing note". There is no rights vocabulary anywhere. Do not mistake
--     this column for a taxonomy.
--   · `status` is the only CHECK: draft -> submitted -> in_review -> approved |
--     returned | declined. Only `approved` is ever public.
--   · NO pricing, NO purchase, NO entitlement, NO payout, NO protected delivery.
-- Distinct from `signature_works` (the live $499 Senior Spotlight product, which
-- DOES transact). The two tables do not reference each other.
create table if not exists public.works (
  work_id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  title text not null,
  work_type text,
  style text,
  cast_size text,
  duration text,
  level_audience text,
  year_created integer,
  description text,
  preview_video_url text,
  origin text,
  license_type text,
  status text not null default 'draft'::text,
  review_notes text,
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint works_pkey PRIMARY KEY (work_id),
  constraint works_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE,
  constraint works_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'in_review'::text, 'returned'::text, 'approved'::text, 'declined'::text])))
);
-- index works_profile_idx on (profile_id, status)
-- RLS: works_owner_all (authenticated, owns_talent_profile) +
--      works_public_read (anon/authenticated: approved AND the profile is
--      published + public + available_for_licensing)

-- PROFILE_VIEWS — who looked at a profile. Feeds the "Profile Activity" counts
-- on the professional home. viewer_id is null for a logged-out visitor.
create table if not exists public.profile_views (
  view_id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  viewer_id uuid,
  created_at timestamp with time zone not null default now(),
  constraint profile_views_pkey PRIMARY KEY (view_id),
  constraint profile_views_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE,
  constraint profile_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- AVAILABILITY_TAGS + PROFILE_AVAILABILITY — the Roster availability facet.
-- Two `kind`s from one table: "general" (when someone can work) and "currently"
-- (what they are taking on right now, e.g. accepting commissions).
create table if not exists public.availability_tags (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  label text not null,
  kind text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint availability_tags_pkey PRIMARY KEY (id),
  constraint availability_tags_slug_key UNIQUE (slug),
  constraint availability_tags_kind_check CHECK ((kind = ANY (ARRAY['general'::text, 'currently'::text])))
);
create table if not exists public.profile_availability (
  profile_id uuid not null,
  availability_tag_id uuid not null,
  constraint profile_availability_pkey PRIMARY KEY (profile_id, availability_tag_id),
  constraint profile_availability_availability_tag_id_fkey FOREIGN KEY (availability_tag_id) REFERENCES availability_tags(id) ON DELETE CASCADE,
  constraint profile_availability_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE
);

-- PERSONAL_EVENTS — the professional's PRIVATE calendar behind "This Week".
-- Owner-only RLS, no read path for anyone else, by design: a personal calendar
-- leaks auditions and medical appointments. Nothing publishes from it
-- automatically — see service_availability (20.4) for the deliberate boundary.
create table if not exists public.personal_events (
  event_id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  category personal_event_category not null,
  title text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone,
  timezone text not null default 'America/New_York'::text,
  location text,
  detail text[] not null default '{}'::text[],
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint personal_events_pkey PRIMARY KEY (event_id),
  constraint personal_events_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE,
  constraint personal_events_ends_after_starts CHECK (((ends_at IS NULL) OR (ends_at > starts_at)))
);

-- SWING_* — The Swing's data capture. Written by nothing today: the profile
-- builder stopped asking for these on 2026-07-24 and the rows are deliberately
-- LEFT ALONE rather than cleared, so anyone who already answered keeps their
-- answers for when Swing actually ships.
create table if not exists public.swing_availability (
  profile_id uuid not null,
  is_available boolean not null default false,
  home_location text,
  travel_radius_miles integer,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint swing_availability_pkey PRIMARY KEY (profile_id),
  constraint swing_availability_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE,
  constraint swing_availability_travel_radius_miles_check CHECK (((travel_radius_miles IS NULL) OR (travel_radius_miles >= 0)))
);
create table if not exists public.swing_levels (
  profile_id uuid not null,
  level_id uuid not null,
  constraint swing_levels_pkey PRIMARY KEY (profile_id, level_id),
  constraint swing_levels_level_id_fkey FOREIGN KEY (level_id) REFERENCES levels(id),
  constraint swing_levels_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE
);
create table if not exists public.swing_styles (
  profile_id uuid not null,
  style_id uuid not null,
  constraint swing_styles_pkey PRIMARY KEY (profile_id, style_id),
  constraint swing_styles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE,
  constraint swing_styles_style_id_fkey FOREIGN KEY (style_id) REFERENCES styles(id)
);


-- ----------------------------------------------------------------------------
-- 20.4 — THE PROFESSIONAL BUSINESS LAYER (Offerings, Services, booking)
-- ----------------------------------------------------------------------------

-- PROFESSIONAL_OFFERINGS — "What I Offer": what you sell AS a dance professional.
-- Note `signature_work_id`: an offering of type `license` with this set is the
-- ONLY existing bridge from a profile to a live licensing checkout.
create table if not exists public.professional_offerings (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  type text not null,
  title text not null,
  short_description text,
  long_description text,
  image_url text,
  pricing_type text,
  price_display text,
  price_cents integer,
  location_mode text,
  location_note text,
  external_url text,
  cta_type text,
  signature_work_id uuid,
  status text not null default 'active'::text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint professional_offerings_pkey PRIMARY KEY (id),
  constraint professional_offerings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE,
  constraint professional_offerings_signature_work_id_fkey FOREIGN KEY (signature_work_id) REFERENCES signature_works(id) ON DELETE SET NULL,
  constraint professional_offerings_cta_type_check CHECK (((cta_type IS NULL) OR (cta_type = ANY (ARRAY['inquire'::text, 'view_product'::text, 'view_licensing'::text, 'register'::text, 'learn_more'::text, 'none'::text])))),
  constraint professional_offerings_location_mode_check CHECK (((location_mode IS NULL) OR (location_mode = ANY (ARRAY['in_person'::text, 'virtual'::text, 'travel'::text, 'flexible'::text])))),
  constraint professional_offerings_price_cents_check CHECK (((price_cents IS NULL) OR (price_cents >= 0))),
  constraint professional_offerings_pricing_type_check CHECK (((pricing_type IS NULL) OR (pricing_type = ANY (ARRAY['fixed'::text, 'hourly'::text, 'daily'::text, 'project'::text, 'starting_at'::text, 'contact'::text, 'free'::text, 'external'::text, 'hidden'::text])))),
  constraint professional_offerings_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
  constraint professional_offerings_type_check CHECK ((type = ANY (ARRAY['service'::text, 'session'::text, 'product'::text, 'license'::text, 'event'::text, 'other'::text])))
);

-- PROFESSIONAL_SERVICES — OTHER businesses a professional runs (massage, Pilates,
-- photography, accompanists). Separate from Offerings on purpose.
-- The pricing / booking / fee columns at the foot were added by
-- 20260815173016_professional_services_booking_prep and have NO UI: booking is
-- schema-only. `show_email` / `show_phone` gate contact publication, and the app
-- strips undisclosed values server-side.
create table if not exists public.professional_services (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  category text not null,
  category_other_label text,
  business_name text not null,
  short_description text,
  location text,
  service_type text,
  website_url text,
  social_url text,
  business_email text,
  business_phone text,
  show_email boolean not null default false,
  show_phone boolean not null default false,
  image_url text,
  cta_label text,
  instrument text,
  instrument_other text,
  accompanist_for text[] not null default '{}'::text[],
  rate_display text,
  rate_contact boolean not null default false,
  media_url text,
  status text not null default 'active'::text,
  moderation_status text not null default 'ok'::text,
  moderation_note text,
  moderated_at timestamp with time zone,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  price_cents integer,
  currency character(3) not null default 'USD'::bpchar,
  pricing_unit text,
  duration_minutes integer,
  booking_enabled boolean not null default false,
  availability_source text not null default 'none'::text,
  booking_timezone text,
  booking_notice_hours integer,
  platform_fee_bps integer,
  constraint professional_services_pkey PRIMARY KEY (id),
  constraint professional_services_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE,
  constraint professional_services_accompanist_for_vocab CHECK ((accompanist_for <@ ARRAY['ballet'::text, 'modern'::text, 'contemporary'::text, 'musical_theatre'::text, 'improvisation'::text, 'auditions'::text, 'rehearsals'::text, 'master_classes'::text, 'other'::text])),
  constraint professional_services_availability_source_check CHECK ((availability_source = ANY (ARRAY['none'::text, 'personal_events'::text, 'service_windows'::text]))),
  constraint professional_services_bookable_is_complete CHECK (((booking_enabled = false) OR ((price_cents IS NOT NULL) AND (pricing_unit IS NOT NULL) AND (duration_minutes IS NOT NULL)))),
  constraint professional_services_booking_notice_hours_check CHECK (((booking_notice_hours IS NULL) OR (booking_notice_hours >= 0))),
  constraint professional_services_category_check CHECK ((category = ANY (ARRAY['massage_therapy'::text, 'physical_therapy'::text, 'pilates'::text, 'personal_training'::text, 'photography'::text, 'videography'::text, 'costume_design'::text, 'music_editing'::text, 'makeup_hair'::text, 'vocal_coaching'::text, 'nutrition_wellness'::text, 'marketing_social'::text, 'accompanist'::text, 'other'::text]))),
  constraint professional_services_cta_label_check CHECK (((cta_label IS NULL) OR (cta_label = ANY (ARRAY['visit_website'::text, 'book'::text, 'learn_more'::text, 'contact'::text])))),
  constraint professional_services_duration_minutes_check CHECK (((duration_minutes IS NULL) OR ((duration_minutes > 0) AND (duration_minutes <= 1440)))),
  constraint professional_services_instrument_check CHECK (((instrument IS NULL) OR (instrument = ANY (ARRAY['piano'::text, 'percussion'::text, 'other'::text])))),
  constraint professional_services_moderation_status_check CHECK ((moderation_status = ANY (ARRAY['ok'::text, 'flagged'::text, 'removed'::text]))),
  constraint professional_services_platform_fee_bps_check CHECK (((platform_fee_bps IS NULL) OR ((platform_fee_bps >= 0) AND (platform_fee_bps <= 10000)))),
  constraint professional_services_price_cents_check CHECK (((price_cents IS NULL) OR (price_cents >= 0))),
  constraint professional_services_pricing_unit_check CHECK (((pricing_unit IS NULL) OR (pricing_unit = ANY (ARRAY['hour'::text, 'session'::text, 'class'::text, 'day'::text, 'project'::text, 'flat'::text, 'per_student'::text])))),
  constraint professional_services_service_type_check CHECK (((service_type IS NULL) OR (service_type = ANY (ARRAY['in_person'::text, 'virtual'::text, 'mobile'::text, 'touring'::text, 'multiple'::text])))),
  constraint professional_services_status_check CHECK ((status = ANY (ARRAY['active'::text, 'hidden'::text])))
);

-- SERVICE_AVAILABILITY — the PUBLIC, bookable timeline. The boundary that keeps
-- personal_events private: publishing is the EXISTENCE OF A ROW HERE, never a
-- flag on the private event, so a bad UPDATE can never expose a calendar. Only
-- starts_at / ends_at / timezone cross over. `source_personal_event_id` and
-- `internal_note` are REVOKEd from anon/authenticated at the column level
-- (20260815173203). The EXCLUDE constraint makes double-booking impossible in
-- the database rather than in application code. No UI reads this table yet.
create table if not exists public.service_availability (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null,
  service_id uuid,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  timezone text not null default 'America/New_York'::text,
  location text,
  status text not null default 'open'::text,
  capacity integer not null default 1,
  booked_count integer not null default 0,
  source_personal_event_id uuid,
  internal_note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint service_availability_pkey PRIMARY KEY (id),
  constraint service_availability_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE,
  constraint service_availability_service_id_fkey FOREIGN KEY (service_id) REFERENCES professional_services(id) ON DELETE CASCADE,
  constraint service_availability_source_personal_event_id_fkey FOREIGN KEY (source_personal_event_id) REFERENCES personal_events(event_id) ON DELETE SET NULL,
  constraint service_availability_booked_count_check CHECK ((booked_count >= 0)),
  constraint service_availability_capacity_check CHECK ((capacity >= 1)),
  constraint service_availability_ends_after_starts CHECK ((ends_at > starts_at)),
  constraint service_availability_no_overlap EXCLUDE USING gist (profile_id WITH =, tstzrange(starts_at, ends_at, '[)'::text) WITH &&) WHERE ((status <> 'cancelled'::text)),
  constraint service_availability_state_matches_count CHECK ((((status = 'booked'::text) AND (booked_count >= capacity)) OR (status <> 'booked'::text))),
  constraint service_availability_status_check CHECK ((status = ANY (ARRAY['open'::text, 'held'::text, 'booked'::text, 'cancelled'::text]))),
  constraint service_availability_within_capacity CHECK ((booked_count <= capacity))
);

-- SERVICE_BOOKINGS — follows the experience_purchases split shape so the money
-- layer, when built, matches the one already running for the $499 Signature
-- Experience. NO checkout exists; platform_fee_bps is unset because no fee has
-- been approved (public.service_platform_fee_bps() returns NULL by design).
-- The fee/split columns and the Stripe ids are REVOKEd from RLS clients.
create table if not exists public.service_bookings (
  id uuid not null default gen_random_uuid(),
  availability_id uuid not null,
  service_id uuid not null,
  profile_id uuid not null,
  buyer_user_id uuid,
  buyer_email text,
  buyer_note text,
  amount_cents integer not null,
  currency character(3) not null default 'USD'::bpchar,
  pricing_unit text,
  duration_minutes integer,
  platform_fee_bps integer,
  application_fee_cents integer not null default 0,
  professional_transfer_cents integer not null default 0,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  status text not null default 'pending'::text,
  payment_status text not null default 'unpaid'::text,
  confirmed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancelled_by text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint service_bookings_pkey PRIMARY KEY (id),
  constraint service_bookings_stripe_checkout_session_id_key UNIQUE (stripe_checkout_session_id),
  constraint service_bookings_availability_id_fkey FOREIGN KEY (availability_id) REFERENCES service_availability(id) ON DELETE RESTRICT,
  constraint service_bookings_buyer_user_id_fkey FOREIGN KEY (buyer_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  constraint service_bookings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES talent_profiles(profile_id) ON DELETE RESTRICT,
  constraint service_bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES professional_services(id) ON DELETE RESTRICT,
  constraint service_bookings_amount_cents_check CHECK ((amount_cents >= 0)),
  constraint service_bookings_application_fee_cents_check CHECK ((application_fee_cents >= 0)),
  constraint service_bookings_cancelled_by_check CHECK (((cancelled_by IS NULL) OR (cancelled_by = ANY (ARRAY['buyer'::text, 'professional'::text, 'releve'::text])))),
  constraint service_bookings_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'pending'::text, 'paid'::text, 'refunded'::text, 'failed'::text]))),
  constraint service_bookings_platform_fee_bps_check CHECK (((platform_fee_bps IS NULL) OR ((platform_fee_bps >= 0) AND (platform_fee_bps <= 10000)))),
  constraint service_bookings_professional_transfer_cents_check CHECK ((professional_transfer_cents >= 0)),
  constraint service_bookings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text, 'no_show'::text])))
);


-- ----------------------------------------------------------------------------
-- 20.5 — MEMBERSHIP, BILLING AND CONFIG
-- ----------------------------------------------------------------------------

-- ACTIVATIONS — the generalized activation + credit ledger (professional |
-- studio | team). Was `professional_activations`; renamed and widened by
-- 20260812192808. EMPTY AND DORMANT: no deployed code reads or writes it.
-- Note the constraint names still carry the old table name — that is what a
-- rename does, and it is faithfully reproduced here.
create table if not exists public.activations (
  activation_id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  application_id uuid,
  amount_cents integer not null default 3000,
  status text not null default 'pending'::text,
  access_started_at timestamp with time zone,
  access_expires_at timestamp with time zone,
  credit_cents integer not null default 3000,
  credit_status text not null default 'available'::text,
  credit_applied_at timestamp with time zone,
  credit_forfeited_at timestamp with time zone,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  membership_id uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  membership_family text not null,
  employer_id uuid,
  constraint professional_activations_pkey PRIMARY KEY (activation_id),
  constraint activations_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES employer_profiles(employer_id) ON DELETE SET NULL,
  constraint professional_activations_application_id_fkey FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE SET NULL,
  constraint professional_activations_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES memberships(membership_id) ON DELETE SET NULL,
  constraint professional_activations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  constraint activations_membership_family_check CHECK ((membership_family = ANY (ARRAY['professional'::text, 'studio'::text, 'team'::text]))),
  constraint professional_activations_credit_status_check CHECK ((credit_status = ANY (ARRAY['available'::text, 'applied'::text, 'forfeited'::text]))),
  constraint professional_activations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'converted'::text, 'expired'::text])))
);

-- FOUNDING_PROFESSIONAL_GRANTS — the invited founding cohort. Identity is kept
-- separate from billing: `entitlement_kind` is the complimentary BILLING flavor,
-- while the Founding Professional distinction + Verified mark are stamped onto
-- talent_profiles at profile creation. Revocable, with an audit trail.
create table if not exists public.founding_professional_grants (
  id uuid not null default gen_random_uuid(),
  email text not null,
  user_id uuid,
  entitlement_kind text not null,
  granted_by uuid not null,
  granted_at timestamp with time zone not null default now(),
  note text,
  claimed_at timestamp with time zone,
  revoked_at timestamp with time zone,
  revoked_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint founding_professional_grants_pkey PRIMARY KEY (id),
  constraint founding_professional_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES users(user_id),
  constraint founding_professional_grants_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES users(user_id),
  constraint founding_professional_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  constraint founding_professional_grants_entitlement_kind_check CHECK ((entitlement_kind = ANY (ARRAY['permanent'::text, 'comp_12mo'::text])))
);

-- APP_CONFIG — numbers that must be changeable without a deploy. Live keys:
--   adult_transition_age            = 18
--   swing_hourly_rate_cents         = 5000   (The Swing's fixed $50/hr)
--   this_week_current_track         = NULL
--   this_week_current_track_credit  = NULL
--   (service_platform_fee_bps is NOT set — the accessor returns NULL on purpose,
--    and any future checkout must refuse to charge rather than assume a rate.)
create table if not exists public.app_config (
  key text not null,
  int_value integer,
  text_value text,
  updated_at timestamp with time zone not null default now(),
  constraint app_config_pkey PRIMARY KEY (key)
);

-- PROCESSED_STRIPE_EVENTS — webhook idempotency. Stripe delivers at-least-once;
-- this is the first of two layers (per-row status guards are the second).
create table if not exists public.processed_stripe_events (
  event_id text not null,
  created_at timestamp with time zone not null default now(),
  constraint processed_stripe_events_pkey PRIMARY KEY (event_id)
);


-- ----------------------------------------------------------------------------
-- 20.6 — THE STUDIO / FAMILY / TEAM LAYER ("This Week" and the org tools)
-- ----------------------------------------------------------------------------
-- A MINOR IS NEVER PUBLIC. `students` is deliberately separate from
-- talent_profiles so a child can never surface in the Roster, in reviews, or on
-- any public page. None of the tables in 20.6 has an anon read path.

-- FAMILY_ACCOUNTS — the household, and its (future) family subscription.
create table if not exists public.family_accounts (
  family_id uuid not null default gen_random_uuid(),
  owner_user_id uuid not null,
  subscription_status family_subscription_status not null default 'none'::family_subscription_status,
  plan text,
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamp with time zone,
  renewal_date date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint family_accounts_pkey PRIMARY KEY (family_id),
  constraint family_accounts_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- STUDENTS — a dancer who is not (yet) their own account. `visibility` carries
-- the adulthood transition: 'family_only' (parent-managed minor) vs
-- 'self_managed' (an adult on a college / pro team who owns their own record).
create table if not exists public.students (
  student_id uuid not null default gen_random_uuid(),
  family_id uuid,
  display_name text not null,
  date_of_birth date,
  age_range text,
  visibility text not null default 'family_only'::text,
  transferred_to_user_id uuid,
  transferred_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint students_pkey PRIMARY KEY (student_id),
  constraint students_family_id_fkey FOREIGN KEY (family_id) REFERENCES family_accounts(family_id) ON DELETE CASCADE,
  constraint students_transferred_to_user_id_fkey FOREIGN KEY (transferred_to_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  constraint students_visibility_check CHECK ((visibility = ANY (ARRAY['family_only'::text, 'self_managed'::text])))
);

-- GUARDIANSHIPS — who may act for a student, and for what. Granular by design:
-- a parent with 'calendar' does not thereby get 'billing' or 'medical_forms'.
create table if not exists public.guardianships (
  guardian_user_id uuid not null,
  student_id uuid not null,
  relationship text,
  is_primary boolean not null default false,
  permissions guardian_permission[] not null default '{calendar,messages}'::guardian_permission[],
  consent_at timestamp with time zone,
  consent_version text,
  created_at timestamp with time zone not null default now(),
  constraint guardianships_pkey PRIMARY KEY (guardian_user_id, student_id),
  constraint guardianships_guardian_user_id_fkey FOREIGN KEY (guardian_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  constraint guardianships_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- STUDIO_CLASSES — a recurring thing on an org's schedule. `kind` (enum) is what
-- it IS; `event_type` (text) is the finer studio-facing label; `studio_wide`
-- means everyone is invited rather than an enrolled roster.
create table if not exists public.studio_classes (
  class_id uuid not null default gen_random_uuid(),
  employer_id uuid not null,
  title text not null,
  style_id uuid,
  level_id uuid,
  location text,
  room text,
  teacher_profile_id uuid,
  recurrence text,
  default_start time without time zone,
  default_end time without time zone,
  timezone text not null default 'America/New_York'::text,
  status text not null default 'active'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  series_start date,
  series_end date,
  kind studio_class_kind not null default 'class'::studio_class_kind,
  event_type text,
  studio_wide boolean not null default false,
  constraint studio_classes_pkey PRIMARY KEY (class_id),
  constraint studio_classes_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES employer_profiles(employer_id) ON DELETE CASCADE,
  constraint studio_classes_level_id_fkey FOREIGN KEY (level_id) REFERENCES levels(id),
  constraint studio_classes_style_id_fkey FOREIGN KEY (style_id) REFERENCES styles(id),
  constraint studio_classes_teacher_profile_id_fkey FOREIGN KEY (teacher_profile_id) REFERENCES talent_profiles(profile_id) ON DELETE SET NULL,
  constraint studio_classes_event_type_check CHECK (((event_type IS NULL) OR (event_type = ANY (ARRAY['class'::text, 'company_rehearsal'::text, 'duet_trio'::text, 'solo_private'::text, 'full_studio_event'::text, 'parent_meeting'::text, 'competition'::text, 'audition'::text, 'performance'::text]))))
);

-- CLASS_SESSIONS — one dated occurrence of a class. UNIQUE(class_id, starts_at)
-- is what makes generating a week idempotent.
create table if not exists public.class_sessions (
  session_id uuid not null default gen_random_uuid(),
  class_id uuid not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone,
  status class_session_status not null default 'scheduled'::class_session_status,
  note text,
  created_at timestamp with time zone not null default now(),
  constraint class_sessions_pkey PRIMARY KEY (session_id),
  constraint class_sessions_class_id_starts_at_key UNIQUE (class_id, starts_at),
  constraint class_sessions_class_id_fkey FOREIGN KEY (class_id) REFERENCES studio_classes(class_id) ON DELETE CASCADE
);

-- ENROLLMENTS — student in class.
create table if not exists public.enrollments (
  enrollment_id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  class_id uuid not null,
  status enrollment_status not null default 'active'::enrollment_status,
  created_at timestamp with time zone not null default now(),
  constraint enrollments_pkey PRIMARY KEY (enrollment_id),
  constraint enrollments_student_id_class_id_key UNIQUE (student_id, class_id),
  constraint enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES studio_classes(class_id) ON DELETE CASCADE,
  constraint enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- STUDIO_GROUPS / _MEMBERS / STUDIO_CLASS_GROUPS / STUDIO_CLASS_DANCERS —
-- targeting: an event can be aimed at a named group (a competition team) or at
-- named dancers, not only at an enrolled class roster.
create table if not exists public.studio_groups (
  group_id uuid not null default gen_random_uuid(),
  employer_id uuid not null,
  name text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint studio_groups_pkey PRIMARY KEY (group_id),
  constraint studio_groups_employer_id_name_key UNIQUE (employer_id, name),
  constraint studio_groups_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES employer_profiles(employer_id) ON DELETE CASCADE
);
create table if not exists public.studio_group_members (
  group_id uuid not null,
  student_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint studio_group_members_pkey PRIMARY KEY (group_id, student_id),
  constraint studio_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES studio_groups(group_id) ON DELETE CASCADE,
  constraint studio_group_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);
create table if not exists public.studio_class_groups (
  class_id uuid not null,
  group_id uuid not null,
  constraint studio_class_groups_pkey PRIMARY KEY (class_id, group_id),
  constraint studio_class_groups_class_id_fkey FOREIGN KEY (class_id) REFERENCES studio_classes(class_id) ON DELETE CASCADE,
  constraint studio_class_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES studio_groups(group_id) ON DELETE CASCADE
);
create table if not exists public.studio_class_dancers (
  class_id uuid not null,
  student_id uuid not null,
  constraint studio_class_dancers_pkey PRIMARY KEY (class_id, student_id),
  constraint studio_class_dancers_class_id_fkey FOREIGN KEY (class_id) REFERENCES studio_classes(class_id) ON DELETE CASCADE,
  constraint studio_class_dancers_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- STUDIO_STAFF — who works at an org and in what role. `talent_profile_id` links
-- a staff member to their own professional profile when they have one.
create table if not exists public.studio_staff (
  employer_id uuid not null,
  user_id uuid not null,
  role studio_staff_role not null,
  talent_profile_id uuid,
  created_at timestamp with time zone not null default now(),
  constraint studio_staff_pkey PRIMARY KEY (employer_id, user_id),
  constraint studio_staff_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES employer_profiles(employer_id) ON DELETE CASCADE,
  constraint studio_staff_talent_profile_id_fkey FOREIGN KEY (talent_profile_id) REFERENCES talent_profiles(profile_id) ON DELETE SET NULL,
  constraint studio_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- AFFILIATIONS — the generic "X belongs to org Y in role Z" edge. Polymorphic on
-- subject_kind (talent | student) so one table serves both sides.
create table if not exists public.affiliations (
  affiliation_id uuid not null default gen_random_uuid(),
  subject_kind affiliation_subject not null,
  subject_id uuid not null,
  employer_id uuid not null,
  role affiliation_role not null,
  status affiliation_status not null default 'active'::affiliation_status,
  started_at date,
  ended_at date,
  created_at timestamp with time zone not null default now(),
  division text,
  constraint affiliations_pkey PRIMARY KEY (affiliation_id),
  constraint affiliations_subject_kind_subject_id_employer_id_role_key UNIQUE (subject_kind, subject_id, employer_id, role),
  constraint affiliations_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES employer_profiles(employer_id) ON DELETE CASCADE
);

-- COMMUNICATIONS — studio-to-family messages, alerts and announcements.
create table if not exists public.communications (
  communication_id uuid not null default gen_random_uuid(),
  kind communication_kind not null,
  studio_employer_id uuid,
  family_id uuid,
  student_id uuid,
  from_user_id uuid,
  from_employer_id uuid,
  severity communication_severity,
  direction communication_direction,
  title text,
  body text,
  related_session_id uuid,
  created_at timestamp with time zone not null default now(),
  read_at timestamp with time zone,
  constraint communications_pkey PRIMARY KEY (communication_id),
  constraint communications_family_id_fkey FOREIGN KEY (family_id) REFERENCES family_accounts(family_id) ON DELETE CASCADE,
  constraint communications_from_employer_id_fkey FOREIGN KEY (from_employer_id) REFERENCES employer_profiles(employer_id) ON DELETE SET NULL,
  constraint communications_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  constraint communications_related_session_id_fkey FOREIGN KEY (related_session_id) REFERENCES class_sessions(session_id) ON DELETE SET NULL,
  constraint communications_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE SET NULL,
  constraint communications_studio_employer_id_fkey FOREIGN KEY (studio_employer_id) REFERENCES employer_profiles(employer_id) ON DELETE CASCADE
);

-- EVENT_ACKNOWLEDGEMENTS — "yes, I saw this" on a session.
create table if not exists public.event_acknowledgements (
  ack_id uuid not null default gen_random_uuid(),
  session_id uuid not null,
  student_id uuid,
  family_id uuid,
  acknowledged_by uuid not null,
  acknowledged_at timestamp with time zone not null default now(),
  constraint event_acknowledgements_pkey PRIMARY KEY (ack_id),
  constraint event_acknowledgements_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES users(user_id) ON DELETE CASCADE,
  constraint event_acknowledgements_family_id_fkey FOREIGN KEY (family_id) REFERENCES family_accounts(family_id) ON DELETE CASCADE,
  constraint event_acknowledgements_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(session_id) ON DELETE CASCADE,
  constraint event_acknowledgements_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- TEACHING_ENGAGEMENTS — how a professional is engaged, and at what rate.
-- The substitution constraint is documented in
-- 20260720133612_substitution_engagements_must_be_class_scoped (reconstructed).
create table if not exists public.teaching_engagements (
  engagement_id uuid not null default gen_random_uuid(),
  teacher_profile_id uuid not null,
  employer_id uuid not null,
  class_id uuid,
  kind engagement_kind not null default 'ongoing'::engagement_kind,
  rate_amount_cents integer not null,
  rate_unit rate_unit not null default 'hourly'::rate_unit,
  rate_source rate_source not null default 'teacher_set'::rate_source,
  currency character(3) not null default 'USD'::bpchar,
  effective_from date not null default CURRENT_DATE,
  effective_to date,
  status engagement_status not null default 'active'::engagement_status,
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint teaching_engagements_pkey PRIMARY KEY (engagement_id),
  constraint teaching_engagements_class_id_fkey FOREIGN KEY (class_id) REFERENCES studio_classes(class_id) ON DELETE CASCADE,
  constraint teaching_engagements_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES employer_profiles(employer_id) ON DELETE CASCADE,
  constraint teaching_engagements_teacher_profile_id_fkey FOREIGN KEY (teacher_profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE,
  constraint teaching_engagements_dates_ordered CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
  constraint teaching_engagements_rate_amount_cents_check CHECK ((rate_amount_cents >= 0)),
  constraint teaching_engagements_substitution_is_class_scoped CHECK (((kind <> 'substitution'::engagement_kind) OR (class_id IS NOT NULL)))
);

-- TEACHING_EARNINGS — the ledger. Rates are SNAPSHOT at the time of work, never
-- recomputed from the engagement's current rate. `rate_source = 'platform_set'`
-- is the only case where Relevé sets the number (The Swing's fixed $50/hr);
-- everything else is the teacher's own. Relevé takes no cut of any of it.
create table if not exists public.teaching_earnings (
  earning_id uuid not null default gen_random_uuid(),
  engagement_id uuid,
  teacher_profile_id uuid not null,
  employer_id uuid not null,
  session_id uuid,
  source_kind engagement_kind not null default 'ongoing'::engagement_kind,
  work_date date not null,
  minutes integer,
  rate_amount_cents integer not null,
  rate_unit rate_unit not null,
  rate_source rate_source not null,
  amount_cents integer not null,
  currency character(3) not null default 'USD'::bpchar,
  status earning_status not null default 'pending'::earning_status,
  approved_at timestamp with time zone,
  paid_at timestamp with time zone,
  payout_batch_id uuid,
  external_reference text,
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint teaching_earnings_pkey PRIMARY KEY (earning_id),
  constraint teaching_earnings_one_per_session UNIQUE NULLS NOT DISTINCT (session_id, teacher_profile_id),
  constraint teaching_earnings_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES employer_profiles(employer_id) ON DELETE CASCADE,
  constraint teaching_earnings_engagement_id_fkey FOREIGN KEY (engagement_id) REFERENCES teaching_engagements(engagement_id) ON DELETE SET NULL,
  constraint teaching_earnings_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(session_id) ON DELETE SET NULL,
  constraint teaching_earnings_teacher_profile_id_fkey FOREIGN KEY (teacher_profile_id) REFERENCES talent_profiles(profile_id) ON DELETE CASCADE,
  constraint teaching_earnings_amount_cents_check CHECK ((amount_cents >= 0)),
  constraint teaching_earnings_minutes_check CHECK (((minutes IS NULL) OR (minutes >= 0))),
  constraint teaching_earnings_rate_amount_cents_check CHECK ((rate_amount_cents >= 0))
);

-- STUDIO_INVITES — the join codes a studio or team hands out. `kind` splits the
-- family flow (a parent enrolling a child) from the team flow (a self-managed
-- adult joining a dance team).
create table if not exists public.studio_invites (
  invite_id uuid not null default gen_random_uuid(),
  employer_id uuid not null,
  code text not null,
  label text,
  status text not null default 'active'::text,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  kind text not null default 'family'::text,
  constraint studio_invites_pkey PRIMARY KEY (invite_id),
  constraint studio_invites_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES employer_profiles(employer_id) ON DELETE CASCADE,
  constraint studio_invites_kind_check CHECK ((kind = ANY (ARRAY['family'::text, 'team'::text]))),
  constraint studio_invites_max_uses_check CHECK (((max_uses IS NULL) OR (max_uses > 0))),
  constraint studio_invites_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text])))
);

-- FOUNDING_STUDIO_INVITES — the white-glove onboarding of a Charter Studio.
-- Note: created_by / redeemed_by reference auth.users directly, unlike the rest
-- of the schema which goes through public.users.
create table if not exists public.founding_studio_invites (
  invite_id uuid not null default gen_random_uuid(),
  email text not null,
  token text not null,
  employer_id uuid not null,
  status text not null default 'invited'::text,
  expires_at timestamp with time zone,
  redeemed_at timestamp with time zone,
  redeemed_by uuid,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  constraint founding_studio_invites_pkey PRIMARY KEY (invite_id),
  constraint founding_studio_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint founding_studio_invites_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES employer_profiles(employer_id) ON DELETE CASCADE,
  constraint founding_studio_invites_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint founding_studio_invites_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'in_progress'::text, 'submitted'::text, 'approved'::text, 'live'::text, 'revoked'::text])))
);

-- The three inbound-interest capture tables (the onboarding gateway's doors).
create table if not exists public.studio_interest (
  interest_id uuid not null default gen_random_uuid(),
  studio_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  city text,
  state_province text,
  student_count_band text,
  message text,
  source text,
  status text not null default 'new'::text,
  created_at timestamp with time zone not null default now(),
  constraint studio_interest_pkey PRIMARY KEY (interest_id),
  constraint studio_interest_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'onboarded'::text, 'declined'::text]))),
  constraint studio_interest_student_count_band_check CHECK (((student_count_band IS NULL) OR (student_count_band = ANY (ARRAY['under_50'::text, '50_99'::text, '100_199'::text, '200_plus'::text]))))
);
create table if not exists public.team_interest (
  interest_id uuid not null default gen_random_uuid(),
  user_id uuid,
  team_name text not null,
  school_org text,
  team_level text,
  coach_name text,
  email text not null,
  city_state text,
  use_case text,
  message text,
  status text not null default 'new'::text,
  created_at timestamp with time zone not null default now(),
  constraint team_interest_pkey PRIMARY KEY (interest_id),
  constraint team_interest_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  constraint team_interest_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'onboarded'::text, 'declined'::text]))),
  constraint team_interest_team_level_check CHECK (((team_level IS NULL) OR (team_level = ANY (ARRAY['middle_school'::text, 'high_school'::text, 'college'::text, 'professional'::text, 'independent'::text]))))
);
create table if not exists public.partner_interest (
  interest_id uuid not null default gen_random_uuid(),
  user_id uuid,
  org_name text not null,
  org_type text,
  contact_name text not null,
  contact_title text,
  website_or_social text,
  participation text,
  message text,
  status text not null default 'new'::text,
  created_at timestamp with time zone not null default now(),
  constraint partner_interest_pkey PRIMARY KEY (interest_id),
  constraint partner_interest_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  constraint partner_interest_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'onboarded'::text, 'declined'::text])))
);


-- ----------------------------------------------------------------------------
-- 20.7 — THE ROSTER VIEW (the only view in the public schema)
-- ----------------------------------------------------------------------------
-- roster_profiles flattens a talent profile plus its tag arrays and computes
-- `owner_active` (does this person hold an active membership?). It is REVOKED
-- from anon and authenticated — only the service role may read it — because
-- Roster discovery is a paid benefit.
--
-- THE WHERE CLAUSE IS THE PUBLICATION RULE: published + public. Combined with
-- `owner_active` in the query layer, that is the complete answer to "who appears
-- on the Roster".
--
-- Live definition, 2026-08-17:
--
--   create or replace view public.roster_profiles as
--   select profile_id, user_id, display_name, public_slug, primary_role,
--          city, state_province, country, region_id, headshot_url,
--          verification_flag, honorifics, years_experience, search_tsv,
--          coalesce((select array_agg(distinct s.slug) from profile_styles ps
--                    join styles s on s.id = ps.style_id
--                    where ps.profile_id = p.profile_id), '{}') as style_slugs,
--          coalesce((select array_agg(distinct l.slug) from profile_levels pl
--                    join levels l on l.id = pl.level_id
--                    where pl.profile_id = p.profile_id), '{}') as level_slugs,
--          coalesce((select array_agg(distinct c.slug) from profile_certifications pc
--                    join certifications c on c.id = pc.certification_id
--                    where pc.profile_id = p.profile_id), '{}') as cert_slugs,
--          coalesce((select array_agg(distinct a.slug) from profile_availability pa
--                    join availability_tags a on a.id = pa.availability_tag_id
--                    where pa.profile_id = p.profile_id), '{}') as availability_slugs,
--          exists(select 1 from memberships m
--                 where m.user_id = p.user_id
--                   and m.membership_status = 'active') as owner_active
--   from talent_profiles p
--   where profile_status = 'published' and visibility = 'public';
--
-- KNOWN GAP (recorded, not fixed here): the view exposes `region_id` and the
-- Roster filters on it, but NOTHING in the application ever writes region_id.
-- The Region filter therefore always returns zero results. Left alone in this
-- reconciliation pass on purpose — it is a bug to fix deliberately, not a
-- documentation error.


-- ----------------------------------------------------------------------------
-- 20.8 — WHAT IS DELIBERATELY *NOT* IN THIS FILE
-- ----------------------------------------------------------------------------
--   · RLS POLICIES and GRANTS. They live in the migrations, which are the
--     executable truth. Two column-privacy facts are load-bearing enough to
--     repeat: on THIS project Supabase's default privileges already grant every
--     column to anon/authenticated, so a narrow GRANT revokes nothing —
--     column-level privacy requires REVOKE first. That was done for
--     service_availability and service_bookings (20260815173203); it has NOT been
--     done for professional_services or works.
--   · STORAGE BUCKETS: headshots, resumes, gallery, music, org-branding,
--     offering-media, service-media — all public read.
--   · FUNCTIONS: owns_talent_profile(), adult_transition_age(),
--     swing_hourly_rate_cents(), service_platform_fee_bps() (returns NULL until a
--     rate is set), and the search_tsv trigger.
--   · INDEXES, except where a partial/exclusion index carries meaning worth
--     stating inline.
--
-- ============================================================================
-- END OF SECTION 20 — reconciliation complete as of 2026-08-17.
-- 74 base tables + 1 view transcribed. If you add a table, add it here too.
-- ============================================================================
