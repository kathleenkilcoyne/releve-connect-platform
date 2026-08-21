-- ============================================================================
-- Relevé Connect — Migration: organization branding
-- ----------------------------------------------------------------------------
-- Lets an org (studio or dance team) carry its own identity into the member
-- experience — logo/mascot, up to two accent colors, and a short motto — so a
-- member opens This Week and sees their own team above the calendar, INSIDE
-- Relevé (this personalizes; it never replaces the platform mark).
--
-- Additive:
--   · employer_profiles.brand_accent    — primary accent (hex), nullable
--   · employer_profiles.brand_accent_2  — optional secondary accent (hex)
--   · employer_profiles.team_motto      — short motto, nullable, <= 60 chars
--   · reuse the existing employer_profiles.logo_url for the logo/mascot
--   · a public-read Storage bucket `org-branding`, objects keyed {employer_id}/…,
--     writable only by that org's administrator (owner_user_id).
-- ============================================================================

begin;

alter table public.employer_profiles add column if not exists brand_accent text;
alter table public.employer_profiles add column if not exists brand_accent_2 text;
alter table public.employer_profiles add column if not exists team_motto text;

do $$ begin
  alter table public.employer_profiles
    add constraint employer_profiles_team_motto_len check (char_length(team_motto) <= 60);
exception when duplicate_object then null; end $$;

-- Public-read bucket; PNG/JPG/SVG up to 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-branding', 'org-branding', true, 2097152,
  array['image/png', 'image/jpeg', 'image/svg+xml']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/svg+xml'];

-- Anyone may READ (the bucket is public); only the org's administrator may write,
-- and only under their own {employer_id}/ prefix.
do $$ begin
  create policy "org_branding_public_read" on storage.objects
    for select using (bucket_id = 'org-branding');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "org_branding_admin_insert" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'org-branding'
      and exists (
        select 1 from public.employer_profiles ep
        where ep.employer_id::text = (storage.foldername(name))[1]
          and ep.owner_user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "org_branding_admin_update" on storage.objects
    for update to authenticated
    using (
      bucket_id = 'org-branding'
      and exists (
        select 1 from public.employer_profiles ep
        where ep.employer_id::text = (storage.foldername(name))[1]
          and ep.owner_user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "org_branding_admin_delete" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'org-branding'
      and exists (
        select 1 from public.employer_profiles ep
        where ep.employer_id::text = (storage.foldername(name))[1]
          and ep.owner_user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

commit;

-- END.
