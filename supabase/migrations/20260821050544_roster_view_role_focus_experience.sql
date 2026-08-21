-- Roster search rebuild, Phase 1. Part 3 of 3: repair the Roster's read side.
--
-- THE BUG BEING FIXED: the Roster's role tabs filtered on `primary_role`, a
-- single-value column on talent_profiles that the profile editor stopped
-- writing back on 2026-08-19 (see 20260819190100_expand_role_types_multi_role.sql)
-- in favour of the multi-value `profile_roles` join table. Every profile's
-- roles have been correctly captured in `profile_roles` since that migration
-- (backfilled for existing profiles, written at creation and on every edit) —
-- the Roster simply never read it. Anyone who edited their roles since then
-- had no way for that change to reach the Roster, and the "Performers" tab
-- was wired to `working_dancer`, a slug soft-retired the same day.
--
-- FIX: expose `role_slugs` (aggregated from profile_roles, exactly like
-- style_slugs/level_slugs/cert_slugs already are), plus `focus_area_slugs`
-- (existing taxonomy, already captured by the profile editor, never surfaced
-- here) and `experience_slugs` (the new Professional Experience taxonomy).
--
-- `primary_role` is left completely alone on talent_profiles — still not
-- written, still not read here. Nothing is dropped.
--
-- View recreated wholesale (CREATE OR REPLACE cannot add a column to a view).
-- Everything else is byte-for-byte the previous definition from
-- 20260724000000_availability_and_taxonomy.sql.

drop view if exists public.roster_profiles;

create view public.roster_profiles as
  select
    p.profile_id,
    p.user_id,
    p.display_name,
    p.public_slug,
    p.city,
    p.state_province,
    p.country,
    p.region_id,
    p.headshot_url,
    p.verification_flag,
    p.honorifics,
    p.years_experience,
    p.search_tsv,
    coalesce((select array_agg(distinct rt.slug)
                from public.profile_roles pr join public.role_types rt on rt.id = pr.role_id
               where pr.profile_id = p.profile_id), '{}'::text[]) as role_slugs,
    coalesce((select array_agg(distinct s.slug)
                from public.profile_styles ps join public.styles s on s.id = ps.style_id
               where ps.profile_id = p.profile_id), '{}'::text[]) as style_slugs,
    coalesce((select array_agg(distinct l.slug)
                from public.profile_levels pl join public.levels l on l.id = pl.level_id
               where pl.profile_id = p.profile_id), '{}'::text[]) as level_slugs,
    coalesce((select array_agg(distinct f.slug)
                from public.profile_focus_areas pf join public.focus_areas f on f.id = pf.focus_area_id
               where pf.profile_id = p.profile_id), '{}'::text[]) as focus_area_slugs,
    coalesce((select array_agg(distinct c.slug)
                from public.profile_certifications pc join public.certifications c on c.id = pc.certification_id
               where pc.profile_id = p.profile_id), '{}'::text[]) as cert_slugs,
    coalesce((select array_agg(distinct e.slug)
                from public.profile_professional_experience pe
                join public.professional_experience_tags e on e.id = pe.experience_tag_id
               where pe.profile_id = p.profile_id), '{}'::text[]) as experience_slugs,
    coalesce((select array_agg(distinct a.slug)
                from public.profile_availability pa join public.availability_tags a on a.id = pa.availability_tag_id
               where pa.profile_id = p.profile_id), '{}'::text[]) as availability_slugs,
    (exists (select 1 from public.memberships m
              where m.user_id = p.user_id
                and m.membership_status = 'active'::membership_status)) as owner_active
  from public.talent_profiles p
  where p.profile_status = 'published'::publish_status
    and p.visibility     = 'public'::visibility_status;

-- DROP VIEW throws the old grants away with it — the gotcha already
-- documented in 20260724000000. The Roster reads this view with the
-- service-role client only; forgetting this line makes it silently return
-- zero rows.
grant select on public.roster_profiles to service_role;
