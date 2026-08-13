# Claude Code Handoff — Add Licensing as a Capability of the Professional Profile

*Prepared 2026-08-11 (Kathleen + Claude, Cowork). Companion to
`docs/PROFILE-AUDIT-2026-08-11.md`. This is the single source of truth for the
licensing build. Read the audit first, then this. Do not rediscover the codebase —
the routes, files, and schema you need are listed below.*

---

## 0. Non-negotiable ground rules (read before touching anything)

1. **Production is currently Slice 0** (commit `5e54115`). Do not assume the
   editorial home is live — it is not.
2. **Slice 1 is UNCOMMITTED LOCAL work and MUST BE PRESERVED.** Do not discard,
   revert, or overwrite the working-tree changes listed in the audit §1
   (`src/app/profile/page.tsx`, `HomeActions.tsx`, `SwingToggle.tsx`,
   `actions.ts`, `src/lib/professional/home.ts` + test, `globals.css`,
   `layout.tsx`, `src/app/[handle]/page.tsx`, `supabase/migrations/20260810120000_profile_views.sql`).
   Build licensing **on top of** this, additively.
3. **REUSE, do not rebuild, the existing LIVE public Professional Profile and
   Profile Editor.** `src/app/[handle]/page.tsx` and `src/app/profile/edit/*`
   are proven and live. Extend them; do not replace them.
4. **Licensing does NOT currently exist.** You are adding it net-new.
5. **Transactions remain "Coming Soon."** No checkout, no Stripe, no
   commission/split, no payment processing, no payout logic in this task.
6. **No Senior Spotlight build.** **Do not build The Beat or messaging.**
7. **Preserve** the current public profile, editor, `/profile/requests` system,
   all existing data, and all existing RLS/permissions. Purely additive
   migrations only; no destructive changes.
8. **Scope discipline:** note the known bugs (below) but do NOT expand scope to
   "fix" them unless touching that code is required to make the new build safe.

---

## 1. What we are building

**Licensing is a capability of the Professional Profile.** Every vetted Relevé
professional can toggle **Available for Licensing · ON / OFF**. When ON, the
artist manages **Works Available to License**.

### Rules
- **"Add a Work" creates a work record — it does NOT instantly publish.**
- **Work statuses:** `Draft · Submitted · In Review · Returned for Changes ·
  Approved · Declined`.
- **Only Approved work appears publicly.**
- **Relevé Admin gets a lightweight review queue** to move works through states.
- Two gates (per established direction): the person is already vetted (Roster
  membership), and each work passes a lightweight admin review before going
  public. This is NOT open self-publish, and NOT heavy per-piece curation.

### Explicitly OUT of scope for this task
Checkout / Stripe / payments / splits / payouts; Senior Spotlight; The Beat;
messaging; the configurable rights/exclusivity engine. Licensing is capture +
review + public display only.

---

## 2. Established licensing direction (context, not build)

From `LICENSING-APPLICATION-GUARDRAILS.md` — for framing only:
- "Every vetted Relevé professional CAN license work. Not every work becomes a
  Relevé-curated work. The marketplace decides what sells."
- Rights, not videos: Relevé licenses the choreography; music is the licensee's
  responsibility. Original & owned; child-safety on anything involving minors.
- Splits and Senior Spotlight are **deferred decisions** — do not encode any
  split, tier, or Senior Spotlight logic now. A future `signature_selection`
  concept exists in strategy but is **not** part of this build.

---

## 3. The codebase you are extending (from the audit — do not rediscover)

### Routes / files
- Public profile (LIVE, REUSE): `src/app/[handle]/page.tsx` (486) — renders via
  the **admin client**, enforces `profile_status='published' AND visibility='public'`.
  Add an "available to license" section here that lists **Approved** works only.
- Profile editor (LIVE, REUSE): `src/app/profile/edit/{page.tsx,ProfileEditor.tsx,actions.ts}`
  — gated by `hasActiveProfileTier`. This is where profile fields are saved.
- Authed home (Slice 1, UNCOMMITTED — extend): `src/app/profile/page.tsx` +
  `src/app/profile/{HomeActions,SwingToggle}.tsx` + `src/app/profile/actions.ts`.
  The **Swing toggle + its server action are the exact pattern to mirror** for the
  Available-for-Licensing toggle.
