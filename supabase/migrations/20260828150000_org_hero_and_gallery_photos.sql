-- ============================================================================
-- Relevé Connect — Migration: org Hero image + Photo Gallery
-- ----------------------------------------------------------------------------
-- Extends the EXISTING shared org profile (employer_profiles, used identically
-- by Studios and Dance Teams — org_type is the only discriminator) with a Hero/
-- Cover image and up to 6 Additional Photos. No new schema/architecture: same
-- table, same public-read/admin-write `org-branding` Storage bucket the
-- existing logo upload already uses (its {employer_id}/ prefix policies already
-- cover any object name, so hero-*/gallery-* need no new storage policy).
--
-- Additive:
--   · employer_profiles.hero_url      — single image, nullable (mirrors logo_url)
--   · employer_profiles.gallery_urls  — jsonb array, max 6 (mirrors the existing
--     talent_profiles.gallery_urls shape/default exactly, for one consistent
--     "photo gallery" convention across the product)
--   · widen org-branding's bucket file_size_limit 2MB → 5MB (real photos are
--     larger than a logo/mascot graphic) — a strict widening, so the existing
--     logo upload (which enforces its OWN 2MB limit in application code,
--     unchanged) is unaffected. allowed_mime_types unchanged (still permits the
--     svg the logo upload needs); the new hero/gallery routes independently
--     restrict themselves to PNG/JPEG at the application layer.
-- ============================================================================

begin;

alter table public.employer_profiles add column if not exists hero_url text;
alter table public.employer_profiles add column if not exists gallery_urls jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.employer_profiles
    add constraint employer_profiles_gallery_urls_max6
    check (jsonb_typeof(gallery_urls) = 'array' and jsonb_array_length(gallery_urls) <= 6);
exception when duplicate_object then null; end $$;

update storage.buckets
  set file_size_limit = 5242880 -- 5 MB
  where id = 'org-branding';

commit;

-- ============================================================================
-- END. Additive only — no existing column, policy, or bucket behavior removed.
--
-- ROLLBACK (if ever needed):
--   begin;
--   alter table public.employer_profiles drop constraint if exists employer_profiles_gallery_urls_max6;
--   alter table public.employer_profiles drop column if exists gallery_urls;
--   alter table public.employer_profiles drop column if exists hero_url;
--   update storage.buckets set file_size_limit = 2097152 where id = 'org-branding';
--   commit;
-- ============================================================================
