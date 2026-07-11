# Decisions Log

A plain-English record of every meaningful decision on Relevé Connect — what we
decided, when, and why. Newest entries at the top. This exists so that months from
now (or a future engineer) can understand *why* the project is the way it is.

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
- **"Certified" mark → renamed "Verified Member"** — an identity/standing mark (real, vetted, active member); keep the ~60-day trigger; drop any wording implying RC vouches for skill.

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
4. **Verified Member mark** *(renamed from "Certified" 2026-07-11)* = RC-granted after ~60 days
   from membership activation. An **identity / standing** mark (real, vetted, active member) —
   **not** a competence stamp; RC never vouches for skill (no-endorsement).
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
