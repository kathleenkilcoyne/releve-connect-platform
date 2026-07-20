-- ============================================================================
-- "This Week" — demo fixture (Bergen Ballet)
--
-- FIXTURE DATA, NOT SCHEMA. This file is deliberately NOT in supabase/migrations
-- so it never runs as part of a deploy. Apply it by hand when you want the demo
-- week to have something in it.
--
-- Every id below is hardcoded and listed in RESUME-HERE.md, so the whole fixture
-- can be removed in one statement (see the teardown block at the bottom).
--
-- ── Who is who, and why ──
-- Bergen Ballet is owned by a fixture user that CANNOT SIGN IN (no auth.users
-- row — public.users has no FK to auth, so this is allowed). That is deliberate:
-- Kathleen is only a TEACHER at the studio, never its admin. It means the
-- class-scoped RLS path (`teaches_class`) is what actually serves her
-- professional week — if she owned the studio, `is_studio_admin` would grant
-- her everything and the interesting policy would never be tested.
--
-- Kathleen (kathleen@releveconnect.com) therefore wears two hats at once, which
-- is exactly the mockup:
--   · TEACHER  — assigned to Ballet III, so it appears in her professional week.
--   · GUARDIAN — Ava's parent, so Ava's week and the family comms appear too.
-- One login, both views, each served by a DIFFERENT policy.
-- ============================================================================

begin;

-- ── Fixed ids (documented in RESUME-HERE.md) ────────────────────────────────
-- studio owner user   11111111-1111-4111-8111-111111111111
-- employer profile    22222222-2222-4222-8222-222222222222
-- family account      33333333-3333-4333-8333-333333333333
-- student (Ava)       44444444-4444-4444-8444-444444444444
-- class: Ballet III   55555555-5555-4555-8555-555555555555
-- class: Jazz II      66666666-6666-4666-8666-666666666666
-- class: Showcase     77777777-7777-4777-8777-777777777777

-- Kathleen, the real signed-in account this fixture hangs off.
--   user    dd9a6115-4c75-494b-b1b7-2b2fe21e2f7d  (kathleen@releveconnect.com)
--   profile 2ec75e64-4980-4d9a-8df9-abfee39b550d

-- ── 1. The studio and its owner ─────────────────────────────────────────────

insert into public.users (user_id, email, account_type, display_name, status)
values ('11111111-1111-4111-8111-111111111111',
        'owner@bergen-ballet.fixture', 'employer', 'Bergen Ballet (fixture owner)', 'active')
on conflict (user_id) do nothing;

insert into public.employer_profiles (employer_id, owner_user_id, name, city, state_province, country, verified)
values ('22222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111',
        'Bergen Ballet', 'Ridgewood', 'NJ', 'US', true)
on conflict (employer_id) do nothing;

-- Kathleen is STAFF (teacher), not an admin. Her talent profile is linked so
-- that "assigned to teach this class" and "is this person" are the same fact.
insert into public.studio_staff (employer_id, user_id, role, talent_profile_id)
values ('22222222-2222-4222-8222-222222222222',
        'dd9a6115-4c75-494b-b1b7-2b2fe21e2f7d',
        'teacher',
        '2ec75e64-4980-4d9a-8df9-abfee39b550d')
on conflict (employer_id, user_id) do nothing;

-- ── 2. The family (PASSPORT + REVENUE seams) ────────────────────────────────

insert into public.family_accounts (family_id, owner_user_id, subscription_status, plan)
values ('33333333-3333-4333-8333-333333333333',
        'dd9a6115-4c75-494b-b1b7-2b2fe21e2f7d',
        'active', 'family_demo')
on conflict (family_id) do nothing;

-- Ava: a minor. date_of_birth is guardian-only; age_range is the studio-safe
-- bracket. visibility is pinned to 'family_only' by a CHECK — she is never
-- public, never on the Roster, never reviewable.
insert into public.students (student_id, family_id, display_name, date_of_birth, age_range)
values ('44444444-4444-4444-8444-444444444444',
        '33333333-3333-4333-8333-333333333333',
        'Ava', date '2013-04-18', '12-14')
on conflict (student_id) do nothing;

-- Kathleen's guardianship, with the granular permissions the calendar and the
-- message thread each require.
insert into public.guardianships
  (guardian_user_id, student_id, relationship, is_primary, permissions, consent_at, consent_version)
