# Relevé Connect — Member Platform Build Spec
## Canonical, handoff-ready source of truth for the Claude Code (Supabase/Stripe) build

*v2 — merged 2026-07-11. This edition folds in the pre-handoff analysis (Fortune-500 strategy, LinkedIn/Etsy/Facebook/Instagram, Marketing, and CEO+CFO reviews) so there is ONE contradiction-free document to build from. Companion docs: `Releve_Pricing_RATIFIED_2026-06-25_SINGLE_SOURCE_OF_TRUTH.md` (authoritative pricing — if any number here disagrees, that file wins), `Releve_Professional_Intake_Form_Spec_2026-05-20.md` (the vetting intake), and `Releve_Tech_Stack_and_Handoff_Brief_2026-07-09.md` (current build state). Supporting analysis: `Releve_Connect_PreHandoff_Analysis_2026-07-11.md`.*

---

## 0. How to use this document

This is the spec to hand to Claude Code. It describes **what** to build and **in what order**, and it protects the decisions that must not be simplified away. It does not restate the full pricing model — that lives in the pricing Single Source of Truth. Where this doc names a price, it matches that file as of 2026-07-11.

**Ground rules for the build:**
- Favor **managed, self-running services** (Supabase, Stripe, an SMS provider, MailerLite). The team is Kathleen + her children — no technician on staff. The operation must be clean and self-regulating.
- **Stripe is already built and verified** (subscriptions + Connect payouts, per the Tech brief). Do **not** rebuild it. Extend it per surface as each launches.
- **Annual billing only.** There is no monthly plan anywhere in the ratified model.
- **Do not reintroduce any "$10" price** — it is retired platform-wide (Swing is $20/use; the single-event/Forum ticket is $20).

---

## 1. Context & constraints

- **Brent's Phase-1 site retires via cutover.** When this platform is ready, `releveconnect.com` repoints to the new build and the old site retires that day. One clean switch, not a merge. Brent is not in on this build (kept hourly, on good terms, for institutional memory).
- **Relevé is a standards body, not a directory.** Nothing has value until there is a *vetted* roster of members. The human vetting gate (§4) is the spine of the product.
- **The profile is the product.** It is what the Professional tier sells — so it is built early, and built visual-first (§6).

---

## 2. Build sequence — the critical path

Build in this order. Each step depends on the ones before it. Stripe already runs underneath and is extended at each surface — it is **not** a first phase to build.

1. **Foundation** — Supabase auth (magic-link), the data model, roles-as-array (member/admin), and row-level security. (§3)
2. **The vetting gate + Admin approval** — application → Kathleen review → approve/tier → subscribe, with the $30 application fee and MailerLite tag firing. *The spine.* (§4)
3. **The Professional profile (gated at $149) + native uploads — visual-first.** This *is* the supply and the product. (§6)
4. **The Roster / directory search + directory hiring + the shareable public profile URL.** Makes supply discoverable and marketable. (§8)
5. **The Swing** — opt-in toggle, studio-posted slots, matching, notifications, studio-picks dispatch, and the two-way double-blind review loop. (§10–§11)
6. **Marketplace / Licensed Products** — choreography licensing, Senior Spotlight (Founding-gated first 6 months), Vimeo delivery, watermarked previews. Depends on approved choreographers existing. (§12)
7. **Later** — The Beat (casting), an Institution product *if ever ratified*, audit logs, availability calendars, mobile push. (§16)

**One-line reframe:** Gate → Identity/Supply → Discovery → Swing → Marketplace → the rest.

---

## 3. Foundation (data model, auth, roles)

