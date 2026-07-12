# ▶️ RESUME HERE — Relevé Connect build
*Updated 2026-07-12. **Step 3 (visual-first profile) AND the first slice of Step 4 (the Roster — search & browse) are complete and committed.** Next: the **Roster hiring-actions slice** (save/shortlist + the lean in-app intro request), then confirm with Kathleen whether Step 5 (Swing) or **The Beat** comes next.*

> **📣 Session note (2026-07-11, Kathleen + Cowork):** The repo is now **backed up to a private GitHub repo — `kathleenkilcoyne/releve-connect-platform`** (branch `main`, all 11 commits pushed). See the **Backup** section below. Tomorrow's agreed to-do list is at the bottom under **🗓️ TOMORROW**.
>
> **📣 Roadmap note (2026-07-12):** After Step 3 (Profiles), the next major pillar is **The Beat** (pay-to-post job/audition marketplace — the College/University partner-package revenue). Full corrected build plan (Supabase Auth, NOT Clerk; reconciled pricing) is in **`docs/The_Beat_Build_Plan_2026-07-12.md`**. Founder decision: The Beat is sequenced **ahead of** Swing/Reviews/Marketplace. Do not build it until Profiles ship.

---

## 📍 EXACT PICK-UP POINT FOR NEXT SESSION

**Step 3 + the Roster search-and-browse slice are DONE and committed.** Two things queue up next:

1. **Finish Step 4 — the Roster hiring actions** (the slice deliberately deferred): **save/shortlist** (the `shortlists` table already exists) + the **lean in-app intro request** (a `connections` row of type `message-request`; talent gets an email seam and can respond; contact details stay private by default — CLAUDE.md Open Decision 2). This is the "connect" half of discovery.
2. **Then a founder decision** — Step 5 (The Swing + two-way reviews) or **The Beat** (the 2026-07-12 roadmap note sequenced it ahead of Swing). **Confirm with Kathleen before starting either.**

