# ▶️ RESUME HERE — Relevé Connect build

> ## ▶️ START HERE — good morning, 2026-07-14
>
> **Everything through 2026-07-13 is built, verified on the live database, committed, and pushed to GitHub** (latest commit `2512e61`). Nothing is broken and nothing is half-finished — it's a clean place to pick up.
>
> **Where things stand, in plain terms:**
> - **The Swing** has its *teacher* side (opt-in availability) and *real studio accounts* (§7 studio profiles).
> - **The Beat** now has its **entire hiring-side database** — the job categories, the postings, partner packages, the payments ledger, and the security rules. This is the *plumbing*; there are **no screens and no payment flow yet**.
>
> **Pick ONE brick to lay next** (any is a fine starting point):
> 1. **The Beat — Stripe checkout** *(the money step)*: let someone pay to post a job ($49, or $29 for members) and let college/university partners buy their annual packages, reusing the Stripe setup you already have for memberships. → turns the Beat schema into **revenue**.
> 2. **The Beat — post & browse screens** *(the visible step)*: the actual pages to create a job posting and to browse/filter the board. → turns the schema into **something you can see and click**.
> 3. **The Swing — dispatch loop**: a studio posts an open sub slot → matched teachers are notified → the studio picks who covers it. → **connects teachers and studios** for real.
>
> **Still parked for your decision (no rush):** §D — do the *self-marketing / service* lanes (coaching, photography, creative & production services, accompanists) live **inside The Beat** or in a **separate vetted directory**? Nothing on that side gets built until you decide. Details are in `docs/The_Beat_Build_Plan_2026-07-12.md` (see "Additions — 2026-07-13", section D).
>
> **To reopen the project:** open the folder `C:\Users\kathl\releve-platform`. The full running detail is everything below this box.

*Updated 2026-07-13. **Steps 3 and 4 are complete. Step 5 (The Swing): Slice A (teacher "Available for Swing") AND real studio accounts + the light §7 studio profile are DONE and committed.** Studios now sign up via **light onboarding** — no $30 fee, no approval queue (founder decision 2026-07-13; they are the buyer side, not vetted talent). **Next up: the dispatch loop (Slice B)** — studio posts a slot → match → notify → teacher claims → studio picks → locks → auto-completes → unlocks reviews (Slice C). **Do NOT use the admin-posts stopgap** (violates the §17 no-founder-middleman guardrail). Map pins are stored-address-now / geocode-later (founder decision 2026-07-13). **The Beat — hiring-side schema is now built + verified live (2026-07-13):** admin-managed two-level taxonomy, postings (multi-subcategory, 30-day expiry, portfolio media), partner packages, a transactions ledger, and RLS. Self-marketing/service lanes stay gated behind §D.*

> **📣 Session note (2026-07-11, Kathleen + Cowork):** The repo is now **backed up to a private GitHub repo — `kathleenkilcoyne/releve-connect-platform`** (branch `main`, all 11 commits pushed). See the **Backup** section below. Tomorrow's agreed to-do list is at the bottom under **🗓️ TOMORROW**.
>
> **📣 Roadmap note (2026-07-12):** After Step 3 (Profiles), the next major pillar is **The Beat** (pay-to-post job/audition marketplace — the College/University partner-package revenue). Full corrected build plan (Supabase Auth, NOT Clerk; reconciled pricing) is in **`docs/The_Beat_Build_Plan_2026-07-12.md`**. Founder decision: The Beat is sequenced **ahead of** Swing/Reviews/Marketplace. Do not build it until Profiles ship.

> **📣 Session note (2026-07-13, Kathleen + Cowork):** Built the **studio side of The Swing** — real `employer` accounts + the light §7 studio profile (see the new DONE section). Studio sign-up is **light onboarding** (no fee, no approval). Map pins: store the address now, geocode later. **Kathleen's plan from here:** finish The Swing, then **organize The Beat** so every filter/section of the Audition Page carries **jobs** too (the College/University revenue piece).

---

## 📍 EXACT PICK-UP POINT FOR NEXT SESSION

**Two live tracks after 2026-07-13:**

