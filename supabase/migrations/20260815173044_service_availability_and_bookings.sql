-- ============================================================================
-- Relevé Connect — Migration: service_availability + service_bookings (DRAFT)
-- ----------------------------------------------------------------------------
-- ⚠️  NOT APPLIED. Awaiting founder approval of the schema.
--
-- ── The rule this file exists to enforce ──
-- The booking system NEVER reads a professional's private calendar.
--
--   This Week / personal_events  (PRIVATE, owner-only, unchanged)
--            │
--            │  the professional explicitly PUBLISHES a chosen window
--            ▼
--   service_availability         (PUBLIC + bookable — the ONLY source booking reads)
--            │
--            ▼
--   Book on Relevé → service_bookings → (later) checkout / payout
--
-- ── Why publishing is an INSERT, not a flag ──
-- The founder's constraint: "a private event should never become public merely
-- because of a flag mistake." So there is no `is_public` column on
-- personal_events. Publication is the EXISTENCE OF A ROW IN A DIFFERENT TABLE,
-- created by an explicit act, carrying only a time window. A boolean flipped by
-- a bad UPDATE, a careless upsert, or a mis-scoped admin script would expose a
-- private calendar; a separate table cannot be exposed by accident, because
-- nothing about personal_events changes when it is published.
--
-- What crosses the boundary is ONLY: starts_at, ends_at, timezone.
-- What NEVER crosses: title, note, location, category, attachments — an
-- audition, a medical appointment, or a job interview is invisible even when the
-- professional publishes the hours around it.
--
-- ── Deliberately NOT here ──
--   * Stripe checkout, payment intents, payouts, transfers.
--   * Any fee percentage. platform_fee_bps stays UNSET and NULL.
--   * Any change to personal_events, its RLS, or This Week.
-- ============================================================================

begin;

-- Needed for the no-double-booking exclusion constraint (§1.4). Available on
-- this project, not yet installed.
create extension if not exists btree_gist;

-- ----------------------------------------------------------------------------
-- 1) service_availability — the PUBLIC, bookable timeline
-- ----------------------------------------------------------------------------
create table if not exists public.service_availability (
  id            uuid primary key default gen_random_uuid(),

  -- THE TIMELINE OWNER. Anchoring on the professional (not the service) is what
  -- makes double-booking preventable: a person cannot be in two places at once,
  -- however many services they offer. All overlap rules below are per profile.
  profile_id    uuid not null references public.talent_profiles(profile_id) on delete cascade,

  -- WHICH SERVICE may be booked in this window.
  -- NULL = any of this professional's bookable services (one open afternoon that
  -- could be a massage or a coaching session). Set = this window is for one
  -- service only. ON DELETE CASCADE: deleting a service removes windows that
  -- exist solely for it.
  service_id    uuid references public.professional_services(id) on delete cascade,

  -- WHEN. Absolute instants for correctness; IANA zone for wall-clock intent.
  -- BOTH, because a professional on tour changes zone mid-week and "2pm" must
  -- keep meaning 2pm where they physically are. Mirrors personal_events.timezone.
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  timezone      text not null default 'America/New_York',

  -- Optional place. Free text and member-written — NEVER copied from a private
  -- event's location (see the header).
  location      text,

  -- AVAILABILITY STATE.
  --   open      = bookable now (the ONLY state the public can see)
  --   held      = a booking is in flight (checkout started, not settled)
  --   booked    = taken
  --   cancelled = withdrawn by the professional; kept for history, never shown
  status        text not null default 'open'
                  check (status in ('open','held','booked','cancelled')),

  -- Group capacity, for a window that can take more than one person (a master
  -- class). Default 1 = a one-to-one slot. `booked_count` is maintained by the
  -- booking transaction and can never exceed capacity (constraint below).
  capacity      integer not null default 1 check (capacity >= 1),
  booked_count  integer not null default 0 check (booked_count >= 0),

  -- INTERNAL PROVENANCE ONLY. If this window was published from a This Week
  -- entry, this records which one — so the professional's own editor can show
  -- "published from your Tuesday window" and can clean up if that entry is
  -- deleted. It is NEVER exposed publicly: it is excluded from the public
  -- column grants in §1.3, so anon/authenticated readers cannot select it at
  -- all. ON DELETE SET NULL — deleting the private event must not delete a
  -- window someone may already have booked.
  source_personal_event_id uuid references public.personal_events(event_id) on delete set null,

  -- The professional's own private note about this window (never public; same
  -- column-grant exclusion as above).
  internal_note text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint service_availability_ends_after_starts check (ends_at > starts_at),
  constraint service_availability_within_capacity   check (booked_count <= capacity),
  -- A window cannot be 'booked' with nobody in it, or 'open' while full.
  constraint service_availability_state_matches_count check (
    (status = 'booked' and booked_count >= capacity)
    or (status <> 'booked')
  )
);

