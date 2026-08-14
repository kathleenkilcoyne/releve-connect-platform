-- ============================================================================
-- Relevé Connect — Migration: Professional Offerings, Slice 1 — data foundation
-- ----------------------------------------------------------------------------
-- The additive "professional business layer" on top of the existing Professional
-- Profile. ONE reusable Offering concept — a professional can advertise/package a
-- Service, Session, Product, License, Event/Experience, or Other from their
-- Relevé Profile. This slice ships the DATA FOUNDATION ONLY: the table, RLS,
-- grants, and a dedicated media bucket. No editor, no public render, no CTA
-- wiring, no connections change — those are later, separately-reviewed slices.
--
-- DESIGN PRINCIPLES (founder-ratified):
--   * ONE table, not a table per kind of work. `type` is CHECK-constrained text
--     (NOT a Postgres enum) so new kinds can be added by widening the check —
--     Offering types are expected to evolve. The app mirrors this in a TS union.
--   * WORKER LABOR IS NEVER TAXED. This table stores DISPLAY + ROUTING only. A
--     service inquiry writes a `connections` row (no charge, no commission). Only
--     the LICENSING path carries economics, and it stays entirely in
--     `signature_works` / `experience_purchases` — an Offering merely POINTS at a
--     signature work via `signature_work_id` (the licensing seam). No duplicate
--     license records, no second licensing engine.
--   * NO native ecommerce. Product/Event offerings point to an `external_url`.
--   * ADDITIVE + REVERSIBLE. A profile with zero offerings is unchanged. Rollback
--     is a clean DROP (see the migration's paired rollback note).
--
-- Idempotent (create-if-not-exists, drop-policy-if-exists then recreate).
-- PREREQUISITES: talent_profiles, signature_works, and public.owns_talent_profile()
--   all exist (all present on main).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) professional_offerings — one row per Offering (many per talent profile)
-- ----------------------------------------------------------------------------
create table if not exists public.professional_offerings (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.talent_profiles(profile_id) on delete cascade,

  -- WHAT kind of thing this is. CHECK-constrained text (extensible), mirrored by
  -- the TS OFFERING_TYPES union in src/lib/offerings/offerings.ts.
  type               text not null
                       check (type in ('service','session','product','license','event','other')),

  title              text not null,
  short_description  text,
  long_description   text,

  -- Single hero image for V1 (dedicated `offering-media` bucket, see §4). No
  -- multi-image product gallery yet, and Offering media NEVER lands in the
  -- profile gallery bucket.
  image_url          text,

  -- FLEXIBLE pricing DISPLAY — never a forced hourly rate. `price_display` is the
  -- exact human string to show ("$85/hour", "Starting at $250", "Contact for
  -- pricing", "Free", …). `pricing_type` optionally classifies it. `price_cents`
  -- is RESERVED for a future structured-pricing pass; unused in V1.
  pricing_type       text
                       check (pricing_type is null or pricing_type in
                         ('fixed','hourly','daily','project','starting_at','contact','free','external','hidden')),
  price_display      text,
  price_cents        integer check (price_cents is null or price_cents >= 0),

  -- Optional where/how delivered.
  location_mode      text
                       check (location_mode is null or location_mode in
                         ('in_person','virtual','travel','flexible')),
  location_note      text,

  -- External destination for Product/Event/Other CTAs (no ecommerce built).
  external_url       text,

  -- Optional CTA OVERRIDE. When null, the app derives the CTA from `type`
  -- (see src/lib/offerings/offerings.ts deriveCta).
  cta_type           text
                       check (cta_type is null or cta_type in
                         ('inquire','view_product','view_licensing','register','learn_more','none')),

  -- LICENSING SEAM: a 'license'-type Offering points at an existing signature
  -- work. ON DELETE SET NULL so removing a licensed work never deletes the
  -- Offering row. The licensing record/economics live in signature_works.
  signature_work_id  uuid references public.signature_works(id) on delete set null,

  -- active = shown publicly (when the profile is published); inactive = kept but
  -- hidden. The professional toggles this.
  status             text not null default 'active'
                       check (status in ('active','inactive')),

  sort_order         integer not null default 0,   -- display order on the profile
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()   -- app-maintained on write
);

-- Ordered fetch of a profile's offerings; partial index for the public "active" read.
create index if not exists professional_offerings_profile_order_idx
  on public.professional_offerings (profile_id, sort_order);
create index if not exists professional_offerings_active_idx
  on public.professional_offerings (profile_id) where status = 'active';
create index if not exists professional_offerings_signature_work_idx
  on public.professional_offerings (signature_work_id) where signature_work_id is not null;

-- ----------------------------------------------------------------------------
-- 2) RLS — public-read-when-active + owner-manage (mirrors signature_works)
--    Active offerings are world-readable (they render on the public profile);
--    the owner can always read their own (drafts/inactive included) and is the
--    only one who can write. The public /[handle] page also reads via the
--    service role, which bypasses RLS — this policy governs RLS-scoped clients.
-- ----------------------------------------------------------------------------
alter table public.professional_offerings enable row level security;