- Home loader (UNCOMMITTED — extend): `src/lib/professional/home.ts`.
- Actor wall (REUSE): `src/lib/professional/actor.ts` (`resolveProfessionalActor`).
- Admin console precedent (REUSE PATTERN): `src/app/admin/*` (e.g.
  `admin/applications`, `admin/signature-works`), gated by `account_type='admin'`,
  reads via admin client. Build the review queue here, same pattern.
- Membership gate (REUSE): `src/lib/membership/access.ts` (`hasActiveProfileTier`).

### Schema that exists (see audit §4 for full columns)
`talent_profiles` (~35 cols) · taxonomy joins (`profile_styles/levels/focus_areas/certifications/availability`) · `connections` · `shortlists` · `memberships` · `applications` · `swing_availability` · `profile_views` (new). Storage buckets: `headshots`, `resumes`, `gallery`.

### RLS / helpers to reuse
- Owner scope on profile-owned tables: SECURITY DEFINER `owns_talent_profile(profile_id)`
  (used by `swing_availability`) — **use this for `works`.**
- `talent_profiles` owner writes: `user_id = auth.uid()` (used by the editor and
  the Available-for-Licensing flag).
- Public read pattern: the public page reads via the **service-role admin client**
  and filters in app code; you may ALSO add a public-read RLS policy on `works`
  for defense in depth.
- Admin: service-role admin client bypasses RLS (no admin policy needed), same as
  existing admin pages.

### Deploy pattern (when Kathleen green-lights — not part of this task)
Apply the Supabase migration first (Supabase project `hmqqxbkhcqspqmsjxodq`),
verify, then push `main` → Vercel. Verify locally with `npx tsc --noEmit` and
`npm test` (vitest).

---

## 4. Target schema (additive migration — propose, do not destroy)

```sql
-- Available-for-Licensing flag on the profile (mirrors how the editor writes talent_profiles).
alter table public.talent_profiles
  add column if not exists available_for_licensing boolean not null default false;

-- Works available to license.
create table if not exists public.works (
  work_id           uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.talent_profiles(profile_id) on delete cascade,
  title             text not null,
  work_type         text,   -- solo | duet_trio | group | competition | concert | musical_theatre | educational | other
  style             text,
  cast_size         text,
  duration          text,   -- approximate, e.g. "1:45"
  level_audience    text,
  year_created      int,
  description       text,
  preview_video_url text,
  origin            text,   -- repertory | new
  license_type      text,   -- freeform note this phase (rights engine is parked)
  status            text not null default 'draft'
                     check (status in ('draft','submitted','in_review','returned','approved','declined')),
  review_notes      text,   -- admin note on "returned"/"declined"
  submitted_at      timestamptz,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists works_profile_idx on public.works (profile_id, status);

alter table public.works enable row level security;

-- Artist manages only their own works (mirror swing_availability's owner scope).
drop policy if exists works_owner_all on public.works;
create policy works_owner_all on public.works
  for all to authenticated
  using (public.owns_talent_profile(profile_id))
  with check (public.owns_talent_profile(profile_id));

-- Public may read ONLY approved works on published/public profiles.
drop policy if exists works_public_read on public.works;
create policy works_public_read on public.works
  for select to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.talent_profiles tp
      where tp.profile_id = works.profile_id
        and tp.profile_status = 'published'
        and tp.visibility = 'public'
        and tp.available_for_licensing = true
    )
  );
-- Admin review queue reads via the service-role admin client (no policy needed).
```

### Status transitions (enforce in server actions)
- **Artist:** `Add a Work` → `draft`. Artist may edit while `draft` or `returned`.
  "Submit for review" → `submitted` (set `submitted_at`). Artist may withdraw
  `submitted` → `draft`.
- **Admin:** `submitted` → `in_review` → `approved` | `returned` | `declined`
  (set `reviewed_at`, optional `review_notes`). `returned` lets the artist edit
  and resubmit.
- **Public:** only `approved` renders.

---

## 5. UI to build (additive, reuse existing design language)

1. **Available for Licensing toggle** on `/profile` — mirror `SwingToggle.tsx` +
   `actions.ts` exactly (owner-scoped server action writing
   `talent_profiles.available_for_licensing`). Place it near the top with the
   Swing toggle (both are live availability states).