-- 1.2 Indexes ---------------------------------------------------------------
-- The public query: "what open windows does this professional/service have,
-- soonest first". Partial, because only 'open' is ever publicly listed.
create index if not exists service_availability_open_idx
  on public.service_availability (profile_id, starts_at)
  where status = 'open';
create index if not exists service_availability_service_idx
  on public.service_availability (service_id, starts_at)
  where service_id is not null;
-- The owner's management view (every state).
create index if not exists service_availability_owner_idx
  on public.service_availability (profile_id, starts_at desc);
-- "Did the entry I just deleted have published windows?"
create index if not exists service_availability_source_idx
  on public.service_availability (source_personal_event_id)
  where source_personal_event_id is not null;

-- 1.3 RLS + COLUMN-LEVEL grants ---------------------------------------------
-- Two separate mechanisms, doing two different jobs:
--   * RLS decides WHICH ROWS are visible  → only 'open' windows are public.
--   * Column grants decide WHICH COLUMNS  → the private-event reference and the
--     internal note are not selectable by anyone but the owner, so even a future
--     `select *` written by a tired developer cannot leak provenance.
--
-- Publicly visible: only OPEN windows. A booked or cancelled window is NOT
-- public — otherwise the public page would quietly publish the professional's
-- working schedule ("she's busy every Tuesday at 4"), which is exactly the
-- privacy leak this whole design avoids.
alter table public.service_availability enable row level security;

drop policy if exists service_availability_read_open on public.service_availability;
create policy service_availability_read_open on public.service_availability
  for select to anon, authenticated
  using (
    (status = 'open' and ends_at > now())
    or public.owns_talent_profile(profile_id)
  );

drop policy if exists service_availability_insert_own on public.service_availability;
create policy service_availability_insert_own on public.service_availability
  for insert to authenticated
  with check (public.owns_talent_profile(profile_id));

drop policy if exists service_availability_update_own on public.service_availability;
create policy service_availability_update_own on public.service_availability
  for update to authenticated
  using (public.owns_talent_profile(profile_id))
  with check (public.owns_talent_profile(profile_id));

drop policy if exists service_availability_delete_own on public.service_availability;
create policy service_availability_delete_own on public.service_availability
  for delete to authenticated
  using (public.owns_talent_profile(profile_id));

-- PUBLIC columns — note the two omissions: source_personal_event_id and
-- internal_note.
--
-- ⚠️ INSUFFICIENT ON ITS OWN — SUPERSEDED BY 20260815173203.
-- This GRANT was written believing it created the private/public column
-- boundary. It does not. This project carries Supabase's default privileges,
-- which ALREADY grant every column on every new public-schema table to anon and
-- authenticated, so a narrower GRANT is purely additive and revokes nothing.
-- The boundary is actually created by the REVOKE in the next migration
-- (20260815173203_service_availability_column_privacy_fix.sql).
--
-- This file is left exactly as it was APPLIED so the repo's migration history
-- matches the database's. Do not "fix" it here — replaying these files in order
-- reproduces the verified state, and folding the correction backwards would make
-- the two histories disagree.
grant select (
  id, profile_id, service_id, starts_at, ends_at, timezone, location,
  status, capacity, booked_count, created_at, updated_at
) on public.service_availability to anon, authenticated;

-- The owner writes through their own session; RLS above scopes it to their rows.
grant insert, update, delete on public.service_availability to authenticated;
-- The service role (server actions, the future booking transaction) sees all.
grant select, insert, update, delete on public.service_availability to service_role;

-- 1.4 NO DOUBLE BOOKING (the database guarantees it) ------------------------
-- An exclusion constraint: for one professional, no two LIVE windows may
-- overlap in time. 'cancelled' rows are excluded so a withdrawn window can be
-- re-published for the same hours.
--
-- This is enforced by Postgres, not by application code, because the failure
-- mode is a race: two buyers hitting "Book" in the same second, or the
-- professional publishing a window that overlaps one already sold. Application
-- checks lose that race; a constraint cannot.
alter table public.service_availability
  drop constraint if exists service_availability_no_overlap;
