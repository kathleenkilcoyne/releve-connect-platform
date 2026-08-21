-- ============================================================================
-- Relevé Connect — Migration: "I'm currently accepting" → My Services
-- ----------------------------------------------------------------------------
-- ✅ APPLIED to production 2026-08-18, on the founder's explicit instruction
--    ("Auto-convert the four existing 'I'm currently accepting' service tags").
--    Registered in the Supabase migration ledger as version 20260818143121,
--    name `currently_accepting_to_my_services` — this filename matches that
--    version on purpose.
--
--    Pre-flight (read-only, before applying): 4 conversions, all on the single
--    live profile, none already present.
--    Verified after: 5 offerings (1 pre-existing "Private Audition Coaching"
--    untouched + 4 converted), 4 `currently` tags now is_active = false, 5
--    `general` tags still active, all 6 profile_availability rows preserved
--    including all 4 `currently` answers.
--    Idempotency proven by re-running the insert: still 5 offerings, 0 added.
--
--    REVERSAL, if the Roster/search verification fails:
--      update availability_tags set is_active = true where kind = 'currently';
--      delete from professional_offerings
--       where pricing_type = 'contact' and type = 'service'
--         and title in ('Choreography','Master Classes','Adjudication','Guest Teaching');
--
-- ── Why ──
-- Founder, 2026-08-18: "The existing 'I'M CURRENTLY ACCEPTING' section
-- duplicates My Services and should not remain as a separate concept."
--
-- The audit confirmed it. `availability_tags` is one table doing two jobs, and
-- the `kind` column is already the seam:
--
--   kind = 'general'   → Saturdays · Weekends · Summers Only · Willing to Travel
--                        · Virtual Available
--                        WHERE and HOW someone can work. Genuine availability.
--                        STAYS. Untouched by this migration.
--
--   kind = 'currently' → Accepting Choreography · Accepting Master Classes
--                        · Available for Adjudication
--                        · Available for Guest Teaching
--                        WHAT someone offers. These are services wearing an
--                        availability costume — a low-fidelity duplicate of an
--                        offering, with no title, price, description or CTA.
--
-- The ratified architecture this serves:
--   My Services  = what I offer
--   Availability = where / how I work
--   This Week    = when I'm available for the services I already offer
--
-- ── What this does ──
--   1. Converts every profile's `currently` tags into equivalent rows in
--      `professional_offerings` (customer-facing name: "My Services").
--   2. Marks the four `currently` tags `is_active = false`.
--
-- ── What this deliberately does NOT do ──
--   · It does NOT delete the tags (founder: "preserve the old tags as inactive
--     rather than deleting them until we verify the new My Services equivalents
--     are correctly powering the Roster/search experience"). Reversal is one
--     UPDATE.
--   · It does NOT delete any `profile_availability` row. Every member's original
--     answer survives verbatim, so the conversion is fully reversible.
--   · It does NOT touch `kind = 'general'`.
--   · It does NOT touch personal_events / service_availability. The privacy
--     firewall between a private calendar and public availability is unrelated
--     to this change and stays exactly as it is.
--   · NO SCHEMA CHANGE. Tables, columns and constraints are untouched — this is
--     a data migration only.
--
-- ── Idempotency ──
-- The insert is guarded by NOT EXISTS on (profile_id, lower(title)), so running
-- this twice cannot create a duplicate service. There is no unique constraint to
-- lean on, and adding one would be a schema change this migration is not
-- permitted to make, so the guard is in the statement.
--
-- ── Reconciliation note (2026-08-21, this branch) ──
-- This is a DATA-only migration (no DDL). Confirmed, read-only, that the live
-- database already reflects this migration's end state — Kathleen's real
-- profile already carries exactly these converted services, and the four
-- `currently` tags are already `is_active = false`. Added here verbatim, using
-- its exact live-ledger version, purely so this branch's local migration
-- history stops disagreeing with the database. Re-running it is a proven no-op
-- (see the header above): the `NOT EXISTS` guard matches nothing a second time.
-- ============================================================================

begin;

-- 1 ── Convert. One service per held `currently` tag, per profile. ------------
--
-- pricing_type 'contact' rather than a guessed number: the tag never carried a
-- price, and inventing one would put words in a member's mouth. It renders as
-- "Contact for pricing" (lib/offerings/offerings.ts pricingDisplay).
-- status 'active' so the converted service behaves exactly as the tag did:
-- visible, and immediately powering the public profile.
with tag_map (slug, title, short_description) as (
  values
    ('accepting-choreography',       'Choreography',   'Available for choreography commissions.'),
    ('accepting-master-classes',     'Master Classes', 'Available to teach master classes.'),
    ('available-for-adjudication',   'Adjudication',   'Available to adjudicate competitions and events.'),
    ('available-for-guest-teaching', 'Guest Teaching', 'Available for guest teaching engagements.')
),
converted as (
  select
    pa.profile_id,
    m.title,
    m.short_description,
    -- Append after anything the member already built, in a stable order.
    coalesce(
      (select max(o.sort_order) from professional_offerings o where o.profile_id = pa.profile_id),
      0
    ) + row_number() over (partition by pa.profile_id order by t.sort_order) as sort_order
  from profile_availability pa
  join availability_tags t on t.id = pa.availability_tag_id and t.kind = 'currently'
  join tag_map m on m.slug = t.slug
)
insert into professional_offerings
  (profile_id, type, title, short_description, pricing_type, status, sort_order)
select c.profile_id, 'service', c.title, c.short_description, 'contact', 'active', c.sort_order
from converted c
where not exists (
  select 1
  from professional_offerings o
  where o.profile_id = c.profile_id
    and lower(o.title) = lower(c.title)
);

-- 2 ── Retire the vocabulary, keep the evidence. ------------------------------
-- The editor and the Roster filter already read `is_active = true`, so this
-- removes the duplicate concept from both without deleting a single answer.
update availability_tags
   set is_active = false
 where kind = 'currently'
   and is_active = true;

commit;