values ('dd9a6115-4c75-494b-b1b7-2b2fe21e2f7d',
        '44444444-4444-4444-8444-444444444444',
        'parent', true,
        '{calendar,messages,billing,medical_forms,pickup_authorization}'::public.guardian_permission[],
        now(), 'fixture-v1')
on conflict (guardian_user_id, student_id) do nothing;

-- ── 3. The classes (templates — sessions are materialised from these) ───────
-- series_start sits in the past and series_end well ahead, so the fixture is
-- live in whatever week you happen to open.

insert into public.studio_classes
  (class_id, employer_id, title, location, room, teacher_profile_id,
   recurrence, default_start, default_end, timezone, series_start, series_end, status)
values
  -- Kathleen teaches this one → it appears in BOTH her professional week
  -- (as a teacher) and Ava's week (as a student).
  ('55555555-5555-4555-8555-555555555555',
   '22222222-2222-4222-8222-222222222222',
   'Ballet III', 'Bergen Ballet, Ridgewood', 'Studio A',
   '2ec75e64-4980-4d9a-8df9-abfee39b550d',
   'FREQ=WEEKLY;BYDAY=MO', '16:30:00', '17:45:00', 'America/New_York',
   date '2026-06-01', date '2026-12-31', 'active'),

  -- No teacher_profile_id → Kathleen must NOT see this in her professional
  -- week. She only sees it because she is Ava's GUARDIAN. That contrast is the
  -- point of the fixture: two different policies, two different reasons.
  ('66666666-6666-4666-8666-666666666666',
   '22222222-2222-4222-8222-222222222222',
   'Jazz II', 'Bergen Ballet, Ridgewood', 'Studio B',
   null,
   'FREQ=WEEKLY;BYDAY=WE', '17:30:00', '18:30:00', 'America/New_York',
   date '2026-06-01', date '2026-12-31', 'active'),

  -- A ONE-OFF (recurrence null): its date IS series_start. Pinned to the
  -- Saturday of the current week so the fixture always has a weekend event.
  ('77777777-7777-4777-8777-777777777777',
   '22222222-2222-4222-8222-222222222222',
   'Winter Showcase — Call', 'bergenPAC stage', null,
   '2ec75e64-4980-4d9a-8df9-abfee39b550d',
   null, '16:30:00', '18:00:00', 'America/New_York',
   (date_trunc('week', current_date)::date + 5),  -- ISO week starts Monday; +5 = Saturday
   (date_trunc('week', current_date)::date + 5), 'active')
on conflict (class_id) do nothing;

-- ── 4. Enrollment + affiliations ────────────────────────────────────────────

insert into public.enrollments (student_id, class_id, status)
values
  ('44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555', 'active'),
  ('44444444-4444-4444-8444-444444444444', '66666666-6666-4666-8666-666666666666', 'active'),
  ('44444444-4444-4444-8444-444444444444', '77777777-7777-4777-8777-777777777777', 'active')
on conflict (student_id, class_id) do nothing;

insert into public.affiliations (subject_kind, subject_id, employer_id, role, status, started_at)
values
  ('student', '44444444-4444-4444-8444-444444444444',
   '22222222-2222-4222-8222-222222222222', 'student', 'active', date '2026-06-01'),
  ('talent',  '2ec75e64-4980-4d9a-8df9-abfee39b550d',
   '22222222-2222-4222-8222-222222222222', 'teacher', 'active', date '2026-06-01')
on conflict (subject_kind, subject_id, employer_id, role) do nothing;

-- ── 5. The studio <-> family thread (COORDINATION seam) ─────────────────────
-- One of each kind, so all four comms components render against real rows.
-- related_session_id stays null: sessions are materialised on first read, so
-- there is nothing stable to point at from a seed file.

insert into public.communications
  (communication_id, kind, studio_employer_id, family_id, student_id,
   from_user_id, from_employer_id, severity, direction, title, body, created_at)
