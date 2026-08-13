# Relevé Connect — Professional Profile Implementation Audit

*Read-only audit, 2026-08-11 (Kathleen + Claude). No code was modified, built, or
deployed to produce this. Snapshot of exactly what exists in the professional
profile system at this moment.*

---

## 1. Deployment state

- **Production (`releveconnect.com`) is at commit `5e54115` — "Professional Identity Slice 0."** Everything marked **LIVE** below is committed and deployed.
- **Slice 1 (the editorial authed home) is UNCOMMITTED LOCAL work** in the working tree — **not** live. It must be preserved.
- The `profile_views` table is **applied to the production database** but nothing deployed reads it yet.
- Supabase project: `hmqqxbkhcqspqmsjxodq`.

### Uncommitted working-tree changes (this session)
Modified: `src/app/[handle]/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/profile/page.tsx`.
New (untracked): `src/app/profile/HomeActions.tsx`, `src/app/profile/SwingToggle.tsx`, `src/app/profile/actions.ts`, `src/lib/professional/home.ts`, `src/lib/professional/home.test.ts`, `supabase/migrations/20260810120000_profile_views.sql`, and docs (`SLICE-1-REVIEW-2026-08-10.md`, `LICENSING-APPLICATION-GUARDRAILS.md`).

---

## 2. The four profile surfaces that exist

### A. Public profile — `/<handle>` — LIVE
`src/app/[handle]/page.tsx` (486 lines) + `src/app/[handle]/ConnectActions.tsx` (119).
- Server-rendered via the **service-role admin client** so logged-out visitors can view; the app enforces `profile_status='published' AND visibility='public'` (owner may preview own draft).
- Hero: Featured/Teaching reel + headshot + name + **Verified Member** mark + honorifics + role·location. Below: bio, styles/levels/focus/availability tags, "Teaching at / Touring with," photo gallery, credentials, résumé + ordered social links.
- Owner-only bar + draft-preview banner for the owner; `ConnectActions` (Save / Request intro) for signed-in active members.
- `/talent/<slug>` (`src/app/talent/[slug]/page.tsx`) is a legacy **redirect** here.

### B. Profile editor — `/profile/edit` — LIVE
`src/app/profile/edit/page.tsx` (198) + `ProfileEditor.tsx` (638) + `edit/actions.ts` (313).
- **Gated behind an active Professional membership** (`hasActiveProfileTier`) → else `/subscribe?from=profile`.
- Writes through the cookie-based (RLS) client (own row only); uses the admin client only for storage uploads and handle-uniqueness.
- Fields saved: `display_name`, `public_slug` (reserved-word-checked + uniqued), `primary_role`, `city/state_province/country`, `bio`, `years_experience`, `credentials`, `age_range`, `teaching_reel_url` ("Featured Video"), `teaching_at`, `touring_with`, `gallery_urls` (≤8), `social_links` (website/instagram/facebook/tiktok/vimeo/youtube/linkedin), headshot upload, résumé PDF upload, `profile_status` (draft|published), `visibility` (public). Taxonomy replaced via join tables (styles/levels/focus/certifications/availability).
- On FIRST creation: copies `honorifics` + `choreographer_tier` from the approved application and grants **Verified Member** (`verification_flag=true`, `certified_eligible_at`).
- **Deliberately does NOT write** the Swing tables (`swing_availability/styles/levels`).

### C. Authed home — `/profile`
- **LIVE version = Slice 0 minimal placeholder** (gated: signed in + professional).
- **UNCOMMITTED LOCAL = editorial Slice 1 home**: `page.tsx` (320) + `HomeActions.tsx` (Share) + `SwingToggle.tsx` (live Swing toggle) + `src/lib/professional/home.ts` loader. Mark, hero, "Available for" services, Swing toggle, Profile Activity (views/saves/inquiries), inbox, "Your Work" (Professional Offerings + Your Choreography placeholder).

### D. Intro requests — `/profile/requests` — LIVE
`page.tsx` (118) + `RequestActions.tsx` (58). Talent side of the hiring rail: incoming `connections` (requester name + note), Accept/Decline, no contact exchanged (private by default).

### Persistent nav — LIVE
`src/app/ProfessionalNav.tsx` (65) — server-gated bar (My Profile · Edit Profile · Messages · Notifications), professionals only.

---

## 3. Supporting libraries

