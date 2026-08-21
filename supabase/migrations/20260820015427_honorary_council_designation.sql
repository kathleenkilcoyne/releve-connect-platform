-- Honorary Council — a second, INDEPENDENT admin-controlled designation.
--
-- founder_distinction (enum: none|founding_25|first_50|founding_professional) is a
-- SINGLE-value column — it cannot represent "this person is both Founding 25 AND
-- Honorary Council" at once. Rather than overload that enum (which would make the
-- two mutually exclusive, contradicting the founder's explicit requirement that a
-- person may carry both), this is a separate, additive boolean column.
--
-- Mirrors founder_distinction's existing pattern: profile-owner-writable NEVER —
-- only an admin (service-role) may set it. No RLS change needed here since writes
-- to talent_profiles already go through the admin client for founder-controlled
-- fields; ordinary member saves (saveProfile) must never reference this column.
alter table public.talent_profiles
  add column if not exists honorary_council boolean not null default false;

comment on column public.talent_profiles.honorary_council is
  'Admin-only designation, independent of founder_distinction. A profile may carry both founding_25 and honorary_council.';
