-- ============================================================================
-- Relevé Connect — Migration: public slug for studio profiles (2026-07-29)
-- ----------------------------------------------------------------------------
-- The public studio directory + per-studio profile live at /studios and
-- /studios/<slug>. A studio needs a stable, human URL slug for that. Add a
-- nullable, unique `public_slug` and backfill the currently-LIVE studios from
-- their name (e.g. "Stella" → "stella"). Future publishes set the slug in the
-- publish action.
--
-- Additive only: no status or content changes — a live studio's data is
-- untouched, it just gains a slug.
-- ============================================================================

begin;

alter table public.employer_profiles
  add column if not exists public_slug text;

-- Unique across studios that have one (null allowed, many).
create unique index if not exists employer_profiles_public_slug_key
  on public.employer_profiles (public_slug)
  where public_slug is not null;

-- Backfill live studios only (the ones that are public). Slugify the name;
-- guard against an empty result or the reserved "join" sub-path.
update public.employer_profiles e
set public_slug = case
  when s.slug = '' or s.slug = 'join' then 'studio-' || left(e.employer_id::text, 8)
  else s.slug
end
from (
  select employer_id,
         regexp_replace(
           regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g'),
           '(^-+|-+$)', '', 'g'
         ) as slug
  from public.employer_profiles
  where status = 'live' and public_slug is null and coalesce(trim(name), '') <> ''
) s
where e.employer_id = s.employer_id;

commit;