- **Auth:** Supabase magic-link. Two principal roles: **member** and **admin** (Kathleen). Roles stored as an **array** on the user (a person can be Teacher + Choreographer + Studio Owner + Working Dancer).
- **Account type (ratified 2026-07-11):** `account_type` is a clean identity enum — **talent | employer | consumer | admin**. What a member *bought* (Live Pass, Studio Growth, Studio Accelerator, a Senior Spotlight license, Founding-25 status) lives in a **separate entitlements/roles layer — never baked into `account_type`.** So a new product never forces a schema change, and Live-Pass viewers (consumers) don't leak into Roster/vetting/Marketplace supply. *Note the two different $499s: **Studio Growth** is a recurring annual **subscription** (a `membership` on an `employer`); a **Senior Spotlight $499** is a one-time **marketplace product** purchase (an `experience_purchase`/order by a `consumer`). Same price, different objects, different tables — never one shared SKU.*
- **Row-level security** on every table; members read/write only their own records; admin sees all.
- **Core tables (minimum):** `profiles`, `roles`, `applications` (vetting), `subscriptions`, `swing_slots`, `swing_claims`, `gigs`, `reviews`, `products`/`listings`, `orders`, `licenses`, `notifications`.
- **Migration & cutover:** migrate Brent's Phase-1 assets that carry forward (The Climb / MailerLite subscribers, waitlist) and plan the `releveconnect.com` domain repoint. Treat the current Phase-1 site's instability as a real risk to sequence around.
- **Notification stack:** SMS + email + in-app now; **mobile push is later** (needs an app/PWA — do not block Swing on it).

---

## 4. The vetting gate & admin approval (the spine)

This is the moat and it must be built early — the ChatGPT doc omitted it entirely.

- **Application intake** — the professional intake (see the Intake Form Spec): identity, roles, story/philosophy (voice-based vetting), credentials in the member's own words, references (private), digital presence.
- **$30 application fee** — a commitment/quality filter, not a tax on labor. **Credited 100%** to the member's subscription if accepted and they join · **fully refunded** if not accepted · **forfeited only** if accepted and they decline to subscribe. There is **NO background check** (counsel-ratified). **Vetted performer/teacher tier only** — not Live Pass, not studios. **Waived for the Founding 25 choreographers** (invited honorees). **Copy rule:** always lead with "credited toward your membership / refunded if not accepted," never "pay $30 to apply."
- **Admin approval workflow** — pending queue (filter by role/date/location); full submission view with embedded previews of any submitted links/media; per-application actions: **Approve** (straight, for non-choreographers) / **Approve at tier** (Emerging / Established / Featured — only when Choreographer is in the roles array; Signature reserved for Founding Honorees) / **Assign honorific badge(s)** / **Request more info** / **Decline** ("not now" framing). MailerLite tag fires on action to trigger the correct welcome email.

---

## 5. Membership tiers & pricing (reconciled — annual only)

Prices are authoritative in the pricing Single Source of Truth; summarized here so the build matches it. **Annual billing only. No monthly SKUs. No "$10" anywhere.**

**Individual:**
- **Live Pass — $99/yr** — the door-opener: The Climb, The Beat access + pay-to-post, view the Roster, member events. **No built profile at this tier.**
- **Professional — $149/yr** — *+* the vetted Roster **profile** (the "build a profile" gate opens here), set own rate at/above the $50/hr floor.
- **Professional · Full — $199/yr** — *+* multi-role and the Marketplace + Audition Library (upload & license work).

**Studio:**
- **Studio Connect — $249/yr** — directory listing, community, 3 Swing uses included then $20/use.
- **Studio Growth — $499/yr** — *+* Swing included, Flex à la carte $250/run, 10 Beat postings/yr, Verified Employer badge, 12 Live Passes.
- **Studio Accelerator — $1,499/yr** — *+* unlimited Swing, 4 Flex runs included then $200/run, unlimited Beat postings, unlimited Roster, priority placement, 12 + 2 Live Passes, semi-annual founder 1:1.

