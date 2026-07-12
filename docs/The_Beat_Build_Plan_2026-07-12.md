# The Beat — Build Plan & Corrected Claude Code Prompt
*Created 2026-07-12 (Kathleen + Cowork). Source: Kathleen's 2026-07-12 email "I'm building The Beat…". This file **supersedes that email** for the actual build — the email specified Clerk auth, which conflicts with the platform. Read this instead.*

---

## What The Beat is
A **multi-lane opportunity marketplace** inside Relevé Connect — far more than an audition board. Employers, studios, casting agencies, and college/university partners post opportunities; **and individual industry professionals (including retired/transitioned dancers) can post too** — makeup artists, hair, designers, stage managers for recitals, competition prep, studio admin/front-desk, etc. The vision (Kathleen): *anyone in the dance industry can use The Beat to post, audition, offer a service, and find work — even after they stop performing.*

**Two-sided by design:** the schema must support both **"hiring" posts** (someone offering a job/audition/gig) and **"for-hire / seeking-work" posts** (an individual advertising their services/availability). And it must be **richly filterable** across many lanes (see categories + `opportunity_type` below) so auditions are just one lane among many.

Revenue = per-post fees + annual partner-package bundles. This is the platform's next **financial** pillar after Stripe + Profiles.

**Strategic note:** the **Partner Packages** tier is the monetization vehicle for the College/University advertising pitch. The Beat is the product that pitch sells.

