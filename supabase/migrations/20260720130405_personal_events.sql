-- ============================================================================
-- personal_events — the professional's OWN calendar entries.
--
-- ── What this closes ──
-- "This Week" promises "one calendar, every role", but until now the only
-- source of events was the studio's schedule (`studio_classes`). That covers
-- what a member is booked to TEACH. It covers none of the rest of a working
-- artist's week: the company class they TAKE, the audition they're going to,
-- the prescreen DEADLINE on Friday, the coaching session they run privately.
-- Those are self-entered, belong to the person (not to any studio), and travel
-- with them between studios. Hence a separate, owner-owned table.
--
-- ── Deliberately NOT here ──
--   · teaching / taking a studio class → `studio_classes` + `class_sessions`.
--     A class is the studio's record; duplicating it here would create two
--     sources of truth for the same event.
--   · the standing "I'll sub via The Swing" toggle and travel radius →
--     `swing_availability` (a profile setting, not a dated event). A dated
--     availability WINDOW does live here, as category 'availability'; the card
--     reads the radius from swing_availability so the two are never duplicated.
--
-- ── Ownership and privacy ──
-- These rows are PRIVATE to the member. A personal calendar can reveal an
-- audition they haven't told their studio about, a medical appointment, a
-- deadline for a job they're leaving for. RLS is owner-only for every command,
-- with NO studio, teacher, or guardian read path — deliberately narrower than
-- anything else in the schedule layer. Sharing, if it is ever wanted, should be
-- an explicit opt-in built on top, never a default.
-- ============================================================================

begin;

-- The self-entered categories. Mirrors the UI's EventCategory minus the ones
-- the studio schedule already owns (teaching / taking / subbing) — a member
-- cannot hand-write "I taught this", because that is the studio's record.
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'personal_event_category') then
    create type public.personal_event_category as enum (
      'taking',        -- a class they take (company class, open class)
      'rehearsing',
      'auditioning',
      'coaching',
      'performance',
      'personal',
      'deadline',      -- a due date (prescreen, application) — a moment, not a span
      'availability'   -- a dated window they're open for work (see swing_availability)
    );
  end if;
end $$;

create table if not exists public.personal_events (
  event_id     uuid primary key default gen_random_uuid(),
  -- Owned by the PROFILE, not the user: it is the professional identity's
  -- calendar, consistent with how teaching assignments attach.
  profile_id   uuid not null references public.talent_profiles(profile_id) on delete cascade,
  category     public.personal_event_category not null,
  title        text not null,
  starts_at    timestamptz not null,
  -- Null for a moment-in-time entry (a deadline has no duration).
  ends_at      timestamptz,
  -- Carried per row: a member on tour is in a different zone each week, and the
  -- wall-clock time is what they actually mean.
  timezone     text not null default 'America/New_York',
  location     text,
  -- Free-form extra detail lines for the card, in display order.
  detail       text[] not null default '{}',
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint personal_events_ends_after_starts
    check (ends_at is null or ends_at > starts_at)
);

-- The week query is always "this profile, this date range".
create index if not exists personal_events_profile_starts_idx
  on public.personal_events (profile_id, starts_at);

comment on table public.personal_events is
  'A professional''s own calendar entries. Private to the owner; studio-scheduled classes live in studio_classes/class_sessions instead.';

-- ── RLS: owner-only, all commands, no exceptions ────────────────────────────
alter table public.personal_events enable row level security;

drop policy if exists personal_events_owner_all on public.personal_events;
create policy personal_events_owner_all on public.personal_events
  for all to authenticated
  using (public.owns_talent_profile(profile_id))
  with check (public.owns_talent_profile(profile_id));

commit;