**Other ratified revenue lines to wire (do not omit):** The Swing **$20/use** (studio-paid; teacher keeps 100% above the $50/hr floor); the **$30 application fee**; **Flex Series $250/run** ($200 overage at Accelerator after 4 included); **Stage Doors** ($499/yr studio license + $895 one-time teacher cert + $99/yr recert); **Advisory** (Growth Session $2,500 / Strategy Session floor $500); **Charter cohort** (first 50 studios: 50% off Year 1 across tiers, **Accelerator capped at ~10**; plus "Charter Faculty" — first 50 teacher/performers 50% off Year 1 on $149/$199) via the coupon system, Year-1-only; **Forum / single-event ticket $20**; **Marketplace 80/20** (artist keeps 80%; Stripe issues the artist's 1099-K).

**Do NOT build:** monthly billing; an "Institution Membership" tier (not ratified — leave out until a price + inclusions are set); a Founding-Honoree "$99 lifetime" price (not in the source of truth — confirm terms before building).

**Payments architecture:** Stripe Checkout/Billing for the six annual subscriptions + application fee + coupons is the minimum revenue engine. Stripe **Connect (Express)** for artist payouts and the 80/20 marketplace split, using **destination charges with `application_fee_amount`** so Relevé never holds artist money. Before any Connect payout code goes live: counsel sign-off on **marketplace-facilitator sales tax (NJ/NY)**, a **"digital licenses are final / no refunds"** policy, mandatory **W-9/TIN collection** at onboarding, and budgeted chargeback loss on digital goods.

---

## 6. The Professional (Teacher) profile — visual-first

The profile is gated at **Professional $149** (Live Pass has none). Build it **visual-first**, the way the dance industry actually hires (on Instagram) — not as a résumé database.

**Above-the-fold hero:** an autoplay-muted **vertical Teaching Reel** + **headshot**, name, roles, location, and **earned proof** (completed-Swing count + star rating). Text credentials live *below* the hero.

**Shareable public profile URL** (`releveconnect.com/[handle]`) — the member's "link in bio" that turns their existing Instagram into a Relevé funnel. Public visibility gated to Professional tier.

**Media (native, via Supabase Storage):** headshot upload (primary), an **8-image photo gallery rendered as a grid**, native **résumé/CV PDF** upload, and the **Teaching Reel** video link (Vimeo/YouTube) as the highest-value item (Choreography/Performance reels are role-conditional).

**Structured fields (searchable):** biography (~350 words), years as a professional, studios/companies/productions, notable credits, performance credits, college degrees, certifications (free-text **plus** structured filterable tags — ABT NTC, RAD, Cecchetti, Vaganova/Balanchine, PBT, Acrobatic Arts, Other), styles/genres, teaching levels (§ below), social links, location.

**Teaching levels — five, multi-select (confirmed 2026-07-11 — keep all five, incl. Advanced):** **Beginner · Intermediate · Advanced · Pre-Professional · Professional.** These match the DB-seeded five, so no collapse/migration is needed. A teacher checks only the levels they'll teach (so "no beginners" is handled by not checking Beginner). Studios filter on the same five. *Do not use age groups as a filter — age range is demographic-only, never a selection basis.*

**References are private** (admin-only vetting inputs) — never a public profile field.

**Swing availability toggle** — a member-controlled live control (§10).

---

## 7. Studio profile

Lighter than a teacher profile, but carries the practical fields a sub needs to decide "can I take this, and can I get there?"

- **Carried from intake:** studio name, website, city/state, year founded, student count (Under 100 / 100–299 / 300+), staff count, styles offered.
- **Full address + map pin** — drives Swing geo-matching and the accessibility block.
- **Getting there / accessibility:** nearest train line(s)/station, bus route(s), **car required?** (Y/N), **parking** (On-site / Street / None), optional directions note. *(A genuine differentiator no competitor has — surface it in discovery, §8.)*
- **Studio scale** (student count + optional room count), **concentration/focus** (multi-select: Competition · Technique/Recreational · Conservatory/Pre-Professional), **certifications valued/required** (same structured tags), **studio culture note.**

---

## 8. The Roster & discovery

- **The Roster** — a searchable directory of vetted, verified professionals with a **hiring portal** (directory hiring is a distinct channel from Swing — see §9). Categories: teachers, choreographers, studios, performers, college faculty.
- **Search built around real hiring intent** — style + teaching level + **distance from map pin** (radius, not just State — a northern-NJ sub serves NYC) + availability + optional certification. Elevate the **studio accessibility block** into discovery.
- **Keep the filter bar clean:** style, level, location/radius, availability, cert. Do **not** dump roles and honorifics (Master Teacher, Competition Judge, Artist in Residence) into the filter bar — those are different data types with different trust levels, and an honorific in a filter reads as a Relevé endorsement (violates §13). Add College-Faculty / Competition-Judge filters only after the intake captures that data.
- **Any "featured"/priority placement must be labeled as promotion** (Accelerator priority placement is a paid benefit — disclose it, Etsy/Instagram style).

---

## 9. The five surfaces (taxonomy — keep distinct)

The ChatGPT doc collapsed these; keep them separate:

1. **The Swing** — short-term **substitute** teaching. Studio pays **$20/use**; tiered inclusion.
2. **Flex Series** — **multi-week** placements/pilots. **$250/run** (separate product; not Swing).
3. **The Roster (directory hiring)** — season/ongoing staff hiring of teachers via the directory. Included in the Studio Subscription.
4. **Marketplace** — choreography **licensing** and the Audition Library (§12).
5. **The Beat** — **casting** of dancers/performers for gigs/auditions (poster-funded; the Backstage-for-dancers demand side). *Later phase.*

---

## 10. The Swing — sub-finder & matching

- **Opt-in is mandatory and member-controlled.** No teacher appears in Swing unless the **profile toggle** ("Available for Swing") is on; they can flip it off anytime. *This is a consent/control principle — do not make it ambient availability data.*
- **Swing fields (shown when the toggle is on):** styles available to sub, levels (four rungs), home location + travel radius, optional availability notes.
- **Pricing:** $20/use, studio-paid; teacher keeps 100% above the $50/hr floor; 3 included at Connect, included at Growth, unlimited at Accelerator. *No $10 anywhere.*
- **Matching & dispatch (self-regulating, no founder bottleneck):**
  1. A studio **posts an open sub slot directly** — date, time, location, style, level needed, pay, and an **optional required certification** (e.g. "ABT Certified only"). *(Sub calls are time-sensitive; the founder must not be a middleman.)*
  2. System matches only teachers who (a) have Swing on, (b) match style + level + geography, and (c) hold the required cert if specified.
  3. Matched teachers are **notified** (SMS + email + in-app).
  4. Teacher **taps to claim / express interest.**
  5. **Studio selects from responders** and confirms (not first-come — protects match quality, puts responsibility on the studio).
  6. Slot **locks**; other matched teachers notified it's filled.
  7. After the class date passes, the gig **auto-marks "complete"** → unlocks the two-way review (§11).

---

## 11. Reviews — the trust engine (do not downgrade to "ratings")

Two-way (teacher ↔ studio), tied to completed Swing gigs. This is what makes Swing self-regulating without a human referee.

1. **Unlocks only after a gig is marked complete.**
2. **Double-blind** — neither party sees the other's review until both submit, or a **7-day window** closes, whichever first. Prevents retaliation and inflation.
3. **Structured dimensions + optional comment**, rolled into a star rating on each profile:
   - Studio rates teacher: on time · professional · prepared · appropriate
   - Teacher rates studio: easy to work with · convenient location · paid promptly · would teach again

---

## 12. Marketplace / Licensed Products

- **Choreography licensing + the Audition Library** — artist uploads owned finished work; artist sets price; Relevé's fee is a disclosed line item; the artist can pull a listing anytime (Relevé never owns the work). **Split = earned ladder** (see pricing SSOT): **Emerging 60/40 · Established 70/30 · Signature 80/20**. **Tier is an admin-assigned field** (founder-reviewed annually + Founder's Discretion) — do **not** hardcode a numeric sales threshold for Emerging→Established. **Signature 80/20** = the **Founding 25** on their **Senior Spotlight + Competition** catalogs. **Legacy & Vanguard cohorts = Co-Productions** — split negotiated per project (TBD, do not hardcode).
- **Senior Spotlight** — reserved for **Founding Honoree Choreographers for the first 6 months**, opens to general approved choreographers in month 7. Build the gating.
- **Digital delivery + rights (harvested from the ChatGPT doc — good detail):** secure **Vimeo** integration, **watermarked previews**, explicit **license agreement** at checkout, instant delivery, purchase history. **Prefer protected streaming over downloads** to preserve rights.
- **Storefront on the profile** (Etsy-style) — a member's licensed pieces, Senior Spotlight solos, and open Swing slots merchandised on their profile, with the star rating as a purchase driver — not siloed in a separate tab.

