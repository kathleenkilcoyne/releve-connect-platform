-- ============================================================================
-- Relevé Connect — Migration: the Roster reads My Services
-- ----------------------------------------------------------------------------
-- ⏳ PENDING — pre-flighted, awaiting apply.
--
-- ── Why ──
-- The 2026-08-18 principle: **one fact, one source of truth, many useful places
-- it can appear.** The fact is "this professional offers Choreography". Its one
-- source of truth is a row in `professional_offerings` (customer-facing: My
-- Services). The Roster is one of the many useful places it should appear.
--
-- Until now the Roster could only discover what someone offers through the
-- `availability_tags` rows with kind = 'currently' — the same fact, stored a
-- second time, in a shape with no title, price, description or CTA. Migration
-- 20260818143121 converted those tags into real services and marked the tags
-- inactive; that removed four Roster filters and left nothing in their place.
-- This migration closes that gap.
--
-- ── What this does ──
--   1. Adds `service_slugs` to the `roster_profiles` view, derived from each
--      profile's ACTIVE My Services rows.
--   2. Ensures the five canonical services exist, in the founder's stated order
--      (Kathleen, 2026-08-18): Choreography · Master Classes · Private Coaching
--      · Adjudication · Guest Teaching.
--
-- ── What this deliberately does NOT do ──
--   · It does NOT delete the inactive legacy tags. They stay until the new path
--     is verified in the product (founder instruction). `availability_slugs` is
--     unchanged, so every existing `?avail=` URL keeps matching exactly as it
--     did — nothing loses results.
--   · It does NOT rename or delete "Private Audition Coaching". "Private
--     Coaching" is ADDED alongside it. Renaming would silently destroy the word
--     "Audition", which may be the point of that service. See the note at the
--     foot — this is the one item needing a founder decision.
--   · It does NOT touch This Week, personal_events or service_availability. The
--     privacy firewall is untouched.
--   · No table, column or constraint is altered. A view definition and data.
--
-- ── Exposure ──
-- `roster_profiles` is readable by anon/authenticated (pre-existing). The new
-- column derives ONLY from `professional_offerings` rows with status = 'active',
-- which are already world-readable under the `professional_offerings_read_active`
-- policy. Nothing newly private is exposed.
--
-- ── The slug rule ──
-- ⚠ The expression below MUST stay identical to `serviceSlug()` in
-- `src/lib/roster/services.ts`. If they drift the facet silently matches
-- nothing and no error is raised. `services.test.ts` pins the shared cases.
--     lower(btrim(regexp_replace(btrim(title), '[^a-zA-Z0-9]+', '-', 'g'), '-'))
-- Verified against the TypeScript on: "Private Audition Coaching",
-- "Master Classes", "Guest Teaching", "  Competition  Cleaning! ", "Jazz & Tap".
-- ============================================================================

-- 1 ── The five canonical services, in the founder's order. -------------------
-- Scoped to the profiles in the 2026-08-18 conversion cohort (those already
-- holding at least one converted service), so this is a data correction to
-- existing members and never seeds a service onto a future member's profile.
with cohort as (
  select distinct profile_id
    from professional_offerings
   where lower(title) in ('choreography', 'master classes', 'adjudication', 'guest teaching')
),
wanted (title, short_description, ord) as (
  values
    ('Choreography',   'Available for choreography commissions.',              1),
    ('Master Classes', 'Available to teach master classes.',                   2),
    ('Private Coaching', 'Private coaching sessions.',                         3),
    ('Adjudication',   'Available to adjudicate competitions and events.',     4),
    ('Guest Teaching', 'Available for guest teaching engagements.',            5)
)
insert into professional_offerings
  (profile_id, type, title, short_description, pricing_type, status, sort_order)
select c.profile_id, 'service', w.title, w.short_description, 'contact', 'active', w.ord
  from cohort c
  cross join wanted w
 where not exists (
   select 1 from professional_offerings o
    where o.profile_id = c.profile_id
      and lower(o.title) = lower(w.title)
 );

-- Order them as the founder listed them. Anything else the member created keeps
-- its own place after the five (sort_order is only a display order).
update professional_offerings o
   set sort_order = w.ord
  from (values
    ('choreography', 1), ('master classes', 2), ('private coaching', 3),
    ('adjudication', 4), ('guest teaching', 5)
  ) as w(title_lower, ord)
 where lower(o.title) = w.title_lower
   and o.sort_order is distinct from w.ord;

-- Push anything NOT in the canonical five to sit after them, preserving their
-- relative order. (Today that is only "Private Audition Coaching".)
update professional_offerings o
   set sort_order = 10 + o.sort_order
 where lower(o.title) not in
       ('choreography','master classes','private coaching','adjudication','guest teaching')
   and o.sort_order < 10;

-- 2 ── The view gains `service_slugs`. ----------------------------------------
-- Every existing column is reproduced in its existing order (CREATE OR REPLACE
-- requires it); the new column is appended last.
create or replace view public.roster_profiles as
select
  p.profile_id,
  p.user_id,
  p.display_name,
  p.public_slug,
  p.primary_role,
  p.city,
  p.state_province,
  p.country,
  p.region_id,
  p.headshot_url,
  p.verification_flag,
  p.honorifics,
  p.years_experience,
  p.search_tsv,
  coalesce((select array_agg(distinct s.slug)
              from profile_styles ps join styles s on s.id = ps.style_id
             where ps.profile_id = p.profile_id), '{}'::text[]) as style_slugs,
  coalesce((select array_agg(distinct l.slug)
              from profile_levels pl join levels l on l.id = pl.level_id
             where pl.profile_id = p.profile_id), '{}'::text[]) as level_slugs,
  coalesce((select array_agg(distinct c.slug)
              from profile_certifications pc join certifications c on c.id = pc.certification_id
             where pc.profile_id = p.profile_id), '{}'::text[]) as cert_slugs,
  -- UNCHANGED. The legacy tags (including the four inactive `currently` ones)
  -- still resolve here, so every existing `?avail=` search keeps its results.
  coalesce((select array_agg(distinct a.slug)
              from profile_availability pa join availability_tags a on a.id = pa.availability_tag_id
             where pa.profile_id = p.profile_id), '{}'::text[]) as availability_slugs,
  (exists (select 1 from memberships m
            where m.user_id = p.user_id
              and m.membership_status = 'active'::membership_status)) as owner_active,
  -- NEW — My Services as the source of truth for what this person offers.
  coalesce((select array_agg(distinct lower(btrim(regexp_replace(btrim(o.title), '[^a-zA-Z0-9]+', '-', 'g'), '-')))
              from professional_offerings o
             where o.profile_id = p.profile_id
               and o.status = 'active'), '{}'::text[]) as service_slugs
from talent_profiles p
where p.profile_status = 'published'::publish_status
  and p.visibility = 'public'::visibility_status;

-- ============================================================================
-- ⚠ FOR THE FOUNDER — one decision left open on purpose
-- "Private Coaching" was ADDED; "Private Audition Coaching" was NOT renamed or
-- deleted. Both now exist. If they are meant to be the same service, say which
-- title wins and it is a one-line update; if they are genuinely different
-- (audition prep vs general coaching), nothing more is needed.
-- ============================================================================
