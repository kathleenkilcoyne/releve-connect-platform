# Decisions Log

A plain-English record of every meaningful decision on Relevé Connect — what we
decided, when, and why. Newest entries at the top. This exists so that months from
now (or a future engineer) can understand *why* the project is the way it is.

---

## 2026-07-24 — Stable V1: three clean paths (Professionals · Studios · Families)

**Decided (Kathleen, `V1-THREE-PATHS-FROM-KATHLEEN.md`):** One platform, three experiences —
three audiences, three verbs. **Professionals Apply · Studios Partner · Families Join.** Lay
the extensible foundations now; keep the family *feature set* lean. No DNS/domain work, no
payments, no self-serve studio signup, no public minor profiles — all deferred, not foreclosed.

**What shipped:**
1. **Homepage "Build your future." block** (under the trillions-of-stars hero) — three paths,
   verbatim copy. The professional **Apply** stays the dominant, gold/filled CTA; Studios and
   Families are quieter outlines so no visitor mistakes which door is theirs.
2. **Studios path = interest form, not self-serve.** New `/studios` "Become a Founding Studio"
   page → `studio_interest` table + an email alert to `ADMIN_ALERT_EMAIL` (EMAILS.md #11).
   **No studio account or billing is created** — Kathleen onboards the pilots by hand. The old
   self-serve `/studio` + `/studio/edit` are left intact (her white-glove tools) but are no
   longer the front-door link; the homepage/nav/footer "Studios" now point to `/studios`.
3. **Families path = `/join`, studio-gated at the DATA LAYER.** New `studio_invites` table maps
   a code → a participating studio. `/join` collects the code, hands off to the existing 8-digit
   sign-in (carrying the code through `?next=`), then `joinThroughStudio` creates the guardian
   account + `family_account` + `student` + `guardianship` (with COPPA consent stamped) +
   studio `affiliation`, and lands them in the family dashboard (`/this-week`). **Open family
   signup is impossible** — nothing is created without a valid, active invite code. All writes
   run under the service role (validated authenticated user + validated code), which also lets
   the guardian create the studio affiliation their own RLS correctly forbids.
4. **Dashboard-by-role routing.** `resolveSignedInDestination` now sends a family guardian (no
   talent profile, owns a family account or holds a guardianship) to `/this-week`; professionals
   still go to the profile builder, admins to the vetting console — one login, different surface.
5. **Reused, not rebuilt:** the existing family layer (`family_accounts`/`students`/
   `guardianships`, the 2026-07-17 migration), the `ThisWeekScreen`/Ava-Student model, and the
   OTP sign-in. Nothing that worked was renamed or restructured.

**Seed for testing:** a demo pilot studio ("Founding Pilot Studio (demo)", owned by Kathleen)
+ invite code **`PILOT-2026`**, so `/join` is exercisable end-to-end. Delete or rename freely.

**Kathleen's professional profile** was already approved + active membership + published, so
requirement 3 ("prove one profile end-to-end") needed no flip — her `/this-week` renders her
live professional dashboard.

---

## 2026-07-22 — The Swing and The Flex Series are WITHHELD, not paused

**Decided (Kathleen):** Pull The Swing and The Flex Series off the public site, and lead
with licensing instead. **This is a monetization decision, not a deprioritization.**

**Her framing, which governs how to read every line below:**
> *"Nothing on the build is wasted. It is just not now until demand is proven. Licensing is
> the feature of RC for now."*

Three things follow from that, and they are the standing rule until she says otherwise:
1. **Nothing built for Swing/Flex/The Beat is dead code.** The schema, the RLS, the opt-in,
   the availability tables — all of it is banked, not abandoned. Do not delete, do not
   "clean up," do not migrate away from it.
2. **Sequencing is demand-gated, not calendar-gated.** These features come forward when
   demand is *proven*, not when a date arrives. "Later" here means "once we can see people
   want it," which is a decision Kathleen makes on evidence.
3. **Licensing is THE feature of Relevé Connect for now.** Singular. When something competes
   for the front door, for build time, or for the story — licensing wins by default until
   she changes it.

**Why — in her words:** The Swing is the biggest feature we have for studios. It is the
staffing agency behind Relevé Connect; Flex is a pilot program alongside it. We fill for
studios and provide teachers. **We are currently free.** If we give away our single best
studio feature for free, it is very anticlimactic to then pull the trigger on a
subscription.

**Why this is structurally right, not just instinct.** Checked against the pricing SSOT
(`docs/Releve_Pricing_RATIFIED_2026-06-25_...`, §Studios): Swing and Flex ARE the studio
ladder.

| Tier | What the money actually buys |
| --- | --- |
| Studio Connect $249 | **3 Swing uses**, then $20/use |
| Studio Growth $499 | **Swing included**, Flex à la carte $250/run |
| Studio Accelerator $1,499 | **Unlimited Swing**, 4 Flex runs/yr included, then $200/run |

Remove Swing and Flex and the three tiers collapse into each other: Connect is a directory
listing, Growth is a directory listing plus 10 Beat postings, Accelerator is that plus a
1:1. There is no ladder left to climb and nothing to convert on. **Giving Swing away during
the free period would spend the entire studio pricing model before it ever earns a dollar.**

**Consistent with the no-tax-on-labor guardrail.** Swing's $20/use is paid by the STUDIO;
the teacher keeps 100% above the $50/hr floor (pricing SSOT). Charging for Swing access is
an infrastructure fee on the employer, never a cut of the teacher's wage.

### The supply/demand asymmetry — the part that decides what stays live

The two sides of Swing have opposite economics while the platform is free:

- **Teacher side (opt-in availability) — KEEP LIVE AND FREE.** Every teacher who opts in is
  *inventory you own before you charge anyone*. It costs nothing to collect and it is the
  thing that makes the paid studio product work on day one. A staffing agency with no
  staff cannot sell a shift. This is supply-seeding, not giving the product away.
- **Studio side (find, match, book a sub) — THIS is the product.** It stays unbuilt/behind
  the paywall. It is the conversion lever.

**Therefore:** the profile-editor Swing opt-in, the `/apply` "available to substitute"
question, and the `swing_availability` tables all **stay exactly as they are** — they are
the free half that makes the paid half viable. Only the *public marketing* of Swing came
down.

**Reversal of an earlier recommendation (2026-07-22, same day):** I had told Kathleen to
disable the `open_to_badges` row *"Substituting via The Swing"* on the application form.
**That advice was wrong under this strategy** and is withdrawn — that checkbox is
supply-capture, and every applicant who ticks it is free inventory. It should STAY. (The
sibling row "Auditioning via The Beat" is the same argument and also stays.)

**One promise risk to manage:** teachers can opt into Swing today, but no studio can book
them yet, and now won't be able to for a while. The opt-in copy must not imply work is
imminent. Current wording ("Opt in to be matched when a studio needs a last-minute
substitute") is forward-looking and does not promise timing — acceptable, but a small
"not live yet" note there would be honest. Not yet done; flagged.

**Flex is a PILOT.** Pilots run privately with hand-picked studios, not on a public
marketing page. Nothing about pulling it off the site changes its roadmap position.

**What this answers:** the open question left in `RESUME-HERE.md` — "is The Swing paused or
just quiet?" — is answered **neither**. It is *withheld*: finished when it is time to sell
it, and deliberately not given away before then.

---

## 2026-07-11 — Reconciled the repo brief to the ratified 2026-07-11 specs

**Decided:** The two files in `/docs` are the source of truth — `Releve_Connect_Member_Platform_Build_Spec_2026-07-11.md` (what / what-order) and `Releve_Pricing_RATIFIED_2026-06-25_SINGLE_SOURCE_OF_TRUTH.md` (pricing). Where `CLAUDE.md` or this log disagreed, the specs win. Fixed per `docs/RECONCILIATION-NOTE-2026-07-11.md`:

- **Tier names** → ratified: Individuals **Live Pass $99 / Professional $149 / Professional·Full $199**; Studios **Studio Connect $249 / Studio Growth $499 / Studio Accelerator $1,499**. Prices already matched — only names changed. Retired "Access / Signature Pro / Base" ("Signature Pro" collided with the choreographer *Signature* Marketplace status).
- **Charter cohorts** → replaced the stale "First 50 Studios (Accelerator-only 50% off) / First 100 Artists (rate locked for life)" with **Charter Studios** (first 50; 50% off Year 1 **across all tiers**; Accelerator **capped ~10**; **not** lifetime) and **Charter Faculty** (first 50 teacher/performers; 50% off Year 1 on $149/$199; **not** lifetime). Accelerator is **$1,499** (not $1,500).
- **Scope** → the Marketplace engine, Stripe Connect / splits, and Swing/Flex are **no longer out of scope**; build spec §2 is the roadmap (Gate → Profile → Roster → Swing → Reviews → Marketplace). Memberships stay a simple one-way charge; only artist payouts / the Marketplace use Connect.
- **NEW: $30 application fee** (the vetting-gate spine) — vetted performer/teacher tier only (not Live Pass, not studios); **credited 100% to membership if accepted / refunded if not / forfeited only if accepted-then-declines; waived for the Founding 25.** Public copy leads with "credited/refunded," never "pay to apply." Replaces the retired "verification fee." No background check.

**Not changed (working, tested):** the $499 Signature Experience on Stripe Connect (80/20, founder no-split, refund→revoke) stays as-is per the reconciliation note.

**Resolved by Kathleen 2026-07-11 (cleared to build):**
- **Account type** → add **`consumer`**: `talent | employer | consumer | admin`. What someone *bought* (Live Pass, Growth, Accelerator, Senior Spotlight license, Founding-25) lives in a separate **entitlements/roles** layer (`memberships`, `experience_purchases`, `founder_distinction`) — **never** in `account_type`. The two $499s are **different objects**: **Studio Growth** = recurring subscription (`memberships`, employer) vs. **Senior Spotlight $499** = one-time marketplace product (`experience_purchases`, consumer). Different tables, never one SKU.
- **Teaching levels** → **keep all five** as seeded (Beginner, Intermediate, Advanced, Pre-Professional, Professional). No collapse, no migration.
- **Email vendor** → **Resend**.
- **Founding-25 Honoree terms** → **18 months free, then $99/yr for life**; permanent **Signature** marketplace tier (80/20 on Senior Spotlight + Competition); **$30 application fee waived**.
- **Marketplace split** → an **earned ladder**, *not* flat 80/20: **Emerging 60/40 → Established 70/30** (admin-assigned, founder-reviewed; sales threshold **TBD, not hardcoded**) **→ Signature 80/20** (Founding 25). **Legacy & Vanguard = Co-Productions**, split per project (**TBD, not hardcoded**). *(My earlier "flat 80/20" flag was wrong — the ladder is intentional.)*
- **"Certified" mark → renamed "Verified Member"** — an identity/standing mark (real, vetted, active member); granted immediately at profile creation once vetting is complete (approved + paid), no waiting period *(founder decision 2026-07-12; supersedes the earlier ~60-day trigger)*; drop any wording implying RC vouches for skill.

**Still TBD (do not guess — ask Kathleen):** the **Established** sales threshold, and the **Legacy/Vanguard** co-production splits.

---

## 2026-07-08 — Admin console to create + publish Signature Works

**Done:** Built `/admin/signature-works` so the founder can drive the whole Stripe flow
without hand-writing SQL: quick-add a (test) artist, create a $499 signature_work with all
its fields, and publish/unpublish it. Each work links straight to its `/experiences/[id]`
page to run a test purchase.

**Decided — gate the admin writes with a shared secret (`ADMIN_TOKEN`), fail-closed.**
The app has no login yet, and these routes write with the service-role key (they bypass RLS),
so leaving them open would be unsafe if ever deployed. Until real admin auth exists, the
`/api/admin/*` routes require an `x-admin-token` header matching `ADMIN_TOKEN`; if that env var
isn't set, every admin write is refused. A random `ADMIN_TOKEN` was generated into `.env.local`.

**Note — the "quick-add artist" helper makes an orphan `users` row** (a generated id not tied
to a Supabase auth login) plus a `talent_profile`. That's fine for a founder/test artist who
never signs in as that profile (e.g. Kathleen's own no-split works). Real artist profiles will
come from the approved-application flow with a genuine auth user — this helper is a test
convenience, not the production path.

---

## 2026-07-08 — Built the $499 Signature Experience (Stripe Connect, Express)

**Done:** Built the licensing flow from `docs/STRIPE-CONNECT-499-LICENSING.md` — the
backend engine + minimal UI. A buyer purchases a $499 Signature Experience; the money
runs through **Stripe Connect (Express)** as a **destination charge**: 80% ($399.20) to
the choreographer's connected account, 20% ($99.80) to Relevé as an application fee. On
success the buyer gets a free Year-1 Access membership and the gated page (private Vimeo
+ count sheet + booking links) unlocks.

What shipped:
- **DB** (`supabase/migrations/20260708120000_…sql`): `stripe_account_id` + `payouts_enabled`
  on `talent_profiles`; new `signature_works` and `experience_purchases` tables; a `source`
  column on `memberships`; RLS (published works are public-readable, purchases are
  service-role-write only). `schema.sql` updated to match.
- **Flow A** — artist Express onboarding: `POST /api/connect/onboard` + `/return` + `/refresh`,
  and a `/connect/payouts` page. `account.updated` webhook flips `payouts_enabled`.
- **Flow B** — `POST /api/experiences/[id]/checkout`: destination-charge Checkout Session,
  plus a **founder no-split path** for works Kathleen sells herself (100% hers).
- **Flow C** — `POST /api/webhooks/stripe`: verifies the signature, marks the purchase paid,
  creates/attaches the buyer's Access account, grants access, and fires the notification seams.
  Also handles `payment_intent.payment_failed` and `charge.refunded` (revokes access).
- **Gating** — `/experiences/[id]` shows a paywall or the unlocked deliverables.

**Why this is allowed despite CLAUDE.md §6 ("no Stripe Connect in the 90 days"):** the spec
(dated 2026-07-08, newer than §6) is a deliberate, scoped exception. The 20% is a *marketplace
take on a product* (a choreography license), which is exactly the revenue CLAUDE.md §1 endorses
("the marketplace take on choreography") — **not** a cut of anyone's wage, so Guardrail #1
(no-tax-on-labor) holds. Memberships stay simple one-way charges; only this $499 flow uses Connect.

**Decided — founder no-split path via `FOUNDER_PROFILE_ID`:** rather than infer "Kathleen's own
work," profile ids listed in that env var sell at 100% (no `transfer_data`/`application_fee`).
Everyone else must finish Express onboarding first (Guardrail: can't sell until `payouts_enabled`).

**Fixed — `.env.local` key mix-up:** the `sk_test_…` secret key had been pasted into
`STRIPE_WEBHOOK_SIGNING_SECRET`. Moved it to `STRIPE_SECRET_KEY`; left the webhook secret empty
(it's a separate `whsec_…` value from the Stripe dashboard).

### Open questions / inputs still needed before this is fully live
- [ ] **`SUPABASE_SECRET_KEY`** must be set in `.env.local` — the webhook writes as the
      service role (creates the buyer account + membership). It's currently commented out.
- [ ] **Email vendor** (Resend vs Postmark) — buyer confirmation (EMAILS.md #9) is a working
      seam that logs the payload; it won't actually send until this is chosen and wired.
- [ ] **Booking link URLs** — `FOUNDER_WELCOME_BOOKING_URL` (Kathleen's Google Calendar) and
      `DEFAULT_CHECKIN_BOOKING_URL`. The unlocked page/email link to them once set.
- [ ] **MailerLite "The Climb"** — `MAILERLITE_API_KEY` + `MAILERLITE_CLIMB_GROUP_ID` (optional).
- [ ] **Buyer account type** — a $499 buyer is an individual "Access" member, but the `users`
      table only has `talent | employer | admin`. Buyers are filed as `talent` for now.
      Confirm whether a dedicated member/consumer type is wanted.
- [ ] **Gating vs. auth** — access is currently proven via the Stripe `session_id` on the
      success page (works with no login). The durable gate (a signed-in buyer with a paid
      purchase) is coded and waiting on Supabase Auth being wired.

---

## 2026-07-01 — Database is LIVE ✅ (Step 3 complete)

**Done:** Kathleen created her Supabase project, added keys to `.env.local`, and
ran `supabase/setup.sql`. Verified live: all 14 tables exist and the category
lists loaded (15 styles, 5 levels, 11 focus areas, 4 roles, 8 open-to badges).
The app connects successfully with the publishable key.

**Note:** Table creation (DDL) can't be done with app keys by design, so Kathleen
ran the SQL in the Supabase dashboard herself — the secure path. Secret key not
needed yet (only for later webhooks/admin).

---

## 2026-07-01 — Database connection code (Step 3, path A chosen)

**Decided:** Kathleen chose to set up Supabase now (path A). While she runs the
setup guide, built the code side so the app connects the moment keys are added:
- Installed `@supabase/supabase-js` and `@supabase/ssr`.
- Added connection helpers in `src/lib/supabase/` — `client.ts` (browser),
  `server.ts` (server), `admin.ts` (privileged, server-only for webhooks/admin).
- Added a `/setup-check` page: a green/red screen to confirm the database is
  connected and the category lists loaded — so verifying isn't a technical task.
**Why:** Lets setup and coding happen in parallel; nothing here needs her account.

---

## 2026-07-01 — Website skeleton + database prep

**Decided:** Scaffolded the Next.js website (Step 2). Confirmed it builds and runs.

**Decided:** Prepared the database groundwork *without* creating any account yet —
`.env.example` (settings template), `supabase/seed.sql` (starter category lists),
and `docs/SETUP-SUPABASE.md` (a click-by-click guide).
**Why:** Creating the Supabase account is tied to Kathleen's email/billing and it
owns all the data (Guardrail #4), so she does that step. This prep means it's fast
and painless when she's ready — no product decisions made in the meantime.

**Pending Kathleen's choice:** whether to (a) set up Supabase now, or (b) build the
screens against sample data first and wire the database after. Asked; awaiting reply.

---

## 2026-07-01 — Project kickoff & foundation

**Decided:** Start a fresh, founder-owned codebase for the 90-day Profile System build.
**Why:** The prior contractor build lives on Netlify from GitHub repo
`kathleenkilcoyne/releve-platform`. This is a clean new repo — no code migration.
Keep the old site live until we cut over, then re-point the domain.

**Decided:** The technology stack — Next.js + Supabase (Postgres) + Vercel + Vimeo + Resend/Postmark.
**Why:** Modern, well-supported, exportable, and no vendor lock-in. See `CLAUDE.md` Section 5.

**Decided:** Build order is a single vertical slice first — talent signs up → builds a
profile → publishes → appears in employer search under the right categories — before
adding breadth.
**Why:** Proves the core loop works end to end before we spread effort.

---

## Resolved open decisions (carried in from CLAUDE.md Section 8)

These were settled before the build began. Recorded here so they're not re-litigated.

1. **Hosting = Vercel.** Fresh clean repo on Vercel. Old Netlify site stays live until cutover.
2. **First contact = lean in-app intro request** (not "reveal contact info"). First
   contact routes through Relevé and is stored as a connection record; talent gets an
   email notification and can respond. Contact details private by default. **No full
   chat inbox now** — just this one seam.
3. **Category vocabularies** — reuse the starter lists in `CLAUDE.md` Section 3A.
   ⚠️ *Still needs Kathleen's final confirmation of the exact lists before launch.*
4. **Verified Member mark** *(renamed from "Certified" 2026-07-11)* = RC-granted **immediately at
   profile creation once vetting is complete — approved (documentation-authenticity check passed)
   AND paid — with no waiting period** *(founder decision 2026-07-12; supersedes the earlier "~60 days
   from activation")*. An **identity / standing** mark (real, vetted, active member) — **not** a
   competence stamp; RC never vouches for skill (no-endorsement).
5. **Charter cohort badges** (revised 2026-07-11) = **Charter Studios** (first 50 founding
   studios) and **Charter Faculty** (first 50 founding teacher/performers); each is 50% off
   Year 1 (**not** lifetime), badge attaches at paid activation. Silver siblings of the gold
   "Founding 25" mark. *(Supersedes the earlier single "first 50 approved applicants" badge.)*

---

## Open questions still needing Kathleen's input

- [x] **Teaching levels** (2026-07-11): keep all five as seeded — no change. Styles / focus
      areas / regions final lists still to confirm before launch.
- [x] **Email vendor** (2026-07-11): **Resend**.
- [ ] **Still TBD:** the Established sales threshold, and the Legacy/Vanguard co-production splits.

## 2026-07-13 — Studio accounts (the studio side of The Swing)

- **Studio sign-up = light onboarding** (Kathleen, 2026-07-13): studios are the buyer/customer side, not vetted talent, so **no $30 application fee and no admin approval queue.** They sign in (magic link) and fill a §7 studio profile; the `employer` account + `employer_profiles` row are created on first save at `/studio/edit`. Rationale: the vetting gate exists to protect the *talent* supply's credibility; the studio is the demand side and gatekeeping it only adds friction to the buyer. (A later "Verified Employer" badge — Growth tier — remains admin-set, separate from sign-up.)
- **Map pin = store-address-now, geocode-later** (Kathleen, 2026-07-13): the §7 studio address is captured now; `employer_profiles.lat`/`lng`/`geocoded_at` columns exist but stay NULL until a geocoding provider is wired in a later slice. Same "build the column, fill it later" pattern as the profile earned-proof slot. The deferred **map-pin radius** search (§8) and Swing geo-matching (§10) light up once lat/lng are populated; until then Swing matching stays coarse (city/state).
- **Studio concentration is its own vocab** (`studio_concentrations`: Competition · Technique/Recreational · Conservatory/Pre-Professional) — deliberately separate from the choreographer `focus_areas` list, which means something different.

## 2026-07-13 — The Beat, hiring-side schema (build)

- **Scope built = HIRING motion only** (post a role → apply): taxonomy + postings + partner packages + transactions + RLS. NO UI, NO Stripe flow (Stripe columns placeholder/null). The **self-marketing / service motion** (coaching, photography, creative & production services, accompanists) is **gated behind §D** (inside The Beat vs a separate vetted directory) — not built, and the gated **service families are not seeded**. The two-level taxonomy serves either outcome, so building it now commits us to nothing.
- **`opportunity_type` split (ratified §B) implemented as** a small stable `beat_engagement_type` enum (`audition | employment | freelance_gig | other`). All subject/lane meaning lives in the admin-managed `beat_categories` → `beat_subcategories` taxonomy. New families = data rows, no deploy.
- **Naming deviation from the plan's `employer_id`:** posters/holders/payers are `poster_user_id` / `holder_user_id` / `payer_user_id` → `users(user_id)`. Neutral on purpose — a poster may be a studio OR an individual member (the plan's "employer_id" was a Clerk-era artifact; `_user_id` matches repo conventions like `owner_user_id`).
- **Multiple subcategories per post** → join table `beat_posting_subcategories` (§E.6, ratified).
- **Setting deferred (§E.1):** no setting axis. Film/TV, Cruise, Theme Park are **subcategories** under Auditions & Company. The planned future cross-cutting filter is **union vs non-union** — a posting attribute to add later as a nullable column; designed-for, NOT built.
- **Studio annual included-post allowance (§A.1) = policy, not a column:** included posts are `posting_type='studio_included'`; the annual cap is enforced at post/checkout time by counting a studio's studio_included posts within its current membership year. Resets annually.
- **Money in cents** (`amount_cents`), matching `memberships.price_cents`.
- **RLS:** active postings world-readable (job seekers browse); poster manages own rows incl. drafts; partner packages + transactions private to owner; taxonomy public-read / admin-writes. Verified live by simulating anon / poster / other-user roles.

## 2026-07-24 — Profile builder revisions + the Availability facet

*From PROFILE-REVISIONS-FROM-KATHLEEN.md.*

- **Everything a studio might search on is a structured tag, not free text** (Kathleen, 2026-07-24).
  The test case: *"Show me Jazz teachers within 20 miles, available weekends, CPR-certified."* Styles,
  focus areas, certifications and now availability are all controlled vocabularies with join tables
  and a `roster_profiles` array column. Capturing it structured now is nearly free; retrofitting it
  onto real member data later is a migration. This is the same spine The Swing will match on.
- **One `availability_tags` table, two `kind`s** — `general` (Saturdays · Weekends · Summers Only ·
  Willing to Travel · Virtual Available) and `currently` (Accepting Choreography · Accepting Master
  Classes · Available for Adjudication · Available for Guest Teaching). Two headings in the UI, ONE
  facet in the filter, because they filter identically and a studio combining them wants a single
  ANY-within / AND-across rule. The `currently` four are deliberately **not** booleans on
  `talent_profiles`: a studio searching "choreographers accepting commissions" wants a facet that
  behaves exactly like Style, not a special case.
- **`teaching_at` / `touring_with` stay free text** — a specific employer name is a fact about one
  person, not a facet anyone would filter by. They render as a sentence on the public profile.
- **The Swing opt-in form is REMOVED from the builder** (§7), replaced by one line: *"You will
  receive opportunities when Swing launches."* Nothing consumed that data — the studio side isn't
  built and, per 2026-07-22, Swing is the paid studio product and isn't being given away during the
  free period. Asking for availability nothing acts on is a chore with no payoff.
  **The existing `swing_availability` / `swing_styles` / `swing_levels` rows are left UNTOUCHED** —
  the save action no longer writes them, precisely so it can't erase what members already entered.
  `buildSwingAvailabilityRow` and its tests stay as the spec for when Swing ships.
  ⚠️ **Consequence:** travel radius / home base are no longer captured anywhere. HANDOFF §1.2's
  structured geocoded location is now the only planned source for Swing distance matching.
- **"Teaching Reel" → "Featured Video"** (§2) — not everyone on the Roster teaches. Label only; the
  `teaching_reel_url` column keeps its name (renaming it would be churn for no gain).
- **Publish → "Ready to Join the Relevé Roster"** (§10), default OFF. Same `profile_status` values.
- **Heading "Create your profile" → "Welcome to the Relevé Roster"** for a first-time member; a
  returning member still sees "Edit your profile".

## 2026-08-15 — Professional Services (another way I serve the dance community)

*From the founder brief "RELEVÉ PROFESSIONAL PROFILE — ADD 'PROFESSIONAL SERVICES' MODULE".*

- **A Service is NOT an Offering, so it gets its own table.** `professional_offerings` is what you do
  as a dance professional ("What I Offer"). `professional_services` is a *separate business you run* —
  massage therapy, physical therapy, Pilates, photography, costume design, music editing,
  accompanying. Different fields (business identity, business card/logo, category taxonomy, business
  contact), different section, different meaning. Merging them would have blurred both. Everything
  else deliberately MIRRORS Offerings — pure lib + flag + owner-scoped workspace + public section —
  so the two feel like one product and the patterns stay learnable.
- **It is part of the profile, never advertising.** No "Sponsored", no "Advertisement", no ranking,
  no boosting, no placement anyone can buy, and Relevé takes **no cut** of anything a member earns
  from these businesses (guardrail §7.1). It sits BELOW the dance identity and Relevé offerings and
  ABOVE contact/social, so it complements the dance profile rather than competing with it.
- **`category` is a controlled vocabulary, indexed now, filtered later.** Fourteen categories as
  CHECK-constrained text (mirrored by `SERVICE_CATEGORIES` in TS), with a partial index on
  `(category) where displayed`. The founder asked for search-readiness, not a marketplace page —
  so the future Roster facet is a query change, not a schema change. **No separate services
  directory route was built.**
- **Contact details are private by default and stripped on the SERVER.** `business_email` /
  `business_phone` are stored so a member keeps them on file; `show_email` / `show_phone` default
  **false**. `toPublicService()` nulls anything not opted into *before* the row leaves the server, so
  a private number is never sent to the browser and hidden with CSS. A `show_*` flag with nothing to
  show is forced back to false (validation), so the profile can never claim to publish a blank.
- **URL safety:** every external link is normalized and validated http(s)-only. A bare domain
  ("mcareebodywork.com") is upgraded to https; anything carrying an explicit non-http scheme
  (`javascript:`, `data:`) is **rejected, never coerced**. All outbound links render with
  `rel="noopener noreferrer nofollow"` and `target="_blank"`. Member prose is markup-stripped at
  save time as well as escaped at render.
- **Button rules (founder spec §2):** Booking link → **Book**; else website → **Visit Website**; else
  published contact → **Contact**; else no button. A label override changes the WORDS only, never the
  destination. The business card image is clickable only when a website/booking URL exists.
- **"Accompanist / Class Musician" is one category today, with real columns — the musicians seam.**
  `instrument`, `accompanist_for` (text[] + GIN index), `rate_display` / `rate_contact`, `media_url`.
  Structured, not JSON, precisely so musicians can later become their own full Relevé professional
  category and The Swing can match "studio needs a vetted ballet pianist Thursday" **without a
  rebuild or a data migration**. No Musicians Roster was built. Rate is always the musician's own —
  Relevé never sets it (contrast: the Swing's $50/hr platform constant).
- **Moderation is a seam, not a workflow.** `moderation_status` (`ok | flagged | removed`) exists and
  is enforced on the public read from day one, defaulting to `ok`. The founder does not want
  per-service approval yet; adding it later means writing to a column that already gates the render.
  The admin console shows every service a member entered — including hidden ones and unpublished
  contact details — read-only, because reviewing means reading what they actually wrote.
- **Flag-gated OFF (`PROFESSIONAL_SERVICES_ENABLED`), like Offerings.** With the flag off, no
  doorway renders, no extra query runs on the public profile or the profile editor or the admin
  console, and the server actions refuse. A profile with no services is byte-for-byte unchanged.
- **The editor gets a doorway, not more fields.** Services are repeatable records with their own
  media and links, so they live at `/profile/services` (same shape as Offerings) and the profile form
  shows an optional "Professional Services" section linking to it. **Nothing about a Professional
  Service is required to complete a Relevé profile.**

## 2026-08-15 — Professional Services bookings happen ON Relevé

*Founder decision, mid-build: Professional Services is on-platform commerce, not an outbound directory.*

- **The external Booking Link is GONE as a booking pathway.** Sending a ready-to-buy visitor to
  someone's Calendly took the booking, the money, AND the record of the work off Relevé at the first
  click — which made the intended flow impossible. The `booking_url` column was dropped (0 rows, 0
  dependents) rather than left dormant, because a dead column is an open invitation to re-add the
  outbound button. **Website and social links stay** — identity and credibility, not a booking path.
  A stored `cta_label = 'book'` can no longer label an outbound link either (`externalLabel()`).
- **The public CTA is "Book on Relevé"**, rendered as a DISABLED coming-soon button until the rail
  ships. A button that lies is worse than no button.
- **Intended flow:** Professional Profile → Professional Service → Relevé availability → Book on
  Relevé → Relevé checkout/payment → professional payout + configurable platform fee.

### The privacy architecture (founder-ratified)

> This Week / personal_events (PRIVATE) → professional publishes a chosen window → service_availability (PUBLIC) → Book on Relevé

- **The booking system NEVER reads a professional's private calendar.** Not "respects a policy" —
  there is no code path to `personal_events` at all. `personal_events` is unchanged: no new column,
  no policy change, still owner-only.
- **Publishing is an INSERT into a different table, not a flag.** The founder's constraint was that
  "a private event should never become public merely because of a flag mistake." A boolean can be
  flipped by a bad UPDATE, a careless upsert, or a mis-scoped script; a separate table cannot be
  exposed by accident, because *nothing about personal_events changes when a window is published*.
- **Only start/end/timezone cross the boundary.** Never title, note, location, category, or
  attachments — an audition or a medical appointment stays invisible even when the hours around it
  are published. `source_personal_event_id` records provenance for the OWNER's editor only.
- **Only OPEN windows are public.** A booked or cancelled window is not publicly readable, because
  publishing "she's busy every Tuesday at 4" is the same leak by another route.
- **⚠️ REVOKE BEFORE GRANT — found by testing the live result, not by trusting the SQL.** This
  project carries Supabase's default privileges, which already grant ALL columns on every new
  public-schema table to `anon`/`authenticated`. A narrower column GRANT is therefore purely
  ADDITIVE and creates NO boundary. `source_personal_event_id` / `internal_note` are private only
  because of an explicit `revoke all ... from anon, authenticated` first. **Any future table relying
  on column-level privacy must do the same** — the grant alone is a false sense of security.
  INSERT/UPDATE stay table-level so publishing can still record provenance; owner-facing reads of
  those columns go through the service role.

### No double-booking — guaranteed by Postgres, not by application code

- A GiST **exclusion constraint** (`btree_gist`, newly installed): for one professional, no two
  non-cancelled windows may overlap. The timeline is anchored on `profile_id`, not `service_id` —
  a person cannot be in two places at once however many services they offer.
- The failure mode is a RACE (two buyers hitting Book in the same second). An application check
  loses that race; a constraint cannot. Verified live: overlap rejected, adjacent `[)` window
  accepted, cancelled window may overlap so a withdrawn slot can be re-published.
- Plus `open → held → booked` as a conditional update, one live booking per one-to-one window
  (partial unique index), and `booked_count <= capacity` for group windows.
- Conflict-checking against the private calendar happens at PUBLISH time in the owner's own session.
  The booking system never performs that check, because it never sees that data.

### Money: plumbing only, NO policy

> ⚠️ **SUPERSEDED IN PART — see “The Professional Services platform fee is 8%” (2026-08-15, below).**
> The *rate* is no longer open: it is **8% of the gross service price, before payment-processing
> fees**, for Professional Services booked AND paid through Relevé. Read that entry, not this one,
> for the number. Everything else in this section still stands — in particular the **code and
> database are unchanged**: `service_platform_fee_bps()` still returns NULL, no `app_config` row is
> seeded, and checkout must still refuse to charge on NULL. Deciding a rate and configuring it are
> two separate acts, and only the first has happened.

- `service_bookings` follows the `experience_purchases` split shape (amount / application_fee /
  professional_transfer, `pending → paid → refunded → failed`), and `pricing_unit` maps back to the
  existing `rate_unit` enum for the shared earnings ledger.
- **`platform_fee_bps` is UNSET IN THE DATABASE.** `service_platform_fee_bps()` reads `app_config`
  and returns NULL; no row is seeded. A future checkout MUST refuse to charge on NULL rather than
  assume a default. ~~No fee percentage has been approved and nothing here implies one.~~
  **A rate has since been approved — 8%, see below — but it has deliberately NOT been written to
  `app_config`, so the NULL guardrail is still the operative state of the system.**
- No Stripe checkout, payment intent, payout, or transfer is implemented. The Stripe columns exist
  so the later wiring is an UPDATE, not a migration.

---

## 2026-08-15 — The Professional Services platform fee is 8% · subscriptions hold at $149 / $199

**Decided (Kathleen, 2026-08-15).** The four economic lanes are now named and separated, and the
one number that was open in the services lane is set.

### The decision

1. **Subscriptions stand firm — annual.** **Professional $149/yr · Creator $199/yr.** No change.
   These are the membership prices and they are not being revisited as part of this decision.
2. **Professional Services booked AND paid on Relevé carry an 8% platform fee.**
   Both conditions. A service that is merely discovered or inquired about on Relevé, and then
   booked and paid for elsewhere, is not a Relevé transaction and carries no fee.
3. **The 8% is charged on the GROSS service price, BEFORE payment-processing fees**
   *(founder decision, 2026-08-15)*. The base is the full amount the client is charged for the
   booking — not a net-of-processing figure, and not a figure reduced by any discount Relevé did
   not fund. In the `service_bookings` shape that is `amount_cents`:
   `application_fee_cents = round(amount_cents × 0.08)`.
4. **Payment-processing fees are separate from Relevé's platform fee, and are borne by the
   professional receiving the payout** *(founder decision, 2026-08-15)*. Processing is its own
   line: it is not bundled into the 8%, the 8% is not expected to absorb it, and it is not charged
   to the client on top. Worked example on a $100 booking — Relevé's platform fee is $8.00 (8% of
   $100, not of $100 minus processing); the processor's fee is deducted from the professional's
   side; the professional nets $92.00 less processing.
5. **Swing and Flex protected teaching wages are NOT subject to the 8%.** The teacher receives
   100% of the agreed base rate, at or above the $50/hr floor. Relevé's participation in those
   engagements remains on the employer side — studio subscription, included uses, per-use overage,
   Flex match fee. The 8% does not reach into a protected teaching wage.
6. **Licensing / IP keeps its own economics.** The marketplace and licensing lane is governed
   separately and is untouched by this decision. The 8% is a Professional Services number only and
   must not be applied to, confused with, or used to revise a licensing split.
7. **SCOPE — this entry governs Professional Services / general on-platform service bookings, and
   nothing else.** Points 3 and 4 (gross basis; professional bears processing) are part of that
   same scope. Do **not** infer from them any change to the separately defined economics of Swing,
   Flex, Senior Spotlight, licensing/marketplace, memberships, the $30 application fee, The Beat,
   or any other existing product. Where another product defines its own fee basis or its own
   treatment of processing, that definition governs there.
8. **Professional Services is INCLUDED in the $149 Professional tier. It is NOT gated to $199**
   *(founder decision, 2026-08-15)*. Listing services, showing them on your profile, and — when
   booking ships — being bookable are all part of the $149 membership. What the **$199 Creator
   tier** adds is **licensing / IP / creator-commerce capability**, which is a different lane with
   its own economics (point 6). The dividing line is *the kind of thing being sold*, not a paywall
   placed across the same feature.
   **This ratifies what the code already does** — `/profile/services` gates on
   `hasActiveProfileTier`, whose `PROFILE_TIER_SLUGS` is `professional` + `professional_full`,
   while the marketplace seller workspace gates on `professional_full` alone. Both are pinned by
   tests in `src/lib/membership/access.test.ts`. **No code change was required by this decision**,
   and none was made.
9. **One FLAT 8% across every service category at launch** *(founder decision, 2026-08-15)*.
   Massage, Pilates, photography, accompanying and the rest all carry the same rate. **Do not build
   category-specific rates** — not a per-category column, not a lookup table, not a config map.
   A single platform number is simpler to explain, simpler to honour, and avoids Relevé implicitly
   ranking one kind of work as worth more of a cut than another. If per-category pricing is ever
   wanted it should arrive as a deliberate, separately-recorded decision.

### Why 8%

It prices the services lane as **infrastructure, not as a cut of the artist's craft.** It is
deliberately well below the licensing economics, because a service booking is a smaller, more
frequent transaction against a person's working time, and because the member is already paying an
annual subscription for presence. Standing firm on $149 / $199 alongside it is part of the same
decision: the fee is set at a level that does not require the subscription to move.

### The boundary that makes it enforceable

The fee attaches to a transaction Relevé can actually observe — one booked and paid through the
Relevé rail. This is consistent with the booking architecture already recorded on 2026-08-15
("Professional Services bookings happen ON Relevé"), which removed the outbound Booking Link
precisely because an off-platform booking takes the money and the record with it.

### What this does NOT do

- **It does not change any code, and no `app_config` row is seeded by this entry.**
  `service_platform_fee_bps()` still reads `app_config` and still returns NULL. Setting it to
  **800 bps** is a separate, explicit action — and the existing guardrail stands until then:
  **checkout must refuse to charge on NULL rather than assume a default.**
- It does not set the general marketplace / licensing fee, which remains open.
- It does not change Senior Spotlight, which carries a written commitment to the Founding
  choreographers.
- It does not change any studio tier price, the $30 application fee, or The Beat posting prices.
- It does not alter the Swing $20/use or Flex $250/run employer-side fees.

### Still open (do not infer answers from this entry)

- ~~**Who bears payment processing on a service booking**~~ — **ANSWERED 2026-08-15 (same day,
  later): the professional receiving the payout bears it.** See points 3 and 4 above. Left visible
  rather than deleted so the earlier "separate, not assigned" wording is not mistaken for a rule
  that is still open.
- ~~Whether the Professional Services capability is gated to the $199 Creator tier.~~
  **ANSWERED 2026-08-15: no — it is included in the $149 Professional tier. See point 8.**
- ~~Whether the 8% varies by service category, or is flat across all of them.~~
  **ANSWERED 2026-08-15: flat across all categories at launch. See point 9.**
- **STILL OPEN — refund, cancellation, and no-show treatment of the fee.** Nothing in this entry
  answers it, and nothing should be inferred: whether the 8% is refunded with the booking, retained,
  or pro-rated is undecided, as is who absorbs processing on a reversal. This must be settled before
  checkout is built, because a refund path that quietly keeps or quietly returns the platform fee is
  a policy decision made by omission.

**Source:** founder directive, 2026-08-15. Supersedes the "rate not set / TBD" state for
Professional Services recorded in the Revenue Model working decision map of the same date, and the
"No fee percentage has been approved" line in the *Money: plumbing only* section above — which now
carries a pointer here so the two cannot both read as current.

**Amended the same day (founder):** points 3 and 4 added — the 8% is charged on the **gross**
service price **before** payment-processing fees, and **processing is borne by the professional
receiving the payout**. This closed the "who bears payment processing" question that this entry had
originally left open.

**Amended again the same day (founder):** points 8 and 9 added — Professional Services is
**included at $149** (the $199 Creator tier adds licensing / IP / creator commerce, not this), and
the 8% is **flat across all service categories at launch**. Two of the four open questions are
therefore closed. **Refund / cancellation / no-show treatment remains open**, as does the
availability-authoring UI recorded in the booking-architecture entry above. Still unchanged by any
of this: no `app_config` row, no checkout, no payouts, no Vercel flag.

---

## 2026-08-16 — "Creator" is the public name of the $199 tier · `professional_full` stays internal

**Decided (Kathleen, 2026-08-16).** The $199 individual tier is called **Creator** to members.

**Public tier structure (individual):**

| Name | Price | What it is |
|---|---|---|
| **Professional** | $149/year | Vetted Roster profile, Professional Services included |
| **Creator** | $199/year | Everything in Professional, **plus** licensing / IP / creator-commerce |

- **Display name only.** `TIERS.professional_full.label` in `src/lib/membership/tiers.ts` is the one
  customer-facing string, and every surface that shows a tier name reads it from there — the
  membership-active email included. Changing that label is the whole rename.
- **`professional_full` remains the internal identifier**, deliberately and permanently: the slug,
  the `TierSlug` union, `memberships.tier` values already in the database, `applications.approved_tier`,
  the Stripe Price id, `STRIPE_PRICE_PROFESSIONAL_FULL`, `PROFILE_TIER_SLUGS`, and
  `MARKETPLACE_SELLER_TIER_SLUGS` are all untouched. Renaming a slug that live rows are keyed on
  buys nothing and risks everything; a customer-facing name is not an identifier.
- **Supersedes** the 2026-08-14 note on that tier which deferred customer-facing naming to
  Marketplace activation and floated the placeholder "Professional + Marketplace". That name is
  retired; it never reached a member.
- **Nothing else changed.** No price, no access logic, no entitlement, no checkout, no fee. Access
  reads `marketplaceSeller` / the slug lists — never the label — so the rename cannot move a gate.
- **One manual step outside the codebase:** the Stripe **product** name (shown on the hosted
  Checkout page and on receipts) still reads "Relevé — Professional · Full (annual membership)" for
  the already-created product. `scripts/setup-stripe-tiers.mjs` now produces
  "Relevé — Creator (annual membership)" for future runs, but the existing product must be renamed
  in the Stripe dashboard **in both test and live mode**. Renaming a product does not affect its
  Price id or any active subscription.

---

## 2026-08-18 — `NEXT_PUBLIC_SITE_URL` fails loudly instead of falling back to localhost (F5)

**Decided (payment sprint, F5).** `siteUrl()` in `src/lib/stripe/config.ts` used to return
`http://localhost:3000` whenever `NEXT_PUBLIC_SITE_URL` was unset. That value builds the
Checkout **success** URL, the Checkout **cancel** URL, and the billing-portal **return** URL.
A missing or wrong value in production meant: the card is charged, the webhook grants the
membership, and the member is redirected to a machine that is not theirs — with nothing in
any log. The only way we would learn is a confused member.

**What it does now.** A pure `resolveSiteUrl(env)` decides, so the rule is unit-tested
without a server and without mutating `process.env` (guardrail #6, the pattern
`lib/membership/access.ts` set):

- **Outside production:** unchanged. No variable → `http://localhost:3000`. A malformed
  value also falls back rather than throwing, so a bad `.env.local` never blocks `npm run dev`.
- **In production:** missing, blank, relative, non-http, **or pointing at a loopback address**
  throws `SiteUrlNotConfiguredError`, naming the variable and how to fix it. The loopback case
  matters most: a mere presence check would have passed it, and it is precisely the silent
  wrong answer being guarded against.
- **During `next build`:** never throws. Next sets `NEXT_PHASE=phase-production-build`, and a
  broken build is its own kind of outage — the trap named in the brief. Verified: `npm run build`
  exits 0 with the guard in place.

**Two checks, not one.** Call-time (guaranteed to cover every path) **and** boot-time, via a new
`src/instrumentation.ts` calling `assertSiteUrlConfigured()` once in the Node server runtime.
Boot-time is the one that matters for the standard this sprint is held to: a misconfigured deploy
announces itself in the deploy log at start-up, rather than at the moment a member hands us a card.

**Not changed:** `emailSiteUrl()` in `src/lib/email/send.ts` already falls back to
`https://releveconnect.com`, never localhost, so emailed links were never exposed to this. The
localhost fallback was confined to the Stripe redirect helper, which is the whole of F5's blast
radius.

---

## 2026-08-18 — One membership-state resolver, and how the two populations are told apart

**Decided (payment sprint, before any page work).** `/subscribe` asked "does this person have a
membership?" — a yes/no question — when the real question has **ten** answers. That single missing
distinction is what produced both live loops (F2, F3), so rewriting the page first would only have
relocated the bug. `src/lib/membership/state.ts` answers it once, purely, with no database, no
Stripe call and no clock (`now` is injected), and 57 unit tests.

**The states:** `signed_out · pending · comp · active_profile_tier · active_non_profile · lapsed ·
approved_no_membership · applied · declined · none`.

**Judgment calls made, and why:**

1. **`admin` is a flag, not a state.** The brief lists it in the state table, but modelling it as an
   exclusive state would mean an admin who activates a membership *loses* the door to their own
   vetting queue — and Kathleen is an admin who may hold one. `isAdmin` is returned alongside every
   state, so the escape hatch (subscribe/page.tsx:49, the evening lost to it) renders unconditionally.

2. **`comp` outranks the paid states.** A founding member on a comped *Professional* row is both
   "comp" and "active profile tier". Comp wins, because the copy differs in the direction that
   matters: warm, no prices, no manage button. `hasProfile` still travels with the comped tier, so
   their profile stays one click away.

3. **The two comp vocabularies are unified at READ time, not migrated.** `founding_comp`
   (`lib/membership/founding.ts`) and `complimentary_permanent` / `complimentary_term`
   (`lib/founding/founding-professional.ts`) both resolve to `comp` via `COMPLIMENTARY_SOURCES`.
   Migrating would rewrite audit rows recording what was actually granted, and the two grants
   genuinely differ. **Any future comp source must be added to that list or a founding member will
   be shown a paywall** — a test asserts the list's exact contents so adding one is a deliberate act.

4. **`canManageBilling` is `stripe_customer_id != null`, independent of state.** This is F11 as a
   single condition: comp rows carry no Stripe customer by design, so the manage button cannot
   render for them and `/api/membership/portal`'s 404 can never be aimed at a founding member. It
   also means a **lapsed** member keeps the portal — which is their recovery path, not a locked door.

5. **`pending` outranks everything, but only for 15 minutes.** The checkout route writes `pending`
   *before* redirecting to Stripe, so an **abandoned** Checkout leaves a permanent `pending` row.
   Holding that person on "Confirming your payment…" forever would be the exact dead end this sprint
   exists to remove. Fresh (≤15 min, comfortably past the 3-minute webhook delay observed) → the
   confirming panel. Older → the state falls through to what they actually hold, carrying
   `stalePendingTier` so the page can say calmly "if you completed a checkout it is still
   confirming, you do not need to buy again." We cannot distinguish an abandoned checkout from a
   badly delayed webhook from our own database; this serves both without stranding either. A pending
   row with a missing or unparseable timestamp is treated as **fresh** — erring toward "confirming"
   is safe, erring toward the chooser risks a second charge.

6. **`offeredTiers()` is separate from the state.** The state says who someone is; this says what the
   page may put a price on — "never shown a price that doesn't apply to them", in one place. It
   closes a trap the F1 rewrite would otherwise have walked into: the vetted tiers **403** at
   `/api/membership/checkout` without an approved application, so an "Upgrade to Professional" button
   shown to a Live Pass holder who never applied would simply error. The upgrade appears only when it
   will work; otherwise they are pointed at the application instead.

**Nothing reads this yet.** The resolver is committed ahead of the `/subscribe` rewrite so the
question is settled before any UI is built on top of it.

---

## 2026-08-18 — Live Pass is a family membership, not a door-opener (SUPERSEDES the 2026-06-25 tier copy)

**Decided (Kathleen, by email, 2026-08-18).** *"Live Pass is a real paid Relevé membership tier —
$99 for a family. It is not merely a studio-access state or an upgrade lane."*

**What it includes** (the ratified list, now rendered verbatim on `/subscribe`): family
participation in Relevé · monthly Zooms · news and resources · community viewing and engagement ·
access to purchase or license eligible choreography · the Relevé Passport · the College Audition
Cycle.

**This supersedes the Live Pass row in `docs/Releve_Pricing_RATIFIED_2026-06-25_…`**, which read
*"The door-opener. The Climb, The Beat (access + pay-to-post), view the Roster, member events."*
That framing described Live Pass as a lesser rung on a professional ladder. It is not one — it is
the family's own membership, and it is consistent with the 2026-08-16 clarification already
recorded in `subscribe/welcome/page.tsx` (Live Pass is the family/minor admission, not a Roster
membership). **Price, slug and label are unchanged**: `live_pass`, "Live Pass", $99.

**Consequences in code:**

- The old `active_non_profile` state — which lumped Live Pass in with the studio tiers — is
  **split** into `active_live_pass` and `active_studio`. They are different memberships with
  different homes, and one shared state could only ever give one of them honest copy.
- **Live Pass is never offered to someone who already holds it.** A test asserts this across every
  application state, because the loop it replaces (F3) was exactly this kind of "we forgot they
  already have it" error.
- Tier copy lives in a new `src/lib/membership/tier-copy.ts`, **not** in `tiers.ts`. `tiers.ts` is
  the pricing canon and the sprint brief forbids touching a slug, price or label; marketing copy
  moves on a different clock. Every line in the new file cites its ratified source, and copy that
  is not ratified is not invented there.

---

## 2026-08-18 — The Professional Roster is a pathway, never an upsell button that 403s

**Decided (Kathleen, by email, 2026-08-18).** *"Do not give an unapproved Live Pass member a direct
'upgrade to Professional' checkout that will 403. … If someone has not yet been approved for the
Professional Roster, the appropriate optional action is to apply for Professional membership, not
attempt to purchase it directly."*

`/api/membership/checkout` returns **403** on a vetted tier without an approved application. So the
obvious reading of F3 — "give the Live Pass holder an upgrade button" — would have shipped a button
that errors for every unvetted member who pressed it.

`professionalPathway()` resolves this in one place, and returns one of four answers:

| Answer | When | What the page shows |
|---|---|---|
| `purchase` | approved | Professional / Creator, with a checkout that will succeed |
| `apply` | never applied | "Apply for Professional membership →" |
| `under_review` | applied, awaiting a decision | reassurance; **nothing is sold** |
| `none` | already on a profile tier, complimentary, studio side, mid-purchase, lapsed, declined | nothing |

Deliberately separate from `offeredTiers()`: one answers *what may we put a price on*, the other
*how does this person reach the Roster from where they stand*. Collapsing them is what produces the
403 button.

---

## 2026-08-18 — Complimentary is an entitlement with a clock, not a permanent flag

**Decided (Kathleen, by email, 2026-08-18).** *"comp means a currently valid complimentary
entitlement. It must support both lifetime complimentary founders and founding members whose
complimentary period can expire later. Do not hard-code complimentary as free forever."*

The database already carries both populations, and the resolver now reads them honestly:

| Population | Row | Resolves to |
|---|---|---|
| Lifetime founder | `complimentary_permanent`, `renewal_date` **NULL** | `comp`, forever |
| Founding member on a term | `founding_comp` / `complimentary_term`, `renewal_date` set (+12 months) | `comp` until the date, then `comp_expired` |

- **`comp` now requires the entitlement to be valid *now*.** Nothing in the product expires these
  rows — the row stays `membership_status = 'active'` indefinitely — so validity is **computed**
  rather than assumed. Without this, a founding member whose year had ended would silently be
  presented as an ordinary paying member.
- **`comp_expired` is a distinct state that decides nothing.** It sells nothing, shows no price,
  keeps the profile reachable, and says the complimentary period has ended and we will be in touch.
  What *should* happen on that date — grace period, conversion, notice, whether access continues —
  is **F9, and Kathleen's to ratify**. Naming the state without inventing the policy is the whole
  point: F9 becomes a copy-and-policy decision rather than an architecture one, and the people in
  that position become queryable.
- **Unreachable in production until ~2027-07-20.** The founding-period grants began 2026-07-20 on a
  12-month term, so no live row can reach `comp_expired` for another eleven months. It is built,
  tested, and waiting.
- A **malformed** `renewal_date` resolves to `comp`, not `comp_expired`. A founding member must
  never be dropped out of their entitlement by a bad timestamp.

---

## 2026-08-18 — `/subscribe` is the canonical membership chooser, and it renders signed-out (F1)

**Decided (payment sprint, F1).** `/subscribe` is the single buy path and the billing home. The
page was rewritten on top of the state resolver, and `SubscribeButtons` — which existed, worked,
and was imported by nothing — was finally wired in. **All three individual tiers are now
sellable.**

- **It no longer redirects a signed-out visitor to `/login`.** The brief's own walkthrough requires
  a stranger to land on `/subscribe` and reach Checkout for Live Pass; the old page bounced them to
  sign-in before they could see a single price. A stranger now sees the tiers, the prices and what
  each includes, and their chosen tier travels through sign-in via
  `?next=/subscribe?tier=<slug>` so they come back to the card they picked.
- **The page decides nothing.** It reads rows, calls `resolveMembershipSituation` / `offeredTiers` /
  `professionalPathway`, and renders one branch per state. When a state's copy is wrong, the fix is
  almost always in `state.ts`. This is what keeps the two populations apart without either one's
  copy leaking into the other's branch.
- **Annual auto-renewal is disclosed on the card itself**, at the point of purchase, rather than
  left to the confirmation email after the card has been taken.
- **`pending` renders a calm static panel here.** Self-refresh, the status endpoint, and the gated
  pages rendering the same panel are **F2 and are not built** — this is the minimum correct thing,
  not the fix.
- The admin escape hatch renders in **every** state, unchanged, for the reason recorded at
  `subscribe/page.tsx` and in the 2026-08-18 resolver entry above.

---

## 2026-08-18 — WORKING PRINCIPLE: one fact, one source of truth, many useful places it can appear

**Ratified (Kathleen, 2026-08-18).** *"One fact. One source of truth. Many useful places it can
appear."* This governs the platform from here on — architecture, data model, and copy alike.

**What it means in practice.** A fact is captured **once**, in the one place that owns it, and every
surface that needs it **reads** it. A surface never re-asks for something already known, and never
keeps a second copy that can drift.

**It is already the reason several things in this codebase are shaped the way they are:**

| The fact | Its one source | The many places it appears |
|---|---|---|
| Price, slug, entitlement of a tier | `lib/membership/tiers.ts` | `/subscribe`, checkout, webhook emails, welcome page |
| "What is this person's membership situation?" | `resolveMembershipSituation` | `/subscribe`'s twelve branches, and every gate that will read it |
| What a pathway says it includes | `lib/membership/tier-copy.ts` | the chooser cards, and the bold-phrase emphasis |
| What a professional offers | **My Services** (`professional_offerings`) | public profile, and — next — Roster search and This Week |
| Where/how they can work | Availability (`kind='general'`) | editor, Roster filters, public profile |

**And it is the test the 2026-08-18 IA reconciliation was failing.** "I'm currently accepting
choreography" was the SAME FACT as a Choreography service, stored twice in two shapes, asked for
twice, and free to disagree. That is what made it wrong — not that it looked untidy.

**Consequences to hold to:**

- A new surface that needs a fact **reads the existing source**; it does not add a field.
- If two places can disagree, one of them is not a source of truth — find which, and make the other
  read it. `tier-copy.test.ts` exists for exactly this: it fails the build if an emphasis phrase
  stops matching the copy it emphasises.
- Derived views are welcome and expected — that is the "many useful places." Duplicated *capture*
  is not.
- **This Week must derive its service choices from My Services**, never ask for them again. Recorded
  here so the next slice cannot quietly reinvent them.

---

## 2026-08-18 — `/subscribe` gets the Relevé visual system: cream, near-black, restrained gold

**Decided (Kathleen, 2026-08-18).** The page was correct and looked like a generic SaaS pricing
table. It now carries the brand.

**Nothing was invented.** The repo already had two scoped token files — `components/home/tokens.css`
(`.home-scope`) and `components/this-week/tokens.css` (`.this-week-scope`) — carrying the
BLACK · CREAM · GOLD palette and the serif voice. `app/subscribe/tokens.css` is a third scope built
from **their exact values**, so the membership page reads as the same brand rather than a fourth
dialect:

| Token | Value | Source |
|---|---|---|
| `--rc-cream` | `#f5eee1` | home-scope — page ground, never stark white |
| `--rc-ivory` | `#fcf9f1` | this-week-scope — card surface, a half-step up |
| `--rc-ink` | `#1e1a17` | home-scope |
| `--rc-ink-soft` | `#3c3630` | home-scope — body copy |
| `--rc-muted` | `#6d6459` | home-scope — fine print only |
| `--rc-gold` | `#b6912f` | home-scope, "the working gold: rules, numerals, accents" |
| `--rc-hairline` | `#e3d9c3` | this-week-scope |
| serif | Iowan Old Style / Palatino / Georgia | both files |

**Gold is an accent and never a fill.** It appears only at small scale: the 01–04 numerals, the
hairline under each card header, the bullet dashes, the price, the eyebrow separator, CTA hover, and
the single rule on the founding-member plate. There is no large gold surface anywhere on the page.

**Hierarchy comes from scale, colour and space — not from weight.** Body copy is regular; the only
bold is membership names and thirteen founder-specified value phrases.

---

## 2026-08-18 — The membership chooser is four peers, in a fixed order

**Decided (Kathleen, 2026-08-18).** *"01 Professional, 02 Creator, 03 Studio / Arts Organization,
04 Live Pass … presented as visual peers, with Professional leading the hierarchy."*

**The bug this fixed was structural, not cosmetic.** The chooser rendered `offeredTiers()` directly —
a list of what a person may BUY RIGHT NOW. Signed out that returns exactly one tier (Live Pass, the
only one sellable without vetting), so a stranger saw a one-card page, Professional was demoted to a
grey footnote, and the studio pathway did not render at all. **An eligibility list was masquerading
as an information architecture.**

The two are now separated, and this is the same principle as above: *what may be purchased* and
*what pathways exist* are two different facts with two different owners.

- All four pathways **always** render, as peers, in the ratified order.
- `offeredTiers()` — **untouched** — still decides which carry a real purchase button. It is no
  longer allowed to decide which APPEAR.
- Desktop is a 2×2 composition; cards are equal-height with CTAs on a shared baseline.
- **One CTA treatment for all four.** `SubscribeButtons.tsx` had `bg-neutral-900 text-white`, which
  made Live Pass the only filled button purely because it is the only one that goes straight to
  checkout. It now shares `.rc-cta` with the link CTAs. **The verb carries the difference — Apply /
  Explore / Join — the styling never does.**
- The Studio lane is ONE peer covering three tiers; three separately priced cards would outnumber and
  bury the others. No price is shown (onboarding is invite-led, DECISIONS 2026-07-24), but each
  purchase button carries its own price for an eligible employer, so nobody picks a tier blind.

---

## 2026-08-18 — The founding-member state is a welcome, not a system status

**Decided (Kathleen, 2026-08-18).** *"Technically correct but visually and emotionally wrong."*

The `comp` state announced an account type ("You're a founding member"), led with what the member
does **not** owe ("nothing to pay, nothing to enter"), and sat beside a full-width black admin slab.

It is now a centred recognition plate — ivory on cream with a single gold rule, the same materials as
the membership cards so it belongs to the system:

> RELEVÉ · FOUNDING MEMBER — **Welcome to Relevé.** — *You're here at the beginning.*
> "You are one of Relevé's founding members — here before there was anything to join, and part of
> what this becomes. Your membership is **complimentary**, with our thanks."

- **"Build your profile" is the one filled button on the page.** A deliberate exception to the
  equal-CTA rule, and consistent with its reason: that rule exists so no *pathway* outranks another.
  Here there is a single next step and nothing to be a peer with.
- **The admin panel became a discreet utility link** — `Admin · View vetting queue →`. The escape
  hatch (2026-07-22, the evening lost to being locked out of the vetting queue) still renders in
  **every** state; it simply no longer dominates a page whose job is to make a member feel welcome.
- **Deliberately silent on when a complimentary term ends.** `compExpiresAt` is resolved and
  available; naming a date turns a gift into a countdown (founder decision, 2026-07-21).

---

## 2026-08-18 — Membership copy is founder-authored, verbatim, and tested

**Decided (Kathleen, over four rounds, 2026-08-18).** All chooser copy lives in
`lib/membership/tier-copy.ts`, **not** in `tiers.ts` — the pricing canon may not have a slug, price or
label touched, and marketing copy moves on a different clock. Every line cites its ratified source.

**It supersedes the tier descriptions in `docs/Releve_Pricing_RATIFIED_2026-06-25_…`**, which framed
Live Pass as a professional "door-opener" and the rest as feature lists.

**Two corrections worth preserving, because they show the standard:** an earlier pass approximated
two bullets to make founder-specified bold phrases match. Kathleen rejected it — *"Do not approximate
approved wording when the exact language carries product meaning."* Both were restored verbatim:

- **"Be discovered** for teaching, performance, Swing, and professional opportunities." — *being
  findable* is what Professional sells; a list of nouns loses it.
- "License and monetize **your choreography** and eligible creative work." — *your* is the whole
  point of Creator: the work stays the artist's, and Relevé takes a marketplace share of a product,
  never a cut of a wage (guardrail #1).

**Emphasis is data, and it is guarded.** The thirteen bold phrases are stored beside the copy and
matched case-insensitively, longest-first. `tier-copy.test.ts` (19 checks) **fails the build if a
copy edit ever orphans a phrase** — bold that silently vanishes is the exact failure this invites,
and no other test would catch it.

Italics are scoped to five places: "One industry. Four ways to belong.", and the four audience
statements. Everything else is regular weight.

**One display fix inside the pricing canon:** `dollars()` gained a thousands separator, so Studio
Accelerator renders `$1,499` and not `$1499` as the ratified doc writes it. Display only — no price,
slug, or label changed, and it matches the existing house formatter in `lib/offerings/offerings.ts`.

---

## 2026-08-18 — The canonical top-level service set is five, and specializations live inside them

**Decided (Kathleen, 2026-08-18).** *"Merge Private Audition Coaching into Private Coaching as the
single canonical My Service… Audition Prep should remain a specialization/use case of Private
Coaching, not a separate top-level service."*

**The five, in order:**
**Choreography · Master Classes · Private Coaching · Adjudication · Guest Teaching**

**The product rule this establishes.** A top-level service is a *category a studio would search for*.
A specialization is a *use case within one*. Audition Prep, College Audition Coaching, Technique,
Solo Coaching and Career Coaching are all specializations of **Private Coaching** — promoting each to
its own top-level service would turn My Services into twenty near-identical buttons and make the
Roster's Services facet useless, which is the opposite of what the facet is for.

**No specialties schema was created** (founder instruction: *"Do not create a new schema just for
specialties in this slice if one does not already exist; simply preserve that product decision for
later"*). The decision lives here and in `lib/roster/services.ts` until there is something to build.

**Which row survived, and why it matters.** The two rows were not equivalent:

| | `Private Audition Coaching` | `Private Coaching` |
|---|---|---|
| origin | **the member's own**, 2026-08-13 | machine placeholder, 2026-08-18 |
| type | `session` | `service` |
| pricing | `hourly`, **"$125 / hour"** | `contact`, no price |
| description | their own words | generic |

So the merge **kept the member's row and renamed it**, and deleted the placeholder. Doing it the
obvious way round — keeping the row that already had the right title — would have silently destroyed
a real price, a real description, the row's `id` and its `created_at`. The instruction was "preserve
all existing data and references", and only this direction does that. Verified first: no foreign key
anywhere references `professional_offerings.id`.

The surviving description is kept **verbatim** ("Individual coaching for dancers preparing for
college, professional, or company auditions") rather than rewritten to match the broader title —
rewriting a member's own copy would be inventing words. It now reads narrower than the title; that is
a copy edit for the member, not a migration.

**Old searches keep working.** `LEGACY_SERVICE_ALIASES` in `lib/roster/services.ts` resolves
`private-audition-coaching` → `private-coaching`, applied in both the pure predicate and the live SQL
query. A bookmarked `/roster?svc=private-audition-coaching` still finds the right professionals —
including members who only ever had "Private Coaching" and never held the retired slug. Like the
availability aliases, this is an alias for retired URLs, **not** a second source of truth: nothing is
stored against it and no member ever sees it.

**Verified against production:** all five canonical slugs resolve; the retired slug resolves; all
four legacy `?avail=` URLs still return their results; and `private-audition-coaching` no longer
appears anywhere in the live `service_slugs`.

---

## 2026-08-18 — Availability publishes ONLY when the member explicitly marks a window public

**Decided (Kathleen, 2026-08-18).** *"Only publish when the member explicitly marks a window
public."* This is the rule the whole This Week ↔ public-availability boundary is built on.

**What it means:**

- A `personal_events` row is **always private**. Creating one publishes nothing, ever. There is no
  automatic derivation, no "availability category means public", no background sync.
- A member publishes by taking an action, and that action **writes a row in
  `service_availability`** — the separate, public table. Publishing IS the existence of that row.
- Unpublishing **deletes that row**. It never edits the private event.
- Only the *shape* of the window crosses over — `starts_at`, `ends_at`, `timezone`, and the service
  being offered. **Never** the title, category, note, or `detail` of the private event. A studio
  learns *when* someone is free, and never *why* they are not.

**Why explicit, and not automatic.** Automatic publication is one bad `UPDATE`, one misread enum, or
one well-meant "sync my calendar" feature away from putting an audition, a medical appointment or a
funeral on a public page. The founder's rule: *"A person's private calendar may inform public
availability, but Relevé must never expose why they're unavailable."* An explicit act is auditable,
reversible, and impossible to trigger by accident.

**This preserves an existing firewall rather than inventing one.** `service_availability` was already
built this way — publication as a separate row, `source_personal_event_id` and `internal_note`
REVOKEd from `anon`/`authenticated` at column level, and RLS confirming `personal_events` has exactly
ONE policy (owner-only, no anon read, no studio/guardian/teacher path). This decision ratifies that
design and forbids the shortcuts that would erode it.

### ⚠ One schema mismatch this exposes, to resolve before building

`service_availability.service_id` currently references **`professional_services`** — the *other
businesses* table (massage, Pilates, photography) — **not `professional_offerings`**, which is My
Services and the ratified source of truth for what a professional offers.

So a published window cannot currently point at "Guest Teaching". The bridge exists, but it is wired
to the wrong table. Resolving it is a schema change and needs a pre-flight and explicit approval; the
likely shape is a nullable `offering_id` alongside the existing `service_id`, so the Professional
Services booking path that column was built for is not broken. **Both tables have 0 rows**, so this
is still free to change.

---

## 2026-08-18 — The public read path: publishing and discovery are two different things

**Found (Kathleen, 2026-08-18).** After the This Week write path shipped, Kathleen published a
real window — Guest Teaching, Aug 20, 2–4 PM — and confirmed the private confirmation ("Added, and
your window is public"). An anonymous visit to `/kathleen-mcaree` showed nothing. The database had
the row; nothing read it.

**The lesson, in her words:** *"We just found the difference between 'the database can publish
availability' and 'a studio can actually discover that availability.' Relevé needs both."* The write
path (`service_availability` insert) and the read path (the public profile query) are two separate
pieces of work, and shipping the first without the second is a silent gap — the feature LOOKS done
from the member's side and is invisible from the studio's side.

**What was built:**

- `lib/profile/public-availability.ts` — pure formatting (date, time range, DST-correct timezone
  abbreviation via `Intl…timeZoneName:"short"`, not a hand-rolled ET/PT table). 11 tests.
- `[handle]/AvailabilityWindowsSection.tsx` — "Available This Week", placed beside the Availability
  tag row per founder direction. No feature flag: this is the completion of an existing capability,
  not a new gated one. Guarded by `windows.length`, same as Offerings/Services.
- The loader query in `[handle]/page.tsx` selects **exactly five fields** —
  `id, starts_at, ends_at, timezone, professional_offerings(id, title)` — and never asks for
  `source_personal_event_id` or `internal_note`. The admin client bypasses RLS and column grants
  entirely, so the ONLY thing enforcing the firewall on this query is that discipline. Documented
  inline as the load-bearing property it is.
- Filters: `status='open'` (explicitly published only) · `offering_id is not null` (My Services
  windows, not the separate Professional Services booking path) · the joined offering's
  `status='active'` (a since-deactivated service's old windows don't linger) · `ends_at >= now`
  (nothing already past).

**The "PUBLIC" badge — a second, sharper firewall finding.** Marking a member's own This Week card as
published required reading `service_availability.source_personal_event_id` — and column privileges
confirmed that column has **no SELECT grant for `authenticated`, not just `anon`**. The REVOKE from
20260815173203 was written to block everyone via the ordinary API, including the owner reading their
own linkage. So `fetchPublishedEventIds()` is a new, narrowly-scoped ADMIN-client read: it runs only
after `profileId` is resolved from the caller's own session, touches only that profile's rows, and
returns nothing but a boolean-per-card. This mirrors the existing precedent of `buildLiveWeek` already
mixing an RLS-scoped client with an admin client for different needs (e.g. `materialiseSessions`).

**Verified anonymously against Kathleen's real published window**, not synthetic data: the exact
query, run as the `anon` role, returns exactly her one window, with exactly the five safe fields, and
`source_personal_event_id`/`internal_note` remain blocked (`42501`) on that same anon connection. A
cancelled window was inserted and confirmed absent from the anonymous read, then removed. The browser
check ran with zero cookies — a genuinely anonymous session — and rendered "AVAILABLE THIS WEEK ·
Guest Teaching · Thu, Aug 20 · 2:00 – 4:00 PM EDT" with no console errors.

---

## 2026-08-18 — The public profile stops looking like an application

**Found (Kathleen, 2026-08-18, walking the real profile).** *"The public professional profile
currently feels too much like a job application or database record."* Styles, Teaching Levels,
Focus, and general Availability were rendered as standalone tag rows — useful as structured intake
data, wrong as the first thing a studio sees.

**The principle she set:** two different concepts had been living in one page. **Intake / structured
data** — used internally for search, matching, filtering, admin — and the **public profile**, a
curated storefront answering: who is this, what do they do, can I hire them, are they available, can
I see their work, what establishes credibility. The fix is presentation-only: nothing stored,
nothing searchable, nothing editable was touched.

**What was removed from the public render (data, editor, admin, and Roster search left untouched):**
Styles, Teaching Levels, Focus, general Availability, and the already-dead "Currently accepting" tag
row. `loadProfile` still fetches every one of them, byte-for-byte — confirmed before touching
anything that the Roster's search reads a wholly separate SQL view (`roster_profiles`), independent
of this page's code, so hiding these tags here could not have touched search even if the fetch had
been removed too. It wasn't: **"leave the existing loadProfile data fetching intact... do not
combine this presentation cleanup with query optimization"** was the explicit instruction, honored
by commenting out five render calls and touching nothing else. "Teaching at / Touring with" and
Professional Services (the other-businesses section — a different concept from My Services) were
hidden the same way: fetch preserved, render commented out, restorable in one line.

**The new hierarchy:** Professional Header (photo, name, standing marks, title, location, years) →
Bio, set larger and unlabelled so it reads as an introduction, not a form field → **My Services**,
moved up to directly follow the story → **Available This Week**, immediately after → **Selected
Work** (Featured Reel + gallery, combined) → Credentials → Links. This must work for a choreographer,
adjudicator, or performer as well as a teacher — which is what forced the next decision.

**The Featured Reel stopped being a hero concept.** It was hardcoded "Teaching Reel," permanently
above the fold — correct framing for a teacher, wrong for a choreographer, adjudicator, or performer,
for whom the reel is a résumé tape or a performance clip, not a lesson. *"Make this a generic Featured
Work / Featured Reel media position... the component must not be teacher-specific."* It moved out of
the hero into Selected Work, generically labelled. The underlying column
(`talent_profiles.teaching_reel_url`) is unchanged — no schema touched in this pass; only the label
and position are generic now.

**Available This Week got the Inquire action it was missing**, and the fix was to *extract*, not
duplicate. The exact same interaction My Services already used — open a note, prefill it, send via
the existing connections flow, show sent/error/pending — was pulled out of `OfferingCta.tsx` into a
shared `InquireButton.tsx`, used by both surfaces now. The window's prefill names the service **and**
the exact date/time (`windowInquiryPrefillMessage`), built from nothing but the same four-field public
whitelist the read path already enforced — no new privacy surface, because the function is never
given anything else to leak.

**Verified anonymously after the pass, not assumed:** the firewall check re-run against Kathleen's
real published window — `source_personal_event_id` and `internal_note` still blocked (`42501`) for
`anon`, `personal_events` still 0 rows, exactly one window still returned. Confirmed in the DOM,
signed out, zero session cookies: `h2` order reads Services → Available This Week → Selected Work →
Credentials, no Styles/Levels/Focus/Availability tag rows anywhere, all 6 Inquire buttons route an
anonymous visitor to `/login?next=/kathleen-mcaree`.

700 tests (was 696). Typecheck clean, build green. Lint shows 7 new warnings — the now-unread
`loadProfile` return fields plus the dormant `TagRow` helper — which is the correct, expected shape
of "fetch preserved, render removed," not a defect.
