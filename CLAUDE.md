# Relevé Connect — Build Prompt for Claude Code
## 90-Day Focus: The Profile System (the product)

*A single, self-contained brief to hand to Claude Code so it can scaffold and build the Relevé Connect profile platform from scratch — a fresh codebase that Kathleen McAree owns outright.*

*Prepared July 1, 2026 · Founder: Kathleen McAree · Relevé Connect LLC (NJ)*

---

## 0. How to use this document

Paste this whole file into Claude Code as the opening prompt (or drop it in the repo as `CLAUDE.md`). It is the source of truth for **what** to build over the next 90 days, **the rules that must never be broken**, and **what is explicitly out of scope for now.**

**The one-sentence mission for these 90 days:**
> Build a searchable, scalable, categorized profile system where dance professionals present themselves as the product, and studios (employers) discover, browse, and connect to them.

**Ground rules for you, Claude Code:**
1. The **profile is the product.** Everything in the 90-day build serves one goal: a professional can create a rich, searchable, shareable profile, and an employer can find them. Build the **simple membership payment** that gates activation (Section 4G) — but do NOT build the choreography Marketplace transaction engine, split payments, or Stripe Connect (see Section 6).
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
- Status & standing: `status` (pending / in-review / approved) · `profile_status` (draft / published) · `visibility` (public / unlisted) · `verification_flag` (Certified — admin-granted) · `choreographer_tier` (defaults to Emerging; earned by sales; Founder's-Discretion override only) · `founder_distinction` · `updated_at`.

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

**A. Credential / earned badges** — from degrees, certifications, union affiliations, the Certified/verified flag (RC-granted after a ~60-day tenure/observation window — Relevé's own stamp, distinct from peer ratings), and the Choreographer tier (Emerging → Established → Featured → Signature). Store the evidence and render the badge from it.
Tier policy (ratified): every member enters as Emerging. Tiers are earned by sales (Established after $5k or 10 pieces; Featured after $25k or 30; Signature after $75k or 75) — status is earned, not purchased. The only manual override is "Founder's Discretion," logged with reason + timestamp, an exception not a routine path. (Since Marketplace is out of scope now, at launch everyone is Emerging; Founder's Discretion is the only live elevation lever until ~Q1 2027.)

**B. Open-To engagement badges** — self-selected (application Section 12): Teaching new classes · Substituting via The Swing · Choreographing on commission · Licensing pieces · Auditioning via The Beat · Speaking on a panel / Relevé Live · Publicly posting for Relevé on social · Other. Member-editable.

**C. Founder distinction badges** — admin-assigned only:
- Founding 25 · Signature — the 25 Founding Honorees, hand-chosen. Distinct, premium (gold) mark.
- First 50 — a similar-but-not-identical sibling badge (silver) for the first 50 approved members. Same motif, lower emphasis.
- Model as an admin-assignable `founder_distinction` enum with room for future cohorts.

Render all three classes on the public profile, visually differentiated.

---

## 4. The 90-day build — feature by feature

A. Profile creation & self-management (Talent) — guided per-role builder; upload headshot, rich bio, resume file and/or structured entries, social links, ordered video reels (paste Vimeo/YouTube URL → renders inline); set categories; Draft vs Published (not discoverable until published).

B. Public profile page — clean, shareable page at a stable `public_slug`; headshot, bio, resume, embedded reels, social links, categories, and all three badge classes visually differentiated. Fast, mobile-first.

C. Search & discovery (Employer) — THE HEART. Searchable directory of published talent; filter by role, style, level, region, availability, verified; combine filters; full-text search on name/bio; fast, paginated, indexed (start Postgres full-text; leave a seam for a dedicated search service later). Employer can view, save/shortlist, and initiate contact via the lean in-app intro request (see Open Decision 2) — no payment.

D. Employer presence + account — studio presence page; dashboard with saved searches, shortlists, recent views.

E. Admin / founder tooling — review applications (approve / request-more-info / decline); grant Certified; assign choreographer tier; confer founder distinction badges; manage taxonomy without a deploy; invite founding cohort.

F. Onboarding & intake — rebuild the intake to mirror the 13-section role-branched application (3A), feeding a single DB source of truth. No loose email intake. Preserve: auto-save + resume link (14-day window), progress bar, minimum word counts. On submit: applicant enters DB in pending state; send EXACTLY ONE confirmation to applicant + ONE internal admin alert; do NOT auto-subscribe anyone to a newsletter. Approval emails only on explicit admin action. Every automated email templated, versioned, listed in EMAILS.md with its trigger. No hidden triggers.

G. Membership activation via payment (in scope — simple, one-way). Lifecycle: applied → in-review → approved → payment due → paid/active → profile publishable.
- Simple one-way subscription charge — Kathleen creates the Stripe Payment Link herself. No split, no Connect. Stripe processes the card.
- After admin approves, surface the payment step (link for the tier they applied under — Individuals $99/$149/$199; Studios $249/$499/$1,499 annual).
- Detect payment via a Stripe webhook (checkout.session.completed / subscription events) → flip membership_status to active; record stripe_customer_id, stripe_subscription_id, renewal_date.
- Gate on paid: a profile publishes / appears in search only when membership is active. Approved-but-unpaid = not discoverable.
- Handle unhappy paths: pending, failed, lapsed/canceled (→ inactive, unpublished but data retained), renewal.
Stripe setup notes: one Payment Link per tier (own Price ID each); map Price ID → tier in config; pass member user_id as client_reference_id; one webhook endpoint verifying the signing secret; keys in env vars; start in test mode. Founding Honorees 18 months free → $99/yr after (100%-off coupon or $0 link now).

---

## 5. Recommended stack (fresh build, founder-owned)
- Framework: Next.js (App Router, TypeScript).
- Database: PostgreSQL via Supabase (Postgres + auth + storage + RLS). Exportable, no lock-in.
- Auth: Supabase Auth (email magic-link + Google), role-based (talent, employer, admin).
- Media: Supabase Storage (or S3) for headshots/resumes; Vimeo (private) for video reels — never self-host video.
- Search: Postgres full-text + indexed filters; isolate the query layer to move to Meilisearch/Typesense/Algolia later.
- Email: Resend or Postmark — single sender, templated/versioned, no tangled automation.
- Hosting: Vercel (see Open Decision 1 — RESOLVED Vercel).
Keep secrets in env vars, never in the repo. Document every env var in README.md.

---

## 6. Explicitly OUT of scope for the 90 days (design the seams, don't build)
- Choreography Marketplace transaction engine (licensing, commissions, Audition Library commerce, take-rate/payout, split payments, Stripe Connect). The membership payment in 4G is NOT this.
- Swing/Flex per-use billing, verification-fee billing, Forum ticketing.
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
4. RESOLVED: Certified is RC-granted after ~60 days (from membership activation). Relevé's own stamp, distinct from peer ratings.
5. First 50 badge = first 50 approved applicants (badge attaches at paid activation). Silver sibling of the gold Founding 25 mark.

---

## 9. Working agreement for Claude Code
- Start by scaffolding the repo, README.md, DECISIONS.md, EMAILS.md, and the Postgres schema from Section 3 (including taxonomy tables).
- Then build VERTICALLY: one working slice first — talent signs up → builds a profile → publishes → it appears in employer search under the right categories. Prove that loop before breadth.
- Commit in small, described steps with a plain-English changelog a non-engineer can read.
- Write tests for onboarding emails and search/filter correctness.
- Surface every assumption. On an Open Decision, stop and ask — don't guess.
- Optimize for the founder being able to run `npm run dev`, see it work, and understand what changed.

*— together we rise —*