values
  ('88888888-8888-4888-8888-888888888801', 'alert',
   '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
   '44444444-4444-4444-8444-444444444444', null,
   '22222222-2222-4222-8222-222222222222', 'change', null,
   'Wednesday Jazz II moved to 6:15 PM',
   'Studio A is booked for the showcase build — Jazz II runs 45 min later this week only.',
   now() - interval '2 days'),

  ('88888888-8888-4888-8888-888888888802', 'announcement',
   '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
   '44444444-4444-4444-8444-444444444444', null,
   '22222222-2222-4222-8222-222222222222', null, null,
   'Winter Showcase tickets are on sale',
   'Two per family reserved through Friday, then general release.',
   now() - interval '3 days'),

  ('88888888-8888-4888-8888-888888888803', 'note',
   '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
   '44444444-4444-4444-8444-444444444444',
   'dd9a6115-4c75-494b-b1b7-2b2fe21e2f7d', null, null, null,
   'Showcase prep — hair in a bun, bring pointe shoes', null,
   now() - interval '1 day'),

  ('88888888-8888-4888-8888-888888888804', 'message',
   '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
   '44444444-4444-4444-8444-444444444444',
   'dd9a6115-4c75-494b-b1b7-2b2fe21e2f7d', null, null, 'from_family',
   null, 'Thanks! Ava will be there for the 4:30 call.',
   now() - interval '4 hours')
on conflict (communication_id) do nothing;

-- ── 6. The professional's OWN entries (personal_events) ─────────────────────
-- The other half of "one calendar, every role": what Kathleen takes, auditions
-- for, and owes — none of which belongs to any studio. Private to her by RLS.
--
-- ⚠️ Note the PARENTHESES around (date + time) before AT TIME ZONE. That
-- operator binds tighter than +, so writing `date + time at time zone …` builds
-- a timetz and silently stores the wrong hour. Wrap the whole sum.

insert into public.personal_events
  (event_id, profile_id, category, title, starts_at, ends_at, timezone, location, detail, note)
values
  -- Mon 10:00 — a class she TAKES. Sorts above her 4:30 teaching slot, proving
  -- the two sources merge by real instant rather than by source.
  ('99999999-9999-4999-8999-999999999901','2ec75e64-4980-4d9a-8df9-abfee39b550d','taking',
   'Company Class',
   ((date_trunc('week', current_date)::date + 0) + time '10:00') at time zone 'America/New_York',
   ((date_trunc('week', current_date)::date + 0) + time '11:30') at time zone 'America/New_York',
   'America/New_York','Steps on Broadway, NYC', '{"travel 55 min from home"}', null),

  -- Tue 1:00 PM
  ('99999999-9999-4999-8999-999999999904','2ec75e64-4980-4d9a-8df9-abfee39b550d','auditioning',
   'Audition — Regional Tour',
   ((date_trunc('week', current_date)::date + 1) + time '13:00') at time zone 'America/New_York',
   ((date_trunc('week', current_date)::date + 1) + time '15:00') at time zone 'America/New_York',
   'America/New_York','Pearl Studios, NYC', '{"bring heels"}', null),

  -- Thu 4–9 PM — a dated availability WINDOW. "within 25 miles" is NOT stored
  -- here; it is read from swing_availability below.
  ('99999999-9999-4999-8999-999999999902','2ec75e64-4980-4d9a-8df9-abfee39b550d','availability',
   'Available for The Swing',
   ((date_trunc('week', current_date)::date + 3) + time '16:00') at time zone 'America/New_York',
   ((date_trunc('week', current_date)::date + 3) + time '21:00') at time zone 'America/New_York',
   'America/New_York', null, '{}', null),

  -- Fri 11:59 PM — a DEADLINE: no ends_at, and the card shows no end time.
  ('99999999-9999-4999-8999-999999999903','2ec75e64-4980-4d9a-8df9-abfee39b550d','deadline',
   'Deadline — Marymount prescreen',
   ((date_trunc('week', current_date)::date + 4) + time '23:59') at time zone 'America/New_York',
   null,'America/New_York', null, '{"submission due"}', null)
on conflict (event_id) do nothing;

-- The standing Swing profile setting that supplies the window's radius.
insert into public.swing_availability (profile_id, is_available, home_location, travel_radius_miles)
values ('2ec75e64-4980-4d9a-8df9-abfee39b550d', true, 'Ridgewood, NJ', 25)
on conflict (profile_id) do update
  set is_available = true, travel_radius_miles = 25;