---

## 13. Badges & verification (no-endorsement)

Two clearly distinct classes; never blur them:

1. **One identity/membership mark — "Verified Member"** (replaces the old "Certified" naming, ratified 2026-07-11). **Granted immediately once vetting is complete — approved (documentation-authenticity check passed) AND paid — with no waiting period** (founder decision 2026-07-12, supersedes the earlier "~60-day tenure window"). Applies to Professional-tier members who passed the intake. Means *this is a real, vetted, active member* (identity/standing), **never** a competence or program endorsement. *Renamed from "Established Member" to avoid colliding with the Marketplace "Established" tier.*
2. **Honorifics** (Verified Artist, Founding Artist, Master Teacher, Stage Doors Educator, Adaptive Arts Faculty) — **editorial recognition conferred by Kathleen, never self-selected.** Render as curation/recognition, visually separate from the identity mark.

**Hard rules (ratified no-endorsement / no-background-check):** delete the phrase "Verified Credentials." Credential tags are **"self-reported / searchable, not endorsed."** Never put a checkmark on a competence claim. Studios get a **Verified Employer** badge (Growth tier).

---

## 14. Minors, consent & media release

Dance teaching is teaching minors; teaching reels and studio content will contain minors. Every profile, video, and marketplace surface must carry:
- **Media-release + Code-of-Conduct consent** (carried from intake) before any reel/photo/studio content is displayed or licensed.
- **Parental-consent handling** for minors; plain-language privacy; **removal rights for every member**; no sale of member data; minimal retention.

