-- ============================================================================
-- Relevé Connect — Migration: Professional Services (member business layer)
-- ----------------------------------------------------------------------------
-- A vetted Relevé professional can showcase OTHER professional services or
-- businesses they run outside their primary dance work — massage therapy,
-- physical therapy, Pilates, photography, costume design, music editing,
-- accompanying, and so on.
--
-- This is NOT advertising and NOT a marketplace. It is part of the individual
-- professional's identity: "here is another way I can serve the dance
-- community." Nothing here is sold, ranked, boosted, or paid for; Relevé takes
-- nothing (no-tax-on-labor, CLAUDE.md §7.1). The table stores DISPLAY + ROUTING
-- only — a visitor leaves for the professional's own website/booking page, or
-- contacts them directly if (and only if) the professional chose to publish
-- that contact detail.
--
-- DESIGN PRINCIPLES (mirrors professional_offerings, deliberately):
--   * SEPARATE TABLE from professional_offerings. An Offering is what you do as
--     a dance professional ("What I Offer"); a Service is a distinct business
--     you run. Different fields (business identity, business card, category
--     taxonomy), different section, different meaning. Merging them would blur
--     both.
--   * `category` is CHECK-constrained text (NOT a Postgres enum) so the Roster
--     can filter on it later and new categories can be added by widening the
--     check on both sides. Mirrored by SERVICE_CATEGORIES in
--     src/lib/services/services.ts — keep the two in step.
--   * SEARCH-READY NOW, no marketplace page yet (founder direction §4): the
--     category is indexed for a future Roster facet. No separate directory route
--     is created by this migration.
--   * ACCOMPANIST SEAM: "Accompanist / Class Musician" is one category today,
--     with its own optional structured fields (instrument, what they play for,
--     rate, reel). Those fields live as real columns, not loose JSON, so
--     musicians can later become their own full Relevé professional category —
--     and so The Swing can one day match "studio needs a vetted accompanist
--     Thursday" — without a rebuild or a data migration.
--   * MODERATION SEAM: `moderation_status` exists and is enforced on the public
--     read from day one, defaulting to 'ok'. No approval workflow is built (the
--     founder does not want one yet); adding one later means writing to a column
--     that already gates the render.
--   * ADDITIVE + REVERSIBLE. A profile with zero services is byte-for-byte
--     unchanged. Rollback is a clean DROP (see the note at the foot of the file).
--
-- Idempotent (create-if-not-exists; drop-policy-if-exists then recreate).
-- PREREQUISITES: talent_profiles and public.owns_talent_profile() (both on main).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) professional_services — one row per business/service (many per profile)
-- ----------------------------------------------------------------------------
create table if not exists public.professional_services (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid not null references public.talent_profiles(profile_id) on delete cascade,

  -- WHAT KIND of service. Controlled vocabulary — this is the spine of the
  -- future Roster filter, so it is never free text. 'other' carries a member
  -- label in category_other_label.
  category             text not null check (category in (
                         'massage_therapy','physical_therapy','pilates','personal_training',
                         'photography','videography','costume_design','music_editing',
                         'makeup_hair','vocal_coaching','nutrition_wellness','marketing_social',
                         'accompanist','other')),
  category_other_label text,

  -- Business identity.
  business_name        text not null,
  short_description    text,
  location             text,

  -- How the service is delivered. 'touring' exists for the accompanist branch
  -- (a class musician who travels); it is harmless on any other category.
  service_type         text check (service_type is null or service_type in
                         ('in_person','virtual','mobile','touring','multiple')),

  -- Destinations. All optional; all validated http(s)-only by the app layer.
  website_url          text,
  booking_url          text,
  social_url           text,

  -- CONTACT — stored so the member can keep it on file, PUBLISHED ONLY when
  -- they explicitly opt in. The public render checks show_email / show_phone;
  -- both default to false, so entering a phone number never publishes it.
  business_email       text,
  business_phone       text,
  show_email           boolean not null default false,
  show_phone           boolean not null default false,

  -- Business card OR logo/image — one asset, dedicated `service-media` bucket.
  image_url            text,

  -- Button label OVERRIDE. When null the app derives it from what exists
  -- (booking → Book, website → Visit Website, contact → Contact); see
  -- deriveServiceCta in src/lib/services/services.ts.
  cta_label            text check (cta_label is null or cta_label in
                         ('visit_website','book','learn_more','contact')),

  -- ---- Accompanist / class musician (all optional, all category-scoped) ----
  instrument           text check (instrument is null or instrument in ('piano','percussion','other')),
  instrument_other     text,
  -- What they play for. Array so a future Swing match ("needs a ballet class
  -- pianist") is a containment query, not a text search.
  accompanist_for      text[] not null default '{}'::text[],
  -- Rate: either a human string ("$60 / class") or the explicit "Contact for
  -- rate" posture. Never a platform-set number — Relevé does not price a
  -- member's own work.
  rate_display         text,
  rate_contact         boolean not null default false,
  -- Audio / video / reel link (a class musician's equivalent of a teaching reel).
  media_url            text,

  -- 'active' = the member turned ON "Display this service on my public profile".
  -- 'hidden' = kept on file, not shown. (Mirrors professional_offerings.status.)
  status               text not null default 'active' check (status in ('active','hidden')),

  -- MODERATION SEAM (see header). 'removed' hides the row publicly even when the
  -- member has it active. No admin workflow writes this yet.
  moderation_status    text not null default 'ok'
                         check (moderation_status in ('ok','flagged','removed')),
  moderation_note      text,
  moderated_at         timestamptz,

  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),   -- app-maintained on write

  -- Vocabulary guard for the accompanist array (the app validates too).
  constraint professional_services_accompanist_for_vocab check (
    accompanist_for <@ array[
      'ballet','modern','contemporary','musical_theatre','improvisation',
      'auditions','rehearsals','master_classes','other'
    ]::text[]
  )
);

-- Ordered fetch of one profile's services; partial index for the public read.
create index if not exists professional_services_profile_order_idx
  on public.professional_services (profile_id, sort_order);
create index if not exists professional_services_active_idx
  on public.professional_services (profile_id)
  where status = 'active' and moderation_status <> 'removed';

-- FUTURE ROSTER FILTERING (founder direction §4): find every professional
-- offering a given kind of service. Indexed now so the filter is a query change,
-- not a schema change.
create index if not exists professional_services_category_idx
  on public.professional_services (category)
  where status = 'active' and moderation_status <> 'removed';

-- FUTURE SWING / MUSICIANS ROSTER: "who accompanies ballet classes?" as a
-- containment query over the array.
create index if not exists professional_services_accompanist_for_idx
  on public.professional_services using gin (accompanist_for);

-- ----------------------------------------------------------------------------
-- 2) RLS — public-read-when-displayed + owner-manage (mirrors professional_offerings)
--    The public /[handle] page reads via the service role (which bypasses RLS)
--    and re-applies the same filter explicitly; this policy governs RLS-scoped
--    clients (the member's own editor, and any future direct client read).
-- ----------------------------------------------------------------------------
alter table public.professional_services enable row level security;

drop policy if exists professional_services_read_active on public.professional_services;
create policy professional_services_read_active on public.professional_services
  for select to anon, authenticated
  using (
    (status = 'active' and moderation_status <> 'removed')
    or public.owns_talent_profile(profile_id)
  );

drop policy if exists professional_services_insert_own on public.professional_services;
create policy professional_services_insert_own on public.professional_services
  for insert to authenticated
  with check (public.owns_talent_profile(profile_id));

drop policy if exists professional_services_update_own on public.professional_services;
create policy professional_services_update_own on public.professional_services
  for update to authenticated
  using (public.owns_talent_profile(profile_id))
  with check (public.owns_talent_profile(profile_id));

drop policy if exists professional_services_delete_own on public.professional_services;
create policy professional_services_delete_own on public.professional_services
  for delete to authenticated
  using (public.owns_talent_profile(profile_id));

-- Explicit Data-API grants (new tables are NOT auto-exposed — without these
-- PostgREST returns 404). RLS above still governs row visibility.
grant select on public.professional_services to anon, authenticated, service_role;
grant select, insert, update, delete on public.professional_services to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3) Media bucket — business cards / logos, own lifecycle
--    Public read (the card shows on public profiles). Writes are OWNER-SCOPED by
--    path convention: the first folder segment MUST be the uploader's auth.uid()
--    (e.g. "<uid>/service-1234.jpg"). Service media never mingles with the
--    profile `gallery` or `offering-media` buckets.
--    (V1 uploads run through the service role, which bypasses these policies;
--    they are defense-in-depth + future direct-client uploads.)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('service-media', 'service-media', true)
on conflict (id) do nothing;

drop policy if exists service_media_public_read on storage.objects;
create policy service_media_public_read on storage.objects
  for select to public
  using (bucket_id = 'service-media');

drop policy if exists service_media_insert_own on storage.objects;
create policy service_media_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'service-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists service_media_update_own on storage.objects;
create policy service_media_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'service-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'service-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists service_media_delete_own on storage.objects;
create policy service_media_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'service-media' and (storage.foldername(name))[1] = auth.uid()::text);

commit;

-- ============================================================================
-- END. Adds public.professional_services (RLS + grants + future-filter indexes)
-- and the public `service-media` bucket with owner-scoped write policies.
-- Purely additive: no existing table, column, policy, or bucket is modified, so
-- every existing profile loads and saves exactly as before.
--
-- ROLLBACK (if ever needed):
--   begin;
--   drop table if exists public.professional_services cascade;
--   drop policy if exists service_media_public_read on storage.objects;
--   drop policy if exists service_media_insert_own  on storage.objects;
--   drop policy if exists service_media_update_own  on storage.objects;
--   drop policy if exists service_media_delete_own  on storage.objects;
--   -- Optionally remove the (empty) bucket:
--   -- delete from storage.buckets where id = 'service-media';
--   commit;
-- ============================================================================