-- ── 7. Compensation (teaching_engagements + teaching_earnings) ──────────────
-- Pay is a RELATIONSHIP between teacher and studio, never a property of a class.
--
-- Two colleagues exist purely to prove the privacy model is ROLE-scoped, not
-- just ownership-scoped: neither can see a cent of Kathleen's pay.
insert into public.users (user_id, email, account_type, display_name, status) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccc01','frontdesk@bergen-ballet.fixture','employer','Front Desk (fixture)','active'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccc02','otherteacher@bergen-ballet.fixture','talent','Other Teacher (fixture)','active')
on conflict (user_id) do nothing;

insert into public.talent_profiles (profile_id, user_id, display_name, public_slug, primary_role, profile_status)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddd01','cccccccc-cccc-4ccc-8ccc-cccccccccc02',
        'Other Teacher (fixture)','other-teacher-fixture','teacher','draft')
on conflict (profile_id) do nothing;

insert into public.studio_staff (employer_id, user_id, role, talent_profile_id) values
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccc01','front_desk', null),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccc02','teacher','dddddddd-dddd-4ddd-8ddd-dddddddddd01')
on conflict (employer_id, user_id) do nothing;

insert into public.teaching_engagements
  (engagement_id, teacher_profile_id, employer_id, class_id, kind,
   rate_amount_cents, rate_unit, rate_source, effective_from)
values
  -- Ongoing, class-scoped: SHE sets this rate.
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01','2ec75e64-4980-4d9a-8df9-abfee39b550d',
   '22222222-2222-4222-8222-222222222222','55555555-5555-4555-8555-555555555555',
   'ongoing', 6500,'hourly','teacher_set', date '2026-06-01'),

  -- A Swing substitution. The 9900 below is IGNORED: the enforce_platform_rate
  -- trigger overwrites it with the app_config value ($50/hr), because the Swing
  -- rate is a platform constant no client may edit. Substitutions must be
  -- class-scoped (a constraint), since you cover a specific class.
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02','2ec75e64-4980-4d9a-8df9-abfee39b550d',
   '22222222-2222-4222-8222-222222222222','66666666-6666-4666-8666-666666666666',
   'substitution', 9900,'hourly','platform_set', date '2026-06-01')
on conflict (engagement_id) do nothing;

-- A recorded earning for this week's Ballet III: 75 min @ $65/hr = $81.25.
-- The card shows THIS, not the agreed rate — the ledger is the truth about what
-- was earned. Next week's class has no earning, so it falls back to "$65/hr".
insert into public.teaching_earnings
  (earning_id, engagement_id, teacher_profile_id, employer_id, session_id, source_kind,
   work_date, minutes, rate_amount_cents, rate_unit, rate_source, amount_cents, status, paid_at)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
       '2ec75e64-4980-4d9a-8df9-abfee39b550d','22222222-2222-4222-8222-222222222222',
       s.session_id,'ongoing',
       (s.starts_at at time zone 'America/New_York')::date, 75,
       6500,'hourly','teacher_set', round(6500 * 75 / 60.0)::int, 'paid', now()
from public.class_sessions s
where s.class_id = '55555555-5555-4555-8555-555555555555'
order by s.starts_at
limit 1
on conflict do nothing;

commit;

-- ============================================================================
-- TEARDOWN — removes the entire fixture. Cascades handle the children
-- (students, guardianships, classes, sessions, enrollments, communications).
--
--   delete from public.teaching_earnings     where employer_id = '22222222-2222-4222-8222-222222222222';
--   delete from public.teaching_engagements  where employer_id = '22222222-2222-4222-8222-222222222222';
--   delete from public.talent_profiles   where profile_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';
--   delete from public.users             where user_id::text like 'cccccccc-cccc-4ccc-8ccc-cccccccccc0%';
--   delete from public.personal_events   where event_id::text like '99999999-9999-4999-8999-9999999999%';
--   delete from public.affiliations      where employer_id = '22222222-2222-4222-8222-222222222222';
--   delete from public.family_accounts   where family_id   = '33333333-3333-4333-8333-333333333333';
--   delete from public.employer_profiles where employer_id = '22222222-2222-4222-8222-222222222222';
--   delete from public.users             where user_id     = '11111111-1111-4111-8111-111111111111';
-- ============================================================================