drop policy if exists professional_offerings_read_active on public.professional_offerings;
create policy professional_offerings_read_active on public.professional_offerings
  for select to anon, authenticated
  using (status = 'active' or public.owns_talent_profile(profile_id));

drop policy if exists professional_offerings_insert_own on public.professional_offerings;
create policy professional_offerings_insert_own on public.professional_offerings
  for insert to authenticated
  with check (public.owns_talent_profile(profile_id));

drop policy if exists professional_offerings_update_own on public.professional_offerings;
create policy professional_offerings_update_own on public.professional_offerings
  for update to authenticated
  using (public.owns_talent_profile(profile_id))
  with check (public.owns_talent_profile(profile_id));

drop policy if exists professional_offerings_delete_own on public.professional_offerings;
create policy professional_offerings_delete_own on public.professional_offerings
  for delete to authenticated
  using (public.owns_talent_profile(profile_id));

-- Explicit Data-API grants (new tables are NOT auto-exposed — without these
-- PostgREST returns 404). RLS above still governs row visibility.
grant select on public.professional_offerings to anon, authenticated, service_role;
grant select, insert, update, delete on public.professional_offerings to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3) Media bucket — dedicated Offering media, separate lifecycle from `gallery`
--    Public read (offering images show on public profiles). Writes are OWNER-
--    SCOPED by path convention: the first folder segment MUST be the uploader's
--    auth.uid() (e.g. "<uid>/offering-<id>.jpg"). This gives Offering media its
--    OWN ownership rules and guarantees it never mingles with the profile
--    `gallery` bucket. (V1 uploads run through the service role, which bypasses
--    these policies; they are defense-in-depth + future direct-client uploads.)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('offering-media', 'offering-media', true)
on conflict (id) do nothing;

drop policy if exists offering_media_public_read on storage.objects;
create policy offering_media_public_read on storage.objects
  for select to public
  using (bucket_id = 'offering-media');

drop policy if exists offering_media_insert_own on storage.objects;
create policy offering_media_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'offering-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists offering_media_update_own on storage.objects;
create policy offering_media_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'offering-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'offering-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists offering_media_delete_own on storage.objects;
create policy offering_media_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'offering-media' and (storage.foldername(name))[1] = auth.uid()::text);

commit;

-- ============================================================================
-- END. Adds public.professional_offerings (RLS + grants) and the public
-- `offering-media` bucket with owner-scoped write policies. Purely additive:
-- no existing table, column, policy, or bucket is modified.
--
-- ROLLBACK (if ever needed):
--   begin;
--   drop table if exists public.professional_offerings cascade;
--   drop policy if exists offering_media_public_read on storage.objects;
--   drop policy if exists offering_media_insert_own  on storage.objects;
--   drop policy if exists offering_media_update_own  on storage.objects;
--   drop policy if exists offering_media_delete_own  on storage.objects;
--   -- Optionally remove the (empty) bucket:
--   -- delete from storage.buckets where id = 'offering-media';
--   commit;
-- ============================================================================