- `src/lib/professional/actor.ts` (81) — the adult-only wall (`resolveProfessionalActor`, `classifyActor`); app mirror of SQL `is_professional_actor()`.
- `src/lib/professional/home.ts` (212, **uncommitted**) — Slice 1 home loader + pure helpers (`AVAILABLE_FOR_SERVICES` constant, `isSeniorSpotlightArtist`, `unreadBadge`, etc.).
- `src/lib/profile/reel.ts` — reel embed.
- `src/lib/membership/access.ts` (`hasActiveProfileTier`, `hasAnyActiveMembership`), `founding.ts`, `tiers.ts`.
- `src/lib/connections/messages.ts` + `actions.ts` (`canConnect`, intro-request creation).
- `src/lib/reserved-slugs.ts` — reserved root handles.

---

## 4. Data model that exists

**`talent_profiles`** (~35 cols): `profile_id, user_id, display_name, public_slug, primary_role, city, state_province, country, region_id, age_range, headshot_url, bio, years_experience, credentials, availability, resume_url, social_links(jsonb), video_reels(jsonb), status, profile_status, visibility, verification_flag, certified_eligible_at, choreographer_tier, founder_distinction, created_at, updated_at, search_tsv, stripe_account_id, payouts_enabled, honorifics(array), teaching_reel_url, gallery_urls(jsonb), teaching_at, touring_with`.

**Taxonomy joins:** `profile_styles(style_id)`, `profile_levels(level_id)`, `profile_focus_areas(focus_area_id)`, `profile_certifications(certification_id)`, `profile_availability(availability_tag_id)` → vocab tables `styles`, `levels`, `focus_areas`, `certifications`, `availability_tags` (kind = general|currently), `regions`, `role_types`.

**Other:** `connections` (`connection_id, from_user_id, to_profile_id, type[view|save|message-request], message, status, created_at, updated_at`), `shortlists` (`shortlist_id, employer_id, profile_id, notes, created_at`), `memberships` (`membership_id, user_id, tier, price_cents, term, stripe_customer_id, stripe_subscription_id, membership_status, renewal_date, source`), `applications` (carries `honorifics`, `approved_tier`, `state`, `reviewed_at`), `employer_profiles`, `swing_availability` (`profile_id PK, is_available, home_location, travel_radius_miles, notes`) + `swing_styles/levels`, `profile_views` (`view_id, profile_id, viewer_id nullable, created_at` — new, empty).

**Storage buckets:** `headshots`, `resumes`, `gallery`.

### RLS / helpers (key patterns to reuse)
- `talent_profiles`: `user_id = auth.uid()` for select/insert/update/delete own. Public page reads via **admin client** and enforces published/public in app code (no public-read RLS relied upon there).
- `swing_availability`: all ops gated by `owns_talent_profile(profile_id)`.
- `profile_views`: owner-only select (`exists(... tp.user_id=auth.uid())`); writes via service role.
- SECURITY DEFINER helpers available: `owns_talent_profile(profile_id)`, `is_professional_actor(uuid)`, `both_professional_actors(uuid,uuid)`, `is_studio_admin`, `is_guardian_of`, etc.
- Admin gating: `account_type='admin'` (see `AdminConsoleLink`, `src/app/admin/*`).

---

## 5. Actual data in the database

One real talent profile: **Kathleen McAree** (`/kathleen-mcaree`), `primary_role='teacher'`, **published & public**, **Verified**, `choreographer_tier='emerging'`, `founder_distinction='none'`, has headshot + bio, **no reel**, 0 honorifics, 7 styles, 5 levels, 0 availability tags. Also: 1 `employer_profiles`, 1 `memberships`, 1 `applications` (0 in `approved` state), 1 `swing_availability`, 0 `connections` / `shortlists` / `profile_views`.

---

## 6. What does NOT exist yet

- **No licensing capture at all** — no `works` table, no `available_for_licensing` flag, no "Add a Work," no review queue. (The "Your Choreography → Apply to license" is only a placeholder link in the uncommitted Slice 1.)
- **No messaging** (`/messages` gated placeholder), **no notifications center** (`/notifications` gated placeholder).
- **No Swing UI** beyond the uncommitted toggle, **no The Beat**, **no Senior Spotlight** surface.

## 7. Known issues flagged

- **Senior Spotlight boolean bug (uncommitted Slice 1):** `isSeniorSpotlightArtist` treats `founder_distinction='none'` as truthy → the honor card would wrongly render for Kathleen. Parked feature; note only.
- **"Available for" services are a hardcoded constant** in Slice 1 (`AVAILABLE_FOR_SERVICES`), not per-profile data.
- The uncommitted `SwingToggle` writes `swing_availability` — a table the editor intentionally leaves dormant. Additive, but new write behavior.
