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
  student_count_band text check (student_count_band is null or student_count_band in ('under_100','100_299','300_plus')),
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
