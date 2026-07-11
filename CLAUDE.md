# Relevé Connect — Build Prompt for Claude Code
## 90-Day Focus: The Profile System (the product)

*A single, self-contained brief to hand to Claude Code so it can scaffold and build the Relevé Connect profile platform from scratch — a fresh codebase that Kathleen McAree owns outright.*

*Prepared July 1, 2026 · Founder: Kathleen McAree · Relevé Connect LLC (NJ)*

> **⚠️ SUPERSEDED IN PART — reconciled 2026-07-11.** This is the original July-1 *90-day profile-system* brief. The current source of truth is now **`docs/Releve_Connect_Member_Platform_Build_Spec_2026-07-11.md`** (what / what-order) + **`docs/Releve_Pricing_RATIFIED_2026-06-25_SINGLE_SOURCE_OF_TRUTH.md`** (pricing), with the mapping in **`docs/RECONCILIATION-NOTE-2026-07-11.md`**. Where this file disagrees with those two, **they win.** The passages below were corrected on 2026-07-11 for: **tier names**, **Charter cohorts**, **expanded scope** (Marketplace / Stripe Connect / Swing are now IN), and the new **$30 application fee**. Corrected passages are marked inline.

---

## 0. How to use this document

Paste this whole file into Claude Code as the opening prompt (or drop it in the repo as `CLAUDE.md`). It is the source of truth for **what** to build over the next 90 days, **the rules that must never be broken**, and **what is explicitly out of scope for now.**

**The one-sentence mission for these 90 days:**
> Build a searchable, scalable, categorized profile system where dance professionals present themselves as the product, and studios (employers) discover, browse, and connect to them.

**Ground rules for you, Claude Code:**
1. The **profile is the product.** Everything serves one goal: a professional can create a rich, searchable, shareable profile, and an employer can find them. Memberships are a **simple one-way charge** that gates activation (Section 4G). *(Updated 2026-07-11: the Marketplace transaction engine, split payments, and Stripe Connect are **now IN scope** — the $499 Signature Experience already shipped on Connect, and the full roadmap is build spec §2. Only memberships stay one-way; artist payouts / the 80/20 Marketplace use Connect.)*
2. Build for scale from day one — the schema and search must comfortably grow from a founding cohort to national volume.
3. Ask before inventing product behavior. If a detail isn't specified, stop and ask — don't guess.
4. Everything is owned by Relevé Connect LLC. No vendor lock-in that can't be exported. All data portable.
5. Write it so a non-engineer founder can run, understand, and hand off the project. Comment generously. Keep a running `DECISIONS.md` and `README.md`.

---

## 1. What Relevé is (context you must hold)

Relevé Connect is national infrastructure for the dance industry — built by a career choreographer/teacher for the working artists this industry has always run on.

The core insight driving the 90-day build: **the people are the product.** Dancers, teachers, and choreographers have never had real, credentialed, discoverable professional presence. Studios rebook the same three people because they don't know who else exists. Relevé fixes that by making every professional a searchable, self-represented profile — the way the industry should have worked for forty years.

**The founding principle, non-negotiable:**
> **Relevé does not tax labor. Relevé monetizes infrastructure and product.**

**The retention principle (keep the relationship on Relevé — anti-disintermediation):**
> The subscription is only worth paying for if the *work* lives on Relevé, not just the introduction. The **only** parts of the relationship that leave the platform are the physical act (a teacher showing up at a studio) and the tax paperwork (the employer issues the 1099/W-2 directly). **Everything upstream stays on RC:** discovery, contact, messaging, scheduling/booking, sub-coverage, the record of who worked where, ratings and rehire history, and — later — the payment rail.
>
> Achieve this with **gravity, not walls.** Retention comes from RC being genuinely *easier* than going around it (booking, sub-coverage, records, reputation) — not merely from hiding contact info. Don't build friction that punishes users before the on-platform value exists. Two moves together: (1) don't hand over the connection — first contact and communication route through RC (contact details private by default); (2) build the rails that make leaving the inconvenient choice.
>
> Consistency check with no-tax-on-labor: keeping payment on-platform is for stickiness and convenience — RC **facilitates** it and never skims the worker's wage. Revenue is the subscription + the marketplace take on choreography, never a cut of the paycheck.

A working dancer's or teacher's earnings are theirs. Relevé earns from **membership subscriptions and product** — never by skimming a wage. The 90-day build **does** include a membership subscription that completes/activates a profile (Section 4G); that is an infrastructure fee, not a tax on labor. What Relevé never does is take a cut of what a member earns from their own work.

Brand line: *together we rise · nous nous levons · relevé.*

---

## 2. The two sides of the product

There are two fundamentally different actors. Build them as distinct roles with distinct experiences.

### The Talent — the product being distributed
**Dancer · Teacher · Choreographer.** These are the professionals Relevé exists to represent and distribute. Their job on the platform: **present, describe, market, represent, and demonstrate themselves.** Their profile is a living professional identity — headshot, bio, resume, credentials, social links, and video (Vimeo/embed) that *shows* the work. Rich, self-managed, shareable, and — critically — **findable.**

### The Employer — the demand side
**Studio (and by extension directors, comp teams, hiring choreographers).** A studio is **not** talent and should not be modeled as "the product." A studio is an **employer/consumer** of profiles. Its job: **search, browse by category, shortlist, view, and connect** to talent. A studio still has its own presence page (who they are), but its primary tooling is discovery, not self-promotion.

*One person can hold multiple talent roles (a choreographer who also teaches). A studio is a separate account type.*

---

## 3. Data model (source of truth for the schema)

Design for search and scale. Categorization is not decoration — it is the spine of the product. All category fields must be structured, controlled-vocabulary, and indexed.

### User / Account
`user_id` (PK) · `email` · `account_type` (`talent` | `employer` | `admin`) · `display_name` · `status` (invited / active / suspended) · `created_at`. Auth-backed, role-based.

### Talent Profile (Dancer / Teacher / Choreographer) — **the product**
- Identity: `profile_id` (PK) · `user_id` (FK) · `roles` (multi: teacher / choreographer / working_dancer / studio_owner) · `primary_role` (add an explicit primary designation) · `display_name` · `public_slug` (shareable) · `location` (city, state, country) · `age_range`.
- Presentation: `headshot_url` · `bio` / narrative story · `resume` (uploaded file + structured entries: training, companies, credits, education) · `years_experience` · `credentials` · `availability`.
- Media: `social_links` (website, Instagram, Vimeo, YouTube, LinkedIn) · `video_reels` (teaching / choreography / performance reels — ordered Vimeo/embed URLs with labels) · `resume_url`.
- Categorization (searchable, controlled vocabulary): `styles` · `levels` · `focus_areas` · `region`. Normalized many-to-many, not free text.
- Status & standing: `status` (pending / in-review / approved) · `profile_status` (draft / published) · `visibility` (public / unlisted) · `verification_flag` (**Verified Member** — identity/standing mark, admin-granted after ~60 days; not a competence stamp) · `choreographer_tier` (defaults to Emerging; **admin-assigned / founder-reviewed** earned ladder — no hardcoded threshold) · `founder_distinction` · `updated_at`.

### Employer Profile (Studio)
`employer_id` (PK) · `owner_user_id` (FK) · `name` · `location` · `logo_url` · `bio` · `links` · `verified`. Lighter presentation; its real surface is the search/discovery tools.

### Taxonomy tables (the categorization spine)
Controlled vocabularies as their own tables so search stays consistent: `styles`, `disciplines`, `levels`, `regions`, `role_types`. Join tables link profiles to these. Admin can add terms without a code change.

### Connection / Contact
`connection_id` (PK) · `from_user_id` · `to_profile_id` · `type` (view / save / message-request) · `created_at`. Lets an employer shortlist and reach out; no transactions, no payments. Model it as a durable, extensible record (see retention principle) — NOT a fire-and-forget email.