- **The Beat** — the hiring-side schema shipped + verified live (see the DONE section below). **Next Beat step:** the Stripe checkout — per-post ($49 / $29 member) + partner-package purchase + studio-included debit — reusing the existing membership webhook pattern; member-vs-non-member price is a lookup against `memberships.tier` (Professional `professional` / Creator `professional_full`). Then the post/browse UI. **Still gated — do NOT build:** the self-marketing / service lanes (§D — inside The Beat vs a separate vetted directory) and their trust model (§E.5).
- **The Swing** — the dispatch loop (Slice B, below) is still the other open pillar.

**Step 5 Slice A (teacher availability) AND real studio accounts + the light §7 studio profile are DONE (see the two DONE sections below).** Next up: **the dispatch loop (Slice B)** — the studio side of The Swing that finally connects teachers ↔ studios. Re-read spec §10–§11 + the §17 guardrails first; ask on anything TBD.

**Concretely, the next slice — the dispatch loop (§10, Slice B):**
- A studio **posts an open sub slot directly** — date, time, location, style, level needed, pay, optional required cert. (New table, e.g. `swing_slots`, owned by the employer; studios now exist to own it.)
- System **matches** only teachers who (a) have Swing on, (b) match style + level + geography, (c) hold the required cert if specified. *(Geography stays coarse — city/state — until the studio map pins are geocoded; the `lat`/`lng` columns already exist, empty.)*
- Matched teachers **notified** (in-app + email seam now; SMS later) → teacher **taps to claim** → **studio picks from responders** (not first-come, §17) → slot **locks** → after the date, **auto-completes** → unlocks the two-way review (Slice C).

