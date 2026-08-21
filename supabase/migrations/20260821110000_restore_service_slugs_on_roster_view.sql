-- REGRESSION REPAIR (2026-08-21, night) — restores `service_slugs` on
-- `roster_profiles`, dropped as an unintended side effect of tonight's
-- Phase 1 rebuild (20260821100200_roster_view_role_focus_experience.sql).
--
-- WHAT HAPPENED: `service_slugs` was added to this view on 2026-08-18 by a
-- migration that lives only on the sibling branch `feature/this-week-ui-
-- redesign` (never merged here, never committed to this branch's local
-- migration history). This branch's Phase 1 work rebuilt the view from the
-- last definition IT knew about, which predated that column, so the DROP
-- VIEW + CREATE VIEW in that migration silently omitted it. The underlying
-- data (`professional_offerings`) was never touched and is fully intact —
-- only the view's exposure of it was lost.
--
-- THIS MIGRATION: purely additive repair. Reproduces the view exactly as
-- Phase 1 left it (role_slugs, style_slugs, level_slugs, focus_area_slugs,
-- cert_slugs, experience_slugs, availability_slugs, owner_active — nothing
-- else changed) and adds back `service_slugs`, using the identical
-- slug-derivation expression from the 2026-08-18 migration so any code on
-- the sibling branch that already depends on it keeps matching. No other
-- functionality removed or rewritten.
--
-- NOT a new feature; not a step toward Phase 2. Reconciling the two branches
-- is a separate, later decision.

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
    -- RESTORED — identical expression to the 2026-08-18
    -- roster_reads_my_services migration on feature/this-week-ui-redesign.
    -- Must stay byte-for-byte identical to serviceSlug() in that branch's
    -- src/lib/roster/services.ts if/when the branches are reconciled.
    coalesce((select array_agg(distinct lower(btrim(regexp_replace(btrim(o.title), '[^a-zA-Z0-9]+', '-', 'g'), '-')))
                from public.professional_offerings o
               where o.profile_id = p.profile_id
                 and o.status = 'active'), '{}'::text[]) as service_slugs,
    (exists (select 1 from public.memberships m
              where m.user_id = p.user_id
                and m.membership_status = 'active'::membership_status)) as owner_active
  from public.talent_profiles p
  where p.profile_status = 'published'::publish_status
    and p.visibility     = 'public'::visibility_status;

grant select on public.roster_profiles to service_role;
