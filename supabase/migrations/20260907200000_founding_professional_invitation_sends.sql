-- Founding Professional invitation send log — append-only audit of every
-- attempt to email an invitation, mirroring the existing profile_trust_events
-- pattern ("explains how a state came to be; never read to decide anything").
--
-- Purely additive: no existing table is altered. founding_professional_grants
-- remains the single source of truth for grant/claim state; this table only
-- answers "was an email attempted, when, to whom, and what happened" — a fact
-- that previously lived nowhere but an admin's own personal email client.
--
-- Service-role only. No client (including the granting admin's own browser
-- session) reads or writes this table directly — all access goes through the
-- gated /api/admin/founding-professionals routes.

create table if not exists founding_professional_invitation_sends (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references founding_professional_grants(id),
  sent_by uuid, -- acting admin's user_id, null if unavailable
  sent_at timestamptz not null default now(),
  -- Denormalized on purpose: keeps this row historically accurate even if the
  -- grant's own email is ever corrected later (mirrors why studio invite
  -- resends don't rewrite prior history).
  recipient_email text not null,
  -- Mirrors SendResult from src/lib/email/send.ts exactly — no translation layer.
  status text not null check (status in ('sent', 'failed', 'not_configured')),
  provider_message_id text, -- Resend id, null unless status = 'sent'
  error_detail text, -- populated for 'failed'; null otherwise
  created_at timestamptz not null default now()
);

comment on table founding_professional_invitation_sends is
  'Append-only audit of every attempted Founding Professional invitation email. Service-role only. Never read to decide grant/claim state — founding_professional_grants remains authoritative for that.';

create index if not exists founding_professional_invitation_sends_grant_id_idx
  on founding_professional_invitation_sends (grant_id, sent_at desc);

alter table founding_professional_invitation_sends enable row level security;

-- No policies are created: RLS enabled with zero policies denies ALL client
-- access by default (anon and authenticated alike). Only the service-role
-- key (used exclusively by the admin API routes) can read or write this
-- table — identical posture to profile_trust_events.