### The remaining Step-5 slice (after the dispatch loop)
- **Slice C — The trust engine:** two-way, **double-blind, 7-day-reveal** reviews unlocked on completion, rolled into the profile star rating (lights up the hero's earned-proof slot + the Roster availability filter). *Reminder:* the existing `reviews` table hangs off `connection_id`; a completed Swing gig isn't a connection, so reviews get reworked to hang off a completed swing claim (migration needed).

### Sub-decisions already framed (revisit when building)
- **Levels = the 5 ratified rungs.**
- **Swing $20/use billing** (studio-paid; 3 at Connect / included at Growth / unlimited at Accelerator): *recommend defer* — build the matching + review loop first, wire billing as a later slice.
- **Dispatch alerts:** *in-app + email seam now, SMS later* (no SMS provider set up; sub calls are time-sensitive so SMS matters eventually).

*(Alternative pillar still on the table if Kathleen redirects: **The Beat**, per the 2026-07-12 roadmap note — plan in `docs/The_Beat_Build_Plan_2026-07-12.md`. Kathleen's 2026-07-13 intent: finish the studio side of The Swing, then **organize The Beat** so all Audition-Page filters/sections carry **jobs** too — the College/University revenue piece.)*

**Still deferred (revisit when the data exists):** true **map-pin radius** search (the `lat`/`lng` columns exist but are empty — needs a geocoding provider wired); the **availability** filter in the Roster; **studios in the Roster** (studio profiles now exist — the Roster query can be extended to include them next); the **messaging rail** beyond the lean intro request.

**One forward dependency to know:** the Step-3 profile hero's **earned-proof slot** (completed-Swing count + star rating) stays hidden until Slice B + C ship real data.

---

## ✅ What's DONE and committed (The Beat — hiring-side schema, 2026-07-13)

The Beat's HIRING motion — "post a role, someone applies" (build spec §9; plan + Additions in `docs/The_Beat_Build_Plan_2026-07-12.md`). **Schema + RLS only — no UI, no Stripe flow** (Stripe columns are placeholder/null; pricing resolves at checkout later against `memberships`). The **self-marketing / service motion** (coaching, photography, creative & production services, accompanists) is **gated behind §D** and deliberately NOT built — the gated service families are not even seeded.

- **DB migration** `20260713120000_beat_hiring_schema.sql` (**applied live + mirrored into `schema.sql` §15**): two-level **admin-managed taxonomy** `beat_categories` → `beat_subcategories`; a small **stable** `beat_engagement_type` enum (audition / employment / freelance_gig / other) — the §B "opportunity_type split", with subject-matter in the taxonomy; **`beat_postings`** (`expires_at` default **+30 days**, `portfolio_links` jsonb media, `posting_type`, `status`); **`beat_posting_subcategories`** (a post carries **multiple** subcategories, §E.6); **`beat_partner_packages`** (annual credit bundles; `credits_remaining` generated); **`beat_transactions`** ledger (amounts in cents; Stripe ids null). `owns_beat_posting()` helper.
- **Seeded HIRING families only** (4 categories / 23 subcategories): Teaching & Classes, Choreography, Auditions & Company (Film/TV · Cruise · Theme Park live here as **subcategories** — setting deferred, §E.1), Studio Admin & Support. The gated **service** families are intentionally NOT seeded.
- **RLS:** active postings **world-readable** (job seekers browse); a poster manages only their **own** rows incl. drafts; partner packages + transactions **private**; taxonomy public-read.
- **Naming** (deviates from the plan's Clerk-era `employer_id`, aligned to repo conventions): `poster_user_id` / `holder_user_id` / `payer_user_id` → `users(user_id)` — neutral because a poster may be a studio **or** an individual.
- **Verified against the live DB:** full round-trip (posting + 2 subcategories + partner package + transaction); **RLS proven by simulating roles** — anon sees only the active posting (not the draft), the poster sees both, a different user sees only the active; generated `credits_remaining` = 35 (40−5); `expires_at` = 30 days; `portfolio_links` is a json array; enum/check constraints reject bad engagement/status/negative-credits. Seed deleted after (cascade confirmed); taxonomy intact. Typecheck/lint N/A (no app code this slice).

---

## ✅ What's DONE and committed (Step 5 — real studio accounts + the light §7 studio profile)

The studio side's foundation — the shared blocker for the dispatch loop, The Beat, studios-in-the-Roster, and map-pin radius. **Light onboarding** (founder decision 2026-07-13): studios are the buyer side, not vetted talent — **no $30 fee, no approval queue.** They sign in (magic link) and fill a §7 profile; the `employer` account is created on first save.

- **DB migration** `20260713000000_studio_profile_and_accounts.sql` (**applied live + mirrored into `schema.sql` §4**): fleshed out `employer_profiles` to §7 — website, **full address**, **map pin `lat`/`lng` (NULLABLE — geocode-later)** + `geocoded_at`, `year_founded`, `student_count_band` (Under 100 / 100–299 / 300+), `staff_count`, `room_count`, the **accessibility block** (`nearest_transit`, `car_required`, `parking` onsite/street/none, `directions_note`), and `culture_note`. New **`studio_concentrations`** vocab (Competition · Technique/Recreational · Conservatory/Pre-Professional — deliberately separate from choreographer `focus_areas`). Three join tables — **`employer_styles` / `employer_concentrations` / `employer_certifications`** (styles + certs reuse the existing vocab) with **own-row RLS** via `owns_employer()`. Check constraints on the bands/counts/year/parking.
- **Studio sign-up + editor:** `/studio` (public "For Studios" front door) → `/studio/edit` (the profile form). Not signed in → `/login?next=/studio/edit` (the magic link brings them back — `login/page.tsx` now carries an internal `next`; `auth/callback` honors it behind an open-redirect guard). On first save, `saveStudioProfile` (`src/app/studio/edit/actions.ts`) creates the `users` row as **`account_type='employer'`** + the `employer_profiles` row + the joins. Editing an address clears any stored map pin so the later geocode backfill re-pins. Homepage gained a **"For studios →"** link.
- **Pure, tested logic** (`src/lib/studio/profile.ts`): `buildEmployerProfileRow` + `parseYearFounded` / `parseCount` / `parseEnum` / `parseTriBool` / `addressChanged`. Out-of-vocab values are dropped (not fatal); only the studio name is required.
- **Tests:** **61 green** (`npm test`) — added the 13-test studio suite. **Verified against the live DB:** a full studio save round-trips exactly (all §7 fields + 3 styles + 2 concentrations + 1 cert; `lat`/`lng`/`geocoded_at` correctly NULL), all four check constraints reject bad data (negative staff, bad parking, bad band, year 1700) with the row left intact, and the join-table RLS is own-row-only (`authenticated`, no anon) with `studio_concentrations` public-read; seed deleted after (cascade confirmed). Typecheck + lint clean. *(Signed-in click-through needs a real magic-link session — same limitation as every prior slice — but the DB round-trip + RLS shape are proven and the pages compile clean.)*

---

## ✅ What's DONE and committed (Step 5, Slice A — The Swing: teacher availability)

The member-controlled opt-in foundation for The Swing (spec §10; the §17 consent guardrail). **Teacher-side only** — no studio side, slots, matching, dispatch, billing, or reviews (those are the next slices). Defaults confirmed with Kathleen: **miles + free-text home base now; no public "Available for Swing" badge this slice.**

- **DB migration** `20260712030000_swing_availability.sql` (**applied live + mirrored into `schema.sql` §14**): `swing_availability` (1:1 with a profile — `is_available` **defaults FALSE**, `home_location`, `travel_radius_miles` (check ≥ 0), `notes`) + `swing_styles` / `swing_levels` joins (what they'll *sub*, chosen independently from their teaching set; reuse `styles` + the 5 `levels`). **Own-row RLS** on all three (`owns_talent_profile`); an index on opted-in teachers for the future dispatch loop.
- **Profile editor** gained a **"The Swing"** section (`ProfileEditor.tsx`): an **Available for Swing** toggle — **OFF by default**, flippable anytime — that reveals styles-to-sub, levels-to-sub (5 rungs), home base, travel radius (miles), and notes. Fields stay mounted (hidden when off) so **turning off preserves your choices**. `page.tsx` loads the row; `saveProfile` upserts `swing_availability` + replaces the swing joins.
- **Pure, tested logic** (`src/lib/swing/availability.ts`): `parseSwingRadius` (clamps/floors/rejects) + `buildSwingAvailabilityRow` (normalization). The editor is already gated to active Professional members, so only they see the toggle.
- **Tests:** 48 green (`npm test`) — added the swing suite. **Verified against the live DB:** a "Swing ON" save round-trips exactly (availability + styles + levels), **toggle OFF preserves** home/radius/styles/levels (only the flag flips), and the check constraint rejects a negative radius; seed deleted after. The gated editor compiles (logged-out → login) with zero server errors; typecheck + lint clean. *(The signed-in toggle click-through needs a real session — same limitation as prior steps — but the DB round-trip and RLS shape are proven.)*

---

## ✅ What's DONE and committed (Step 4, slice 2 — the Roster: hiring actions)

The "connect" half of discovery (CLAUDE.md 4C + Open Decision 2). Founder decisions confirmed: **any active member** may save + request an intro (not their own profile — since there are no studio accounts yet); and **Accept keeps contact private** (status only, no reveal).

- **Recorded in the existing `connections` table** — no new table. `connection_type` already has `save` / `message-request`; RLS already lets the sender read/write their rows and the recipient talent read + update status. Migration `20260712020000` only adds a **unique index** (from_user, to_profile, type) so a save is idempotent + upsertable, plus a `from_user_id` index.
- **On a public `/[handle]` profile** (`ConnectActions.tsx`, shown only to signed-in active members who aren't the owner): **Save** (bookmark toggle) + **Request an intro** (a lean note; no contact revealed). Server actions in `src/lib/connections/actions.ts`, gated by `hasAnyActiveMembership` + `canConnect`.
- **`/roster/saved`** — the member's saved professionals. **`/profile/requests`** — the talent's incoming intro requests (requester **name + note only**, never contact) with **Accept** (→ responded) / **Decline** (→ closed). Nav links added on the Roster and the profile editor.
- **Email #8 "New intro request"** wired as a Resend seam (logs until the key is set) and updated in `EMAILS.md` — one transactional email to the talent on an explicit user action; no contact in it (clean-email discipline, guardrail #5).
- **Pure, tested logic** (`src/lib/connections/messages.ts`): intro-message validation + the `canConnect` gate.
- **Tests:** 41 green (`npm test`) — added the connections suite. **Verified** the full round-trip against the **live DB**: save idempotency (2 inserts → 1 row), the incoming-requests query (name + note), the saved-list query, and Accept → `responded`; then deleted the seed. Logged-out gates (`/profile/requests`, `/roster/saved` → login) and the logged-out profile render (no actions shown) confirmed in-browser. Typecheck + lint clean. *(The signed-in click-through of Save/Request/Accept needs a real session, same limitation as prior steps — but the DB round-trip + RLS shape are proven and the pages compile clean.)*

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