alter table public.service_availability
  add constraint service_availability_no_overlap
  exclude using gist (
    profile_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled');

comment on table public.service_availability is
  'The PUBLIC, bookable availability layer. The only availability source the booking system reads. personal_events is private and is never read by booking; a professional explicitly publishes a window into this table, carrying only start/end/timezone.';
comment on column public.service_availability.source_personal_event_id is
  'INTERNAL provenance only. Excluded from public column grants — the originating private event is never exposed.';

-- ----------------------------------------------------------------------------
-- 2) service_bookings — who booked what (NO checkout built)
--    Follows the experience_purchases shape so the money layer, when it is
--    built, matches the one already running for the $499 Signature Experience.
-- ----------------------------------------------------------------------------
create table if not exists public.service_bookings (
  id                    uuid primary key default gen_random_uuid(),

  availability_id       uuid not null references public.service_availability(id) on delete restrict,
  service_id            uuid not null references public.professional_services(id) on delete restrict,
  -- Denormalised on purpose (same reasoning as teaching_earnings): dashboards
  -- and RLS resolve without a join, and the row stays meaningful over time.
  profile_id            uuid not null references public.talent_profiles(profile_id) on delete restrict,

  buyer_user_id         uuid references public.users(user_id) on delete set null,
  buyer_email           text,
  buyer_note            text,

  -- SNAPSHOT of what was agreed, taken at booking time. Never recompute a past
  -- booking from the service's current price — the same discipline as the
  -- teaching_earnings ledger.
  amount_cents          integer not null check (amount_cents >= 0),
  currency              char(3) not null default 'USD',
  pricing_unit          text,
  duration_minutes      integer,

  -- THE SPLIT. All zero and unset today: no fee has been approved, and nothing
  -- here assumes one. A future checkout MUST read service_platform_fee_bps()
  -- and refuse to charge when it is NULL.
  platform_fee_bps      integer check (platform_fee_bps is null or (platform_fee_bps between 0 and 10000)),
  application_fee_cents integer not null default 0 check (application_fee_cents >= 0),
  professional_transfer_cents integer not null default 0 check (professional_transfer_cents >= 0),

  -- Stripe columns exist so the later wiring is an UPDATE, not a migration.
  -- Nothing writes them yet.
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text,

  -- Booking lifecycle, kept separate from payment state: a booking can be
  -- confirmed and later refunded, and conflating the two loses that history.
  status                text not null default 'pending'
                          check (status in ('pending','confirmed','cancelled','completed','no_show')),
  payment_status        text not null default 'unpaid'
                          check (payment_status in ('unpaid','pending','paid','refunded','failed')),

  confirmed_at          timestamptz,
  cancelled_at          timestamptz,
  cancelled_by          text check (cancelled_by is null or cancelled_by in ('buyer','professional','releve')),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- One LIVE booking per one-to-one window. Group windows are governed by
-- capacity/booked_count on the availability row instead.
create unique index if not exists service_bookings_one_live_per_window
  on public.service_bookings (availability_id)
  where status in ('pending','confirmed','completed');

create index if not exists service_bookings_professional_idx
  on public.service_bookings (profile_id, created_at desc);
create index if not exists service_bookings_buyer_idx
  on public.service_bookings (buyer_user_id, created_at desc);
create index if not exists service_bookings_payment_idx
  on public.service_bookings (payment_status, created_at desc);

-- 2.1 RLS — a booking is private to its two parties -------------------------
alter table public.service_bookings enable row level security;

drop policy if exists service_bookings_read_parties on public.service_bookings;
create policy service_bookings_read_parties on public.service_bookings
  for select to authenticated
  using (buyer_user_id = auth.uid() or public.owns_talent_profile(profile_id));

-- Writes go through server actions on the service role once checkout exists.
-- No client-side insert path is granted: money must not be writable from a
-- browser session.
-- (Column-level narrowing for this table also arrives in 20260815173203 — see
-- the note above.)
grant select on public.service_bookings to authenticated;
grant select, insert, update, delete on public.service_bookings to service_role;

comment on table public.service_bookings is
  'A booking of a Professional Service window. Follows the experience_purchases split shape. No checkout, payment, or payout is implemented; platform_fee_bps is unset because no fee has been approved.';

commit;

-- ============================================================================
-- END (DRAFT — not applied).
--
-- ROLLBACK:
--   begin;
--   drop table if exists public.service_bookings cascade;
--   drop table if exists public.service_availability cascade;
--   -- btree_gist may be left installed; it is harmless and may be shared.
--   commit;
-- ============================================================================
