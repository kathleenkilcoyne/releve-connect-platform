# Slice 1 — "My Professional Home" · Review (2026-08-10)

*Built in Cowork with Kathleen. Status: **built + type-checked + unit-tested. NOT deployed** — waiting on your review before we push to production.*

## What it does
Turns `/profile` from the Slice 0 placeholder into the real signed-in home:
- **Welcome back, {first name}.**
- **Your professional profile** — ✓ *Relevé Verified Professional* badge (only when `verification_flag` is true) · **View my public profile** · **Edit profile** · **Share profile** (native share sheet on mobile, copy-link on desktop).
- **Messages · Notifications** — links with an unread badge that only appears when count > 0 (no dead "0"). Counts are 0 until Slice 2/3 wire them.
- **Profile Activity** — three honest numbers, or a warm empty state:
  - **Profile views** → new `profile_views` counter
  - **Saved by studios** → `shortlists`
  - **Inquiries** → `connections` of type `message-request`
- **Your Relevé** — entry cards for Senior Spotlight · Professional Opportunities · The Beat · Swing *(shown only when `swing_availability.is_available`)* · Your Offerings. "Coming soon" today; we wire each to its surface as it ships.

## The one new database object
`profile_views` (migration `20260810120000_profile_views.sql`) — `view_id, profile_id, viewer_id (nullable), created_at`. RLS on; **owner-only read**; writes are service-role only. **Already applied to the production Supabase project** (additive, unused by live code until this frontend deploys). Views are logged server-side on the public profile page — **live profiles only, never the owner's own views**, anonymous views counted without exposing identity (identity-level "who viewed you" stays a later paid feature).

## Design language (the visual is a feature) — approved with Kathleen
A creative professional's **personal home inside Relevé**, not a SaaS dashboard. Sets the language Messages and Notifications will inherit.
- **Palette as tokens** in `globals.css`: deep warm near-black `--rc-ink`, charcoal `--rc-char` (the theatrical "Your Work" card), warm creams, and gold **only as an accent** (`--rc-gold` / `--rc-gold-deep`) — the verified line, fine rules, tag separators, section ticks, the mark, the wordmark. No gold fills, no gradients.
- **Editorial serif** (Fraunces, self-hosted) for the name, numbers, and feature titles; Geist for UI. Applied selectively, so forms and the pilot are untouched.
- **The profile is the centerpiece:** the Relevé gold **mark** crests the page; a large portrait with a fine gold halo; the name in large serif; verified mark; role · location; honorifics; and the public-profile actions given real weight (solid View / outline Edit / ghost Share).
- **Information architecture (your notes):**
  - **Available for** — public-facing services summary, a refined wrapping line under the identity (no overflow; long names like "Competition Choreography" stay intact).
  - **Swing availability** — a **live On/Off toggle** ("available for sub calls"), distinct from the fixed services.
  - **Your Work** — the charcoal marquee hub: **Professional Offerings** ("Manage the services you offer") + **Your Choreography** ("License your original works").
  - **Senior Spotlight** — a separate, **conditional** gold-bordered honor card, shown **only** to hand-selected artists (the curated annual catalog).

## Files
- `supabase/migrations/20260810120000_profile_views.sql` — profile-views table + RLS
- `src/app/globals.css` — refined Relevé brand tokens + `--font-serif`
- `src/app/layout.tsx` — load the Fraunces display serif
- `src/lib/professional/home.ts` — data loader + pure helpers + `AVAILABLE_FOR_SERVICES` + `isSeniorSpotlightArtist`
- `src/lib/professional/home.test.ts` — unit tests (23 assertions)
- `src/app/profile/page.tsx` — the home (rebuilt to the approved editorial design)
- `src/app/profile/HomeActions.tsx` — client Share button
- `src/app/profile/SwingToggle.tsx` — **live** Swing toggle (client)
- `src/app/profile/actions.ts` — `setSwingAvailability` server action (owner-scoped write)
- `src/app/[handle]/page.tsx` — fire-and-forget view logging
- `public/releve-mark.png` — the gold mark (already in the repo)

## What's wired vs placeholder (this slice)
- **Wired to real data:** greeting, portrait/name/verified/role/location/honorifics, profile views + saves + inquiries, Messages/Notifications links, and the **Swing toggle** (persists to `swing_availability` via owner-scoped RLS).
- **Visual placeholders (IA only, as agreed):** the "Available for" services render from a canonical constant (per-profile selection comes with the future Professional Offerings flow); "Your Work" rows (Professional Offerings, Your Choreography) show the affordance but don't navigate yet; the Senior Spotlight card is gated on an existing founder distinction as a proxy until explicit catalog membership exists.

## Verification done
- **`tsc --noEmit`: clean.**
- **Unit tests: 23/23 pass** (view-count rule, activity empty/real, unread badge, greeting, location, role, Senior Spotlight gate, services vocabulary).
- `next build` and `vitest` can't run in the Cowork Linux sandbox (repo `node_modules` has Windows-only native binaries; no registry access). Run `npm test` / `npm run build` locally, or let Vercel's Linux build validate on deploy.

## Manual walkthrough (before deploy)
1. `npm run dev`; sign in as a **professional** (an account with a talent profile).
2. Land on `/profile` → mark, greeting, portrait/name, verified, Available for, actions, Swing toggle, activity, inbox, Your Work, (Senior Spotlight if you carry a founder distinction).
3. Flip **Swing availability** → it persists (reload; state holds). Owner-only by RLS.
4. In a **logged-out** browser open your public profile, reload twice → **Profile views** rises; viewing your **own** profile does not.
5. A non-professional hitting `/profile` still redirects to `/` (Slice 0 gate unchanged).

## Deploy when you approve (your usual pattern)
Migration already applied ✓ → commit these files → push `main` → Vercel auto-deploys → confirm ● Ready + aliased to releveconnect.com → smoke-test `/profile`.

## Small calls I made (flag if you'd change them)
- **Inquiries = `message-request` connections only** so the number means "someone reached out."
- **Available for** shows the full canonical service set for now (no per-profile picker yet) — establishes the IA visually.
- **Senior Spotlight** gate is a placeholder proxy (`founder_distinction` present) until a real catalog-membership flag exists.

## Next: Slice 2 — Threaded Messages
Builds directly on the Slice 0 wall (`both_professional_actors`). One decision still open from last night: **sending a message requires sign-in** (no anonymous DMs) — default is keep.