2. **Works Available to License** section on `/profile` (shown when the toggle is
   ON): list the artist's works with status chips; **+ Add a Work** form
   capturing the fields in §4; "Submit for review" action per work; edit while
   draft/returned.
3. **Public display** on `/<handle>`: an "Available to License" section listing
   **Approved** works only (title, type, style, preview video, terms note). Reuse
   the existing page's styling; do not restructure the rest of the page.
4. **Admin review queue** under `src/app/admin/` (e.g. `admin/licensing`): list
   `submitted`/`in_review` works; approve / return (with note) / decline. Follow
   `admin/applications` patterns and the `account_type='admin'` gate.

Reuse the Relevé palette tokens in `globals.css` and the Fraunces serif already
wired in `layout.tsx`. Do not introduce a new design system.

---

## 6. Known issues — note, do not expand scope

- **Senior Spotlight boolean bug (uncommitted Slice 1):** `isSeniorSpotlightArtist`
  in `src/lib/professional/home.ts` treats `founder_distinction='none'` as truthy,
  so the parked Senior Spotlight card would wrongly render. **Do not build Senior
  Spotlight.** Only touch this if your licensing work renders that card path; if
  so, the minimal safe fix is to treat `'none'` as false. Otherwise leave it.
- **"Available for" services are hardcoded** (`AVAILABLE_FOR_SERVICES` constant in
  `home.ts`) — NOT per-profile data. **Do not redesign that system** unless the
  licensing placement genuinely requires it. Licensing is a separate concept
  (a live ON/OFF capability + works), not part of the services list.

---

## 7. Verification & preservation checklist

- [ ] Working-tree Slice 1 changes still intact (nothing reverted).
- [ ] Migration is additive only; existing tables/policies unchanged.
- [ ] `npx tsc --noEmit` clean; `npm test` (vitest) green; add tests for the
      status-transition logic and any pure helpers.
- [ ] Existing public profile, editor, and `/profile/requests` behave exactly as
      before (no regressions).
- [ ] Only `approved` works are ever publicly visible.
- [ ] Do NOT deploy. Hand back for review.

---

## CLAUDE CODE-IMPLEMENTATION INSTRUCTION

Work in the existing `kathleenkilcoyne/releve-platform` repo on `main`, **additively**, and **do not deploy**. In order:

1. **Preserve first.** Confirm the uncommitted Slice 1 working-tree changes (audit §1) are present and untouched before you begin. If they are missing, STOP and report — do not proceed.
2. **Migration (propose for review, do not apply blind):** create `supabase/migrations/<timestamp>_works_and_licensing.sql` with the §4 schema exactly — additive only (the `available_for_licensing` column + the `works` table + the two RLS policies using `owns_talent_profile`). No changes to any existing table, column, or policy.
3. **Available-for-Licensing toggle:** mirror `src/app/profile/SwingToggle.tsx` and `src/app/profile/actions.ts` to add an owner-scoped server action that writes `talent_profiles.available_for_licensing`, and render the toggle on `/profile` beside the Swing toggle.
4. **Artist works management on `/profile`:** the "Works Available to License" list (shown when the toggle is ON) + an "Add a Work" form (fields per §4) that creates a `draft` record — **never auto-publishes** — plus a per-work "Submit for review" action and edit-while-draft/returned. Enforce the §4 status transitions in server actions.
5. **Public display on `/<handle>`:** add an "Available to License" section that lists **Approved works only**, reusing the existing page's styling. Do not restructure anything else on that page.
6. **Admin review queue** under `src/app/admin/licensing/` following the `admin/applications` pattern and the `account_type='admin'` gate: approve / return-with-notes / decline for `submitted`/`in_review` works.
7. **Reuse, don't rebuild:** the public profile, the editor, `/profile/requests`, the design tokens, and all existing RLS/permissions stay as they are.
8. **Scope guard:** do not build checkout, Stripe, splits, Senior Spotlight, The Beat, or messaging. Note — do not fix — the known bugs in §6 unless your changes make touching them necessary for safety.
9. **Verify:** `npx tsc --noEmit` clean, `npm test` green (add tests for status transitions), no regressions to existing surfaces, only `approved` works public.
10. **Do NOT deploy.** Summarize what changed (migration, files, routes, tests) and the manual walkthrough, and hand back for Kathleen's review.