---

## 15. Administrative console

Build what Stripe's native dashboard can't cover; lean on Stripe for revenue/reporting in Year 1.
- **Vetting/ops (build):** pending-application queue, full submission view, approve / approve-at-tier / honorific / request-info / decline actions, MailerLite tag firing, internal notes, CSV export, Swing dispatch oversight, application-fee credit tracking, Charter-slot tracking.
- **Harvest selectively (later):** revenue dashboard, membership management, studio management, catalog/orders/licenses, featured artists, audit logs.
- **Do not rebuild:** newsletter tooling (The Climb runs on MailerLite).

---

## 16. Deferred (not in the first cut)

Institution Membership (unpriced) · monthly billing · residencies / guest artists / master classes / college prep / progress review / music package (undefined, several rights-heavy) · availability calendar · digital downloads · Competition-Judge/College-Faculty filters (no data captured yet) · The Beat casting channel · mobile push notifications · full analytics + audit logs.

---

## 17. Guardrails — do NOT simplify these

For Claude Code: these are hard-won, deliberate decisions. Do not "simplify" them into the more obvious version.
- **Two-way, double-blind, 7-day-reveal reviews** — not one-directional ratings.
- **The member-controlled opt-in Swing toggle** — not ambient availability.
- **Studio-picks-from-responders + direct posting** — not first-come, not founder-mediated.
- **No-endorsement / no-background-check** — credentials in the member's own voice; tags searchable-not-endorsed; honorifics conferred by Kathleen only.
- **Profile gated at Professional $149** — Live Pass $99 has none