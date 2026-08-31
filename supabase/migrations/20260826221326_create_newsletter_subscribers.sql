-- Reconstructed from the live production schema (introspected 2026-08-30) to
-- bring local migration history to parity with what is already applied in
-- production. This file must NOT be re-run against production — the table,
-- indexes, trigger, and policy already exist there with this exact
-- version timestamp recorded in Supabase's migration ledger. It exists so
-- local tooling (supabase db diff / db push) stops seeing this table as
-- missing.
--
-- newsletter_subscribers is the source of truth for The Climb's audience.
-- MailerLite is a downstream delivery/sync channel, never the other way —
-- see the table comment below and src/lib/climb/subscribe.ts.

create table public.newsletter_subscribers (
  subscriber_id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  status text not null default 'active'
    check (status = any (array['active', 'unsubscribed', 'bounced', 'pending'])),
  consent_source text not null default 'site_form'
    check (consent_source = any (array['site_form', 'manual', 'outreach', 'platform_account', 'import'])),
  consent_at timestamptz not null default now(),
  consent_ip text,
  user_id uuid references auth.users(id) on delete set null,
  mailerlite_subscriber_id text,
  mailerlite_synced_at timestamptz,
  unsubscribed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index newsletter_subscribers_email_key
  on public.newsletter_subscribers using btree (lower(email));

create index newsletter_subscribers_status_idx
  on public.newsletter_subscribers using btree (status);

-- Rows here are pending MailerLite reconciliation. Nothing sweeps this index
-- yet (see subscribe.ts) — it exists so a future resync job has a cheap
-- query to run against.
create index newsletter_subscribers_unsynced_idx
  on public.newsletter_subscribers using btree (mailerlite_synced_at)
  where (mailerlite_synced_at is null);

create function public.touch_newsletter_subscribers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger newsletter_subscribers_touch
  before update on public.newsletter_subscribers
  for each row execute function public.touch_newsletter_subscribers();

alter table public.newsletter_subscribers enable row level security;

-- No INSERT/UPDATE policy exists anywhere: writes only ever happen through
-- the service-role client on the server (see createAdminClient() in
-- src/lib/supabase/admin.ts), by design.
create policy newsletter_subscribers_select_own
  on public.newsletter_subscribers
  for select
  to authenticated
  using (user_id = (select auth.uid()));

comment on table public.newsletter_subscribers is
  'Source of truth for The Climb newsletter audience. MailerLite is a delivery channel synced FROM this table, never the other way. Writes happen server-side via service role; RLS denies all client access except a user reading their own row.';
