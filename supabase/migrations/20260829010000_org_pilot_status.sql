-- Structured, admin-auditable "complimentary pilot" status for an organization
-- (Studio or Dance Team) — e.g. Manhattan College Dance Team's Founding pilot.
--
-- Previously this kind of arrangement existed only as an email someone sent —
-- nothing in the database recorded it, so it couldn't be relied on by any
-- screen, report, or future billing decision. This is intentionally a status
-- flag + an audit trail, NOT a pricing/permanence rule: it does not gate any
-- payment screen (orgs have none yet), and it does not promise the org will
-- never become a paying account. Pricing for Studios/Teams is a separate,
-- not-yet-ratified decision (see RESUME-HERE.md).

alter table public.employer_profiles
  add column if not exists pilot_status text,
  add column if not exists pilot_granted_by uuid references public.users(user_id),
  add column if not exists pilot_granted_at timestamptz,
  add column if not exists pilot_note text;

alter table public.employer_profiles
  drop constraint if exists employer_profiles_pilot_status_check;
alter table public.employer_profiles
  add constraint employer_profiles_pilot_status_check
  check (pilot_status is null or pilot_status = 'complimentary');

comment on column public.employer_profiles.pilot_status is
  'Null, or ''complimentary'' when an admin has granted this org a complimentary pilot. Not a pricing rule — just a recorded status.';
comment on column public.employer_profiles.pilot_granted_by is
  'Admin user who granted the pilot status (audit trail, mirrors founding_professional_grants.granted_by).';
comment on column public.employer_profiles.pilot_granted_at is
  'When the pilot status was granted.';
comment on column public.employer_profiles.pilot_note is
  'Free-text admin note on the pilot grant (e.g. reason, cohort). Never shown publicly.';