**Deferred inside Step 4 (revisit when the data exists):** true **map-pin radius** search (needs geocoding lat/lng + the studio map pins from §7); an **availability** filter (the "Available for Swing" toggle is Step 5); and **studios in the Roster** (studio profiles §7 aren't built — the Roster is talent-only for now). "Featured/priority placement" (Accelerator paid benefit, §8) isn't sold yet, so no promotion slots are shown.

**One forward dependency to know:** the Step-3 profile hero has a slot for **earned proof (completed-Swing count + star rating)** that is deliberately **hidden until that data exists** — it lights up when **Step 5 (The Swing + Reviews)** ships. No placeholder numbers are shown.

---

## ✅ What's DONE and committed (Step 4, slice 1 — the Roster: search & browse)

Built to build spec §8 + §13. Founder decisions confirmed up front: the Roster is **gated to any active membership** (§5 — browsing is a paid benefit); this slice is **search & browse only** (hiring actions are the next slice); **location = region/state now** (true radius later); and **structured cert tags were added now** so the §8 cert filter is real.

- **`/roster`** (`src/app/roster/page.tsx`) — gated by `hasAnyActiveMembership()` (logged-out → `/login?from=roster`; no active membership → `/subscribe?from=roster`). Category **tabs** by role (Teachers / Choreographers / Performers — role is a category, kept OUT of the filter bar per §8). Clean **filter bar**: style · teaching level · certification · region · state · full-text (name+bio). Honorifics show on cards as recognition but are **never filters** (§13). Result cards link to `/[handle]`; paginated (24/page); plain GET form, no client JS.
- **DB migration** `20260712010000_roster_certifications_and_view.sql` (**applied live + mirrored into `schema.sql`**): new `certifications` vocab (7 tags — ABT NTC, RAD, Cecchetti, Vaganova/Balanchine, PBT, Acrobatic Arts, Other) + `profile_certifications` join (own-row RLS) + the **`roster_profiles` view** (published+public only; pre-aggregates style/level/cert slugs as arrays for one-overlap-per-facet; `owner_active` flag so lapsed members drop out of discovery; **SELECT revoked from anon/authenticated** — server-only read).
- **Cert tags wired into the profile editor** — new "Certifications" multi-select (self-reported / searchable, not endorsed, §13); saved via `profile_certifications`.
- **Search-filter logic** is a pure, tested module (`src/lib/roster/filters.ts`): `parseRosterParams` + `profileMatchesFilters` (ANY-within-facet, AND-across-facets, region/state/text, active-owner gate).
- **Tests:** 33 green (`npm test`) — added the Roster filter suite + the `hasAnyActiveMembership` gate.
- **Verified:** ran **10 filter scenarios against the live DB** with seeded profiles (role, style, cert, level, region, state, full-text, AND-across-facets, and the active-membership gate dropping a lapsed owner) — all returned the exact expected sets; then deleted the seed. Logged-out gate → login confirmed. Typecheck + lint clean. *(A real schema mismatch was caught and fixed during this: `regions` uses `label`/`slug`, not `name`.)* The **signed-in Roster UI** couldn't be driven here (needs a real magic-link session), same limitation as the Step-3 editor — but the query is proven correct against live data and the page compiles with no errors.

---

## ✅ What's DONE and committed (Step 3 — the visual-first Professional profile)

Built to build spec §6 + the §17 guardrails. Decisions confirmed with Kathleen: **Verified Member is granted immediately at profile creation once vetting is complete** — i.e. approved (documentation-authenticity check passed) **and** paid; **no waiting period** (founder decision 2026-07-12, supersedes the old §13 ~60-day rule). The public URL is **root `/[handle]`** with a reserved-word guard; and the hero's **earned proof (Swing count + rating) is hidden until real Swing/review data exists**.

- **Gate (§17):** `/profile/edit` is now gated behind an **active Professional / Professional·Full membership**. Helper `hasActiveProfileTier()` in `src/lib/membership/access.ts` (the check that used to live inline in `/subscribe`, now shared + unit-tested). Non-members are sent to `/subscribe?from=profile`.
- **DB migration** `20260712000000_professional_profile_visual.sql` (**applied to live Supabase + in `supabase/migrations/` + mirrored into `schema.sql`**): adds `talent_profiles.honorifics`, `teaching_reel_url`, `gallery_urls`; creates public Storage buckets **`gallery`** + **`resumes`** (mirroring `headshots`).
- **Visual-first profile** (`src/app/[handle]/page.tsx`): above-the-fold hero = autoplay-muted **vertical Teaching Reel** (Vimeo/YouTube → `src/lib/profile/reel.ts`) + headshot + name/roles/location + **Verified Member** mark + **honorifics** (rendered separately, §13). Text credentials, gallery grid, résumé link, and social links live **below** the hero.
- **Native media** in the editor (`ProfileEditor.tsx` + `actions.ts`): existing headshot, new **8-image gallery** (grid, add/remove, capped at 8), **résumé/CV PDF** upload (replace/remove), **Teaching Reel** URL.
- **Approval decision transfer:** on **first** profile creation, `saveProfile` copies `applications.honorifics` + `approved_tier` (→ `choreographer_tier`) onto the profile and, once the applicant is approved (vetting complete) + paid (the gate), **grants Verified Member immediately** (`verification_flag = true`, `certified_eligible_at` = grant time). No waiting period. Honorifics/verification are **server-stamped only, never form-editable**.
- **Shareable public URL** `releveconnect.com/[handle]` at the site root, with a reserved-slug guard (`src/lib/reserved-slugs.ts`); the old `/talent/[slug]` now **redirects** there so existing links keep working.
- **Teaching levels** = the 5 seeded rungs, multi-select; **no age-group filter**.
- **Tests (CLAUDE.md #6):** stood up **vitest** (`npm test`). 17 tests green — the membership gate, the reserved-slug guard, and the reel parser. *(Roster search-filter tests come with Step 4 when that search exists.)*
- **Verified working:** public profile renders at root `/[handle]` (hero + honorifics + Verified mark + gallery + résumé, earned-proof hidden); `/talent/<slug>` redirects; logged-out `/profile/edit` → `/login`. Typecheck + lint clean on all Step-3 files. *(Pre-existing lint errors in `src/app/page.tsx` — 2 `<a>`-vs-`<Link>` — are NOT from this slice; left untouched.)*

---

## ✅ What's DONE and committed (Step 2 — commit `af16a6f`)

The full spine: **Gate → $30 fee → admin review → approve → subscribe → active.**
- **Docs reconciled** to the two ratified `/docs` specs (tier names, Charter cohorts, scope, $30 fee, marketplace earned-ladder, "Verified Member" rename).
- **DB:** `consumer` added to `account_type`; `applications` review columns + `application_fee_payments` table. **Both migrations applied to live Supabase + in `supabase/migrations/`.**
- **`/apply`** — full 13-section role-branched intake (consents + 150-word min).
- **$30 application fee** — one-way Stripe charge; waived for Founding-25; webhook → `in-review` + emails #1/#2.
- **`/admin/applications`** — queue + Approve / Approve-at-tier / Honorifics / Request-info / **Decline (auto-refunds the $30)**.
- **`/subscribe`** — approved-gated, **auto-renewing annual**, **$30 credited** via one-time coupon, **one-click cancel** (billing portal), renewal reminder; webhook activates membership + handles subscription lifecycle.
- **Stripe test Prices** created for all 6 tiers; IDs in `.env.local`.
- Emails wired as **Resend seams** (log until the API key is set); registered in `EMAILS.md`.

---

## 🔧 To make Step 2 fully LIVE-testable (Kathleen's to-dos, not blocking Step 3)

- **Stripe dashboard (test mode):** (a) enable the **Customer Portal** (Settings → Billing) so one-click cancel works; (b) set the **`invoice.upcoming`** lead time to **~14 days** so the renewal reminder lands 2 weeks out.
- **Resend:** set `EMAIL_API_KEY` + `EMAIL_FROM_ADDRESS` + `ADMIN_ALERT_EMAIL` in `.env.local`, then implement the actual sends in `src/lib/notifications.ts` (all TODO seams).
- **Full spine test recipe** (with `stripe listen` running): sign in → `/apply` → submit → $30 checkout (card `4242…`) → `/admin/applications` → Approve → `/subscribe` → activate Professional (the $30 coupon applies) → active.

---

## ⏳ Assets still owed by Kathleen (for the $499 flow + go-live — see also parallel work)
- Real **Signature Work Vimeo URLs**, her **real founder `talent_profile` id** (swap `FOUNDER_PROFILE_ID`), booking-link URLs, **Resend API key**.

## 🧭 Known follow-ups / open TBDs (do not guess — ask)
- **TBD:** the Established marketplace sales threshold; the Legacy/Vanguard co-production splits.
- **Founding-25 invite mechanism** (how `is_founding_25` gets set → fee waived) — not yet built.
- **Auto-save + 14-day resume link** on `/apply` — **required before the intake opens to real applicants** (a long essay form with no save loses people).
- **$499-flow cleanups** (left untouched deliberately): buyers filed as `account_type:'talent'` and free bundle tier `'access'` → should become `'consumer'` / `live_pass` now that those exist.
- `reviewed_by` is null (token admin has no user id); `forfeited` fee state isn't auto-set (needs a later sweep for approved-but-never-subscribed).

## 🗄️ Backup — ✅ DONE (2026-07-11)
- **This repo is now backed up to a private GitHub repo:** `https://github.com/kathleenkilcoyne/releve-connect-platform` (owner: kathleenkilcoyne). The default branch was renamed **`master` → `main`**, `origin` is set, and all 11 commits through `6ab286b` are pushed. Auth is via Git Credential Manager on Windows (browser sign-in).
- **Going forward, saving work is just `git push`** — no more setup. Push after each milestone.
- Note: Brent's original, near-empty repo `kathleenkilcoyne/releve-phase-1` is left untouched for history — the live build lives in **releve-connect-platform**.
- *(One-time snag during first push: an interrupted paste left stale `.git/index.lock` + `.git/config.lock` and a corrupted `.git/config`; repaired by clearing the locks and rewriting a clean config with the `origin` remote. Fully resolved — noted here only so the history is transparent.)*

## 🗓️ TOMORROW — agreed to-do list (2026-07-12)
*Captured with Kathleen at end of 2026-07-11 session. Confirm order at start; ask on anything TBD.*

1. **Decision locked — MailerLite stays.** MailerLite is the **campaign / marketing engine** (newsletters, the College/University advertising pitch, and a dancewear-advertiser campaign — Bloch, Capezio, Sansha, Gaynor Minden, La Duca). **Resend** stays the **transactional** engine inside the platform. Do **not** merge the two.
2. **Wire MailerLite into the platform (turn the dormant seam on).** In `src/lib/notifications.ts` the `addBuyerToClimb()` + `fireMailerLiteTag()` functions are built but no-op until env is set. Add `MAILERLITE_API_KEY` + `MAILERLITE_CLIMB_GROUP_ID` to `.env.local`. **The live "The Climb" group id is `190391571162596878`** (14 subscribers, confirmed 2026-07-11). Then map lifecycle tags (approved / declined / active) → their groups.
3. **Step 3 — visual-first Professional profile** (the documented pick-up point above). Only start after re-reading build spec §6 + §17.
4. **Make Step 2 live-testable** (config, not code): set the Resend `EMAIL_API_KEY` and implement the sends; enable the Stripe Customer Portal + set the `invoice.upcoming` lead time (~14 days).

*Reference for context: MailerLite account `relevewerise@gmail.com`; "The Climb — Issue 01" sent 2026-07-06 to 14, delivered 100%.*

---

*— together we rise · nous nous levons · relevé —*