### Saved Search / Shortlist
`shortlist_id` (PK) · `employer_id` (FK) · `profile_id` (FK) · `notes` · `created_at`.

### Rating / Review (two-sided peer reputation — schema now, flow as next rail)
`review_id` (PK) · `connection_id` (FK — a review can only exist against a recorded working relationship) · `reviewer_id` · `reviewee_id` · `direction` (studio→teacher | teacher→studio) · structured scores (studio→teacher: professionalism, timeliness, preparedness; teacher→studio: courtesy, professionalism, payment_clean) · optional short `comment` · `reciprocal_reveal_status` (hidden until both submit or window closes) · `created_at`. Aggregates surface on the profile as a searchable trust signal.
- HARD RULE: reviews are strictly about the two professional parties. NEVER about a student or minor — no student names, no student references, ever. Enforce in UI copy and moderation.
- Earned, not open: only a party to a recorded connection can review the other.

### Membership (payment / activation — see Section 4G)
`membership_id` (PK) · `user_id` (FK) · `tier` · `price` · `term` (annual) · `stripe_customer_id` · `stripe_subscription_id` · `membership_status` (pending / active / lapsed / canceled) · `renewal_date`. A profile publishes and appears in search only when `membership_status = active`. Simple one-way charge — no split, no Stripe Connect.

*(Choreographer catalog pieces, licensing, and transactions are Phase-2 entities — do NOT build them now. But design the Talent Profile so video reels can later become sellable catalog pieces without a re-architecture.)*

---

## 3A. The live application → profile field map (captured from releveconnect.com/apply)

A 13-section, role-branched form. Build the profile schema to receive these fields directly, and build the new intake to match this structure:

1. Identity & Contact — first/last name, email, mobile, city, state/province, country, age range (18–24 / 25–34 / 35–50 / 50+).
2. Professional Roles — multi-select: Teacher · Studio Owner · Choreographer · Working Dancer. (No primary is captured — add a primary-role designation.) Roles branch the form.
3. Your Story — narrative bio (aim 150–250 words, enforced minimum) + years of professional experience (1–2 / 3–5 / 6–10 / 11–20 / 20+).
4. Industry Experience — studios/companies worked with · notable credits · union affiliations (AEA / SAG-AFTRA / AGMA / None / Other) · certifications & specializations · degrees held (BA / BFA / MA / MFA / Doctorate). → credential badges.
5. Teaching Philosophy (if Teacher) — four narrative prompts · levels comfortable to teach (Beginner → Professional) · styles taught (Ballet, Pointe, Variations, Jazz, Hip-Hop, Contemporary, Modern, Tap, Lyrical, Musical Theatre, Latin, Ballroom, Acro, Improvisation, Other) · adaptive-dance experience · available to sub? · where currently teaching.
6. Studio Owner Specifics (if Studio Owner — employer branch).
7. Choreographer Specifics (if Choreographer) — focus areas (Competition, Concert/Stage, Commercial, Theatre/MT, Film/TV, Lyrical/Contemporary, Ballet, Jazz, Hip-Hop, Tap, Other) · years choreographing · available to license existing pieces? · Your Work: up to 3 links (Vimeo/YouTube/Drive/Dropbox) with labels.
8. Working Dancer Specifics (if Working Dancer) — training summary · performance experience · currently auditioning for (Commercial, Backup/Concert Tour, Musical Theatre, Event, Cruise/Theme Park, Industrial, Film/TV, Other).
9. Professionalism & References — two references (name, email/phone, relationship) · work authorization (US) · Code of Conduct agreement.
10. Digital Presence (all optional) — website, Instagram, Vimeo, YouTube, LinkedIn, Headshot URL, Resume/CV URL, Teaching Reel, Choreography Reel, Performance Reel. → these ARE the profile media fields.
11. Relevé Alignment — two narrative prompts.
12. Open-To Badges — self-selected engagement badges (Badge System class B). "Select at least one."
13. Review & Consent — five agreements: Terms · Privacy · consent to use bio/headshot/reels on platform + promo with attribution · consent to be contacted · understands review/not-guaranteed. Then Submit.