**Guardrail check (CLAUDE.md #1 — no tax on labor):** ✅ consistent. The Beat charges **employers to post**; it never skims a worker's wage. Marketplace/product revenue, not a cut of a paycheck.

---

## ⚠️ The one correction vs. the email: AUTH
The email said **Clerk** (`employer_id (Clerk user_id)`). **The platform runs on Supabase Auth** (`@supabase/ssr`, `src/lib/supabase/`, `account_type` on the user model). **DECISION (ratified 2026-07-12): The Beat builds on Supabase Auth — NOT Clerk.**
- `employer_id` → the platform's existing Supabase user (uuid, `auth.users` / the existing account table). **Claude Code: review the existing user/account + `memberships` tables first and align FKs and naming to them.**
- Because it's one identity system, member-vs-non-member post pricing is a straight lookup against the existing `memberships` table — no bridge needed.

---

## Pricing (RECONCILED & RATIFIED 2026-07-12)
| Poster | Price / inclusion |
|---|---|
| Non-member | **$49** / one-off post |
| RC member — **Professional** ($149) or **Creator** ($199) | **$29** / one-off post |
| **Live Pass** ($99) | The Beat access + **pay-to-post** (per-post rate) |
| Studio **Connect** ($249/yr) | **1 Beat post/yr included** *(NEW 2026-07-12 — was none)* |
| Studio **Growth** ($499/yr) | **10 Beat posts/yr included** *(per ratified SSOT — NOT 3)* |
| Studio **Accelerator** ($1,499/yr) | **UNLIMITED Beat posts** *(per ratified SSOT — NOT 5)* |
| Partner **Essential** | **$399/yr — 15 posts** ($26.60/post) |
| Partner **Premier** | **$999/yr — 40 posts** ($24.98/post) |
| Partner **Elite** | **$1,799/yr — 75 posts** ($23.99/post) |

**On the "Creator" name (ratified 2026-07-12):** the $199 tier is **Creator**, not "Professional·Full." Rationale (Kathleen): at $199 they're licensed to *create* choreography to license — "Creator" names the capability. **Keep the internal DB slug `professional_full` unchanged** (no code churn); change only the **display label** to "Creator." *(Reconcile the label in the pricing SSOT, build spec, and `src/lib/membership/tiers.ts`.)*

**Competitor benchmark (2026-07-12):** Backstage ≈ **$24.95 per casting notice** (free employer account; monetizes talent via subscriptions). Actors Access / Breakdown Express = **mostly free to post** (monetizes the talent side). ⇒ The partner packages at **$24–$27/post are right on par with Backstage**; the $49 one-off is premium (~2× Backstage, justified by the curated dance-only audience); the $29 member rate sits at market. **Optional idea:** deepen the Elite discount so the top tier feels like a real bulk deal (currently only ~10% below Essential per post).

**Why dancers join (the subscription thesis — Kathleen, 2026-07-12):** The Beat doesn't need to be a standalone profit center. It's the **hook that justifies the membership.** On **Backstage, talent pays a subscription (~$150–$180/yr, approx — confirm live) *just to apply* to jobs.** In RC, a dancer pays **$149 (Professional)** and **The Beat is included** — browse + apply as part of membership, plus a real profile, the Roster, The Climb, member events, and dance-native curation. Same ballpark price the dancer *already spends on Backstage*, redirected to a platform built for them. ⇒ Generous Beat inclusions are a **customer-acquisition lever**, not lost revenue. *(Backstage exact 2026 price still to confirm — page is JS-gated; my figure is a mid-2025 ballpark.)*

**To do — fold into the SSOT:** the pricing SSOT still shows the old tier label and lacks the one-off ($49/$29) + partner-package numbers. Update `docs/Releve_Pricing_RATIFIED_…SINGLE_SOURCE_OF_TRUTH.md` with: Creator label, Connect +1 Beat post, and the one-off + partner-package prices, so numbers have one home. *(Offered to Kathleen — do on her go.)*

**Open questions — do NOT guess, ask Kathleen:**
1. Do studio included-posts **reset annually**? Are they a credit balance (like partner packages) or a rolling allowance?
2. Default post **duration** (`expires_at`) — 30 / 60 days?
3. **"For-hire / seeking-work" posts by individuals** (retired dancers offering makeup, design, stage-managing): are these **free**, member-included, or a small fee? (The $49/$29 was framed for *hiring* posts. Pricing for the "available for hire" lane is undecided.)

---

## Job categories
Film & Television · Cruise Lines · Theme Parks · Dance Company Auditions · Creative Services (makeup, hair, design, etc.) · Studio Admin & Support (front desk, recital help, competition prep, etc.). Admin-managed, extensible without a deploy.

---

## Claude Code build prompt (Supabase Auth version — hand this over)

> Build the **schema and RLS only** for The Beat — a pay-to-post job marketplace inside the existing Relevé Connect platform. **This platform uses Supabase Auth; do NOT introduce Clerk.** First review the existing repo: the user/account model, the `memberships` table, and the migration conventions in `supabase/migrations/`. Align all foreign keys and naming to what's already there.
>
> Create Supabase migration files (`YYYYMMDDHHmmss_description.sql` in `supabase/migrations/`), with clear comments explaining each table. **Do not** build the Stripe payment flow (placeholders only). **Do not** build UI or API routes.
>
> **Tables:**
> 1. **categories** — `id, name, slug` (e.g. `film_and_television`, `creative_services`). Searchable, admin-managed. Seed the six categories above.
> 2. **job_postings** — `title, description, location, category_id (FK), employer_id (FK → the platform's Supabase user/account id), listing_type (hiring | seeking_for_hire), opportunity_type (audition | employment | freelance_gig | creative_service | studio_support | other), posting_type (one_off | studio_included | partner_package), status (draft | active | expired | closed), compensation_info, application_method, partner_package_id (nullable FK), created_at, expires_at, updated_at`.
>    **Two-sided + many lanes (Kathleen's core requirement):** `listing_type` distinguishes someone *hiring* from an individual advertising themselves *for hire*. `opportunity_type` + `category_id` are the **filters** so The Beat is browsable across many lanes — auditions are ONE lane, alongside creative services (makeup/hair/design), studio admin & support, film/TV, cruise, theme parks, dance-company auditions. Design so a job-seeker can filter by lane, type, category, and location.
> 3. **partner_packages** — `employer_id (FK → platform user), package_type (essential | premier | elite), total_posting_credits, credits_used, credits_remaining, starts_at, ends_at, status (active | expired | cancelled), created_at`.
> 4. **beat_transactions** — `employer_id (FK → platform user), amount, transaction_type (one_off_post | studio_included_debit | partner_package_purchase), posting_id (nullable FK), partner_package_id (nullable FK), status (pending | completed | failed), created_at, stripe_payment_intent_id (nullable), stripe_session_id (nullable)`. Leave Stripe fields null for now. *(Named `beat_transactions` to avoid colliding with any existing membership/payment tables — confirm against the repo.)*
> 5. **RLS:** employers view/edit/delete only their own postings & packages; `active` postings are world-readable (job seekers browse); transactions private to their owner.
> 6. **Indexes:** on `employer_id`, `category_id`, `status`, `expires_at`.
>
> Member vs non-member pricing is determined at checkout time (later) by looking up the poster's row in the existing `memberships` table — design the FKs so that lookup is trivial. Do not hardcode prices in the schema.

---

## Where we are (2026-07-12) & the sequence
**Status:** Step 2 (vetting gate) done + backed up to GitHub (`releve-connect-platform`). Stripe: 6 tiers in test, webhook working. Supabase live. MailerLite = campaigns; Resend = transactional (key pending).

**Agreed build order (founder decision — consciously moves The Beat ahead of Swing/Reviews/Marketplace):**
1. **Step 3 — Profiles** (visual-first Professional profile behind the paywall). Foundation for Beat member-pricing.
2. **Reconcile** The Beat spec (this file): Supabase Auth ✅, tier-name fix ✅, add Beat prices to pricing SSOT.
3. **Build The Beat schema** (the prompt above).
4. **Stripe for The Beat** — per-post checkout + partner packages, reusing the existing webhook pattern.
5. **College/University pitch** goes out — now there's a product (partner packages) to sell.

*Not live until the gate + profiles + payments are real. Brent's June-19 Netlify site is the marketing front door, not the product.*

*— together we rise · nous nous levons · relevé —*
