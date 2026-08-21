-- Slice D real implementation (2026-08-20). Adds the roles Kathleen named in
-- her Slice D review ("Performer", "Coach", "Director") that the Slice A
-- taxonomy didn't yet have, and relabels "Teacher" -> "Teacher / Educator" per
-- the same feedback. Additive only — nothing removed, nothing renamed away.
--
-- NOTE ON SCOPE: this is DELIBERATELY additive to the existing Slice A set
-- (teacher, choreographer, studio_owner, dancer, dancer_singer,
-- dancer_singer_actor, adjudicator), not a replacement of it. The scratch
-- mock Kathleen reviewed only had 2 example roles wired in (an oversight in
-- how the mock was built, not a decision to drop Dancer / Dancer-Singer /
-- Dancer-Singer-Actor / Studio Owner) — those stay. "Director" is added as
-- its OWN role, distinct from the existing "Studio Owner / Director" label —
-- a rehearsal/artistic director is not necessarily a studio owner. Flagged
-- for founder review; not silently merged or dropped either way.
insert into public.role_types (slug, label, is_active, sort_order)
values
  ('performer', 'Performer', true, 14),
  ('coach', 'Coach', true, 15),
  ('director', 'Director', true, 16)
on conflict (slug) do nothing;

update public.role_types
  set label = 'Teacher / Educator'
  where slug = 'teacher';