Notes: narrative fields enforce minimum word counts; progress auto-saves and emails a resume link (14-day window); the choreographer tier is NOT asked — assigned by Relevé in review.

---

## 3B. Badge system (three distinct classes — build as separate concepts)

**A. Credential / earned badges** — from degrees, certifications, union affiliations; the **Verified Member** mark *(renamed from "Certified" 2026-07-11)* — an **identity / standing mark** granted after a ~60-day active-membership window, meaning *real, vetted, active member*, **NOT** a competence or skill endorsement (upholds the no-endorsement guardrail, build spec §13); and the Choreographer **marketplace tier**, an **earned ladder** (artist share first): **Emerging 60/40** (entry) → **Established 70/30** (earned by sales; an **admin-assigned, founder-reviewed** field — do **not** hardcode a sales threshold [TBD]) → **Signature 80/20** (the Founding 25, on Senior Spotlight + Competition catalogs). **Legacy & Vanguard** cohorts are **Co-Productions** — split negotiated per project (**TBD — do not hardcode a rate**). Store the evidence and render the badge from it.
Tier policy (ratified — see Vision Bible §06): every member enters as Emerging. Tiers are earned by sales, peer review, and contribution to the platform, reviewed annually — status is earned, not purchased. Specific numeric thresholds are NOT yet ratified; do not hardcode dollar/piece gates. Exception: the Founding 25 are granted permanent Signature status (80/20) as a founding designation. The only manual override is "Founder's Discretion," logged with reason + timestamp, an exception not a routine path. *(Updated 2026-07-11: tier is an **admin-assigned, founder-reviewed** field — the Established sales threshold is **TBD, not hardcoded**. Marketplace is on the roadmap at build spec §2, Step 6; until it launches everyone is Emerging and Founder's Discretion is the only live elevation lever.)*

**B. Open-To engagement badges** — self-selected (application Section 12): Teaching new classes · Substituting via The Swing · Choreographing on commission · Licensing pieces · Auditioning via The Beat · Speaking on a panel / Relevé Live · Publicly posting for Relevé on social · Other. Member-editable.

**C. Founder distinction badges** — admin-assigned only:
- Founding Honoree · Founding 25 — the 25 Founding Honoree choreographers, hand-chosen (permanent Signature tier, 80/20). Distinct, premium (gold) mark. The four cohorts (Senior Spotlight · Competition · Legacy · Vanguard) live in profile metadata, not as separate badges.
- Charter Studios — first 50 founding studios (silver). *(Corrected 2026-07-11.)* Founding benefit: **50% off Year 1 across all tiers** — Studio Connect $249 → $124.50 · Studio Growth $499 → $249.50 · Studio Accelerator $1,499 → $749.50 — with **Accelerator capped at ~10 seats**, then standard rate in Year 2. **Not** locked-for-life. *(Supersedes the earlier "50% off the Accelerator only, others full price.")*
- Charter Faculty — first 50 founding teacher/performers (silver). *(Corrected 2026-07-11.)* Founding benefit: **50% off Year 1** on Professional ($149 → $74.50) and Professional·Full ($199 → $99.50), then standard rate in Year 2. **Not** locked-for-life. *(Supersedes the earlier "First 100 Artists, founder rate locked for life.")*
- Model as an admin-assignable `founder_distinction` enum with room for future cohorts.

Render all three classes on the public profile, visually differentiated.

---

## 4. The 90-day build — feature by feature

A. Profile creation & self-management (Talent) — guided per-role builder; upload headshot, rich bio, resume file and/or structured entries, social links, ordered video reels (paste Vimeo/YouTube URL → renders inline); set categories; Draft vs Published (not discoverable until published).

B. Public profile page — clean, shareable page at a stable `public_slug`; headshot, bio, resume, embedded reels, social links, categories, and all three badge classes visually differentiated. Fast, mobile-first.

C. Search & discovery (Employer) — THE HEART. Searchable directory of published talent; filter by role, style, level, region, availability, verified; combine filters; full-text search on name/bio; fast, paginated, indexed (start Postgres full-text; leave a seam for a dedicated search service later). Employer can view, save/shortlist, and initiate contact via the lean in-app intro request (see Open Decision 2) — no payment.

D. Employer presence + account — studio presence page; dashboard with saved searches, shortlists, recent views.

E. Admin / founder tooling — review applications (approve / request-more-info / decline); grant the **Verified Member** mark; assign choreographer tier; confer founder distinction badges; manage taxonomy without a deploy; invite founding cohort.

F. Onboarding & intake — rebuild the intake to mirror the 13-section role-branched application (3A), feeding a single DB source of truth. No loose email intake. Preserve: auto-save + resume link (14-day window), progress bar, minimum word counts. On submit: applicant enters DB in pending state; send EXACTLY ONE confirmation to applicant + ONE internal admin alert; do NOT auto-subscribe anyone to a newsletter. Approval emails only on explicit admin action. Every automated email templated, versioned, listed in EMAILS.md with its trigger. No hidden triggers.

G. Membership activation via payment (in scope — simple, one-way). Lifecycle: applied → in-review → approved → payment due → paid/active → profile publishable.
- Simple one-way subscription charge — Kathleen creates the Stripe Payment Link herself. No split, no Connect. Stripe processes the card.
- After admin approves, surface the payment step (link for the tier they applied under — Individuals $99/$149/$199 (**Live Pass / Professional / Professional·Full**); Studios $249/$499/$1,499 annual (**Studio Connect / Studio Growth / Studio Accelerator**)). *(Names ratified 2026-07-11; prices unchanged. Retired: "Access / Signature Pro / Base.")* Note: $99 **Live Pass** is a JOIN tier (no application, not on the Roster); $149/$199 APPLY and are vetted.
- Detect payment via a Stripe webhook (checkout.session.completed / subscription events) → flip membership_status to active; record stripe_customer_id, stripe_subscription_id, renewal_date.
- Gate on paid: a profile publishes / appears in search only when membership is active. Approved-but-unpaid = not discoverable.
- Handle unhappy paths: pending, failed, lapsed/canceled (→ inactive, unpublished but data retained), renewal.
Stripe setup notes: one Payment Link per tier (own Price ID each); map Price ID → tier in config; pass member user_id as client_reference_id; one webhook endpoint verifying the signing secret; keys in env vars; start in test mode.

**$30 application fee (NEW — ratified 2026-07-11, build spec §4).** A $30 charge to apply, **vetted performer/teacher tier only** (Professional $149 profile tier) — **not** Live Pass, **not** studios. **Credited 100% toward membership if accepted and they join · fully refunded if not accepted · forfeited only if accepted and they decline to subscribe. Waived for the Founding 25.** It funds the council's vetting labor, so it does **not** violate no-tax-on-labor. **Copy rule:** every public touchpoint leads with "credited toward your membership when accepted, refunded if not accepted" — **never** "pay $30 to apply." Replaces the retired "verification / background-check fee." There is **NO background check**.

**Founding-25 Honoree terms — RATIFIED 2026-07-11.** **18 months free, then $99/year membership dues for life.** **Permanent Signature marketplace tier — 80/20 on Senior Spotlight + Competition catalogs.** **$30 application fee waived.** (Now in the pricing source of truth.)

---

## 5. Recommended stack (fresh build, founder-owned)
- Framework: Next.js (App Router, TypeScript).
- Database: PostgreSQL via Supabase (Postgres + auth + storage + RLS). Exportable, no lock-in.
- Auth: Supabase Auth (email magic-link + Google), role-based (talent, employer, admin).
- Media: Supabase Storage (or S3) for headshots/resumes; Vimeo (private) for video reels — never self-host video.
- Search: Postgres full-text + indexed filters; isolate the query layer to move to Meilisearch/Typesense/Algolia later.
- Email: **Resend** *(ratified 2026-07-11; Postmark was the alternative)* — single sender, templated/versioned, no tangled automation.
- Hosting: Vercel (see Open Decision 1 — RESOLVED Vercel).
Keep secrets in env vars, never in the repo. Document every env var in README.md.

---

## 6. Explicitly OUT of scope for the 90 days (design the seams, don't build)
- ~~Choreography Marketplace transaction engine (licensing, commissions, Audition Library commerce, take-rate/payout, split payments, Stripe Connect).~~ · ~~Swing/Flex per-use billing, verification-fee billing, Forum ticketing.~~ **← NO LONGER OUT OF SCOPE (2026-07-11).** These are now on the roadmap per **build spec §2** (Gate → Profile → Roster → **Swing** → Reviews → **Marketplace**). The $499 Connect build already shipped; the "verification fee" is replaced by the **$30 application fee** (§4G). Memberships (4G) still stay a simple one-way charge — only artist payouts / the 80/20 Marketplace use Connect.
- Design-for-later: model the connection record as the durable home of a working relationship so threaded messaging, scheduling/booking, sub-coverage, work-history, ratings/rehire, and a facilitated payment rail can layer on WITHOUT re-architecture. Don't build them now; just don't block them.
- Music-licensing logic: build none. Guidance to choreographers is to use AI/royalty-free music. At most capture a plain note field later.
- Rainy Day Fund. Not now.

---

## 7. Guardrails — never violate
1. No-tax-on-labor. Membership subscription is fine (infrastructure fee). Never take a cut of what a member earns from their own work.
2. The profile is the product.
3. Studios are employers, not talent. Never blur the two account types.
4. Data ownership & consent. All data is Relevé's, captured with consent, exportable. Never ingest a raw purchased list.
5. Clean email discipline. One confirmation on sign-up, one admin alert, nothing else automatic. Approval emails only on explicit admin action.
6. Don't let the founder become QA. Tests for the two flows that cannot break: intake/onboarding emails, and search returning correct filtered results.

---

## 8. OPEN DECISIONS (mostly resolved 2026-07-01)
1. RESOLVED: Vercel hosting. (Prior contractor build is on Netlify/Next.js from GitHub repo kathleenkilcoyne/releve-platform, which Kathleen owns. Fresh build = new clean repo on Vercel; keep Netlify live until cutover, then re-point releveconnect.com DNS. No code migration.)
2. RESOLVED: lean in-app intro request (NOT reveal-contact). First contact routes through Relevé, stored as a connection record; talent gets an email notification and can respond; contact details private by default. Do NOT build a full chat inbox now — just the one seam.
3. Category vocabularies — reuse the strong starter lists in Section 3A; confirm final lists.
4. RESOLVED (updated 2026-07-11): the **Verified Member** mark (renamed from "Certified") is RC-granted after ~60 days from membership activation. It is an **identity / standing mark** (real, vetted, active member), **not** a competence stamp — RC never vouches for skill (no-endorsement).
5. Founding cohorts (revised 2026-07-11): Founding 25 (Signature choreographer honorees, gold) · **Charter Studios** (first 50; 50% off Year 1 across all tiers, Accelerator capped ~10; not lifetime) · **Charter Faculty** (first 50 teacher/performers; 50% off Year 1 on $149/$199; not lifetime). Accelerator is **$1,499** (not $1,500). Supersedes the 2026-07-08 "First 50 Studios (Accelerator-only) / First 100 Artists (locked for life)" and the Bible's "Founding 300." Badges attach at paid activation.

---

## 9. Working agreement for Claude Code
- Start by scaffolding the repo, README.md, DECISIONS.md, EMAILS.md, and the Postgres schema from Section 3 (including taxonomy tables).
- Then build VERTICALLY: one working slice first — talent signs up → builds a profile → publishes → it appears in employer search under the right categories. Prove that loop before breadth.
- Commit in small, described steps with a plain-English changelog a non-engineer can read.
- Write tests for onboarding emails and search/filter correctness.
- Surface every assumption. On an Open Decision, stop and ask — don't guess.
- Optimize for the founder being able to run `npm run dev`, see it work, and understand what changed.

*— together we rise —*
