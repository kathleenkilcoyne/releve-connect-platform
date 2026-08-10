-- ============================================================================
-- Relevé Connect — Migration: professional actor wall (Slice 0, the safety wall)
-- ----------------------------------------------------------------------------
-- The #1 architectural constraint (PROFESSIONAL-IDENTITY-ARCHITECTURE §5/§9.1):
-- the professional DISCOVERY + MESSAGING graph is ADULT-ONLY — a participant must
-- be a professional (`talent_profiles`) or a studio/employer (`employer_profiles`).
-- Students/minors and families/guardians are NOT participants; their world is the
-- separate `affiliations` + `communications` + This Week pilot, walled off.
--
-- This migration adds the ONE reusable primitive that gate rests on:
-- `is_professional_actor(user_id)`. It is PURELY ADDITIVE — a SECURITY DEFINER
-- helper, no table changes, nothing touched in the founding-studio pilot. Slice 2
-- builds `conversations` / `messages` ON TOP of this: their RLS/CHECKs will require
-- BOTH participants to satisfy this function, so a student or family user can never
-- be a participant — enforced at the database layer, not just the UI.
--
-- Mirrors the existing helper style (is_studio_admin / is_guardian_of / …):
-- SECURITY DEFINER, stable, search_path pinned.
-- ============================================================================

begin;

-- True when the user is an ADULT professional/studio identity — the only kind of
-- identity allowed into the professional discovery + messaging graph. A family
-- guardian or a student (incl. a self-managed college-team adult, who is a
-- `students` row, not a `talent_profiles`) is NOT an actor and returns false.
create or replace function public.is_professional_actor(p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.talent_profiles tp where tp.user_id = p_user_id
  ) or exists (
    select 1 from public.employer_profiles ep where ep.owner_user_id = p_user_id
  );
$$;

comment on function public.is_professional_actor(uuid) is
  'Slice 0 safety wall: true iff the user is an adult professional (talent_profiles) '
  'or studio/employer (employer_profiles). The ONLY identities allowed into the '
  'professional discovery/messaging graph. Students/families are never actors. '
  'Slice 2 conversations/messages enforce participation with this function.';

-- Convenience for the messaging layer: both endpoints of a conversation must be
-- actors. Kept here so the rule lives in one place when Slice 2 wires the tables.
create or replace function public.both_professional_actors(p_a uuid, p_b uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.is_professional_actor(p_a) and public.is_professional_actor(p_b);
$$;

comment on function public.both_professional_actors(uuid, uuid) is
  'Slice 0 safety wall: true iff BOTH users are professional actors. Slice 2 uses '
  'this in the conversations insert CHECK/RLS so no conversation can include a '
  'student or family participant.';

commit;

-- END.
