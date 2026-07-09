# Decisions Log

A plain-English record of every meaningful decision on Relevé Connect — what we
decided, when, and why. Newest entries at the top. This exists so that months from
now (or a future engineer) can understand *why* the project is the way it is.

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
4. **Certified badge = RC-granted after ~60 days** from membership activation. Relevé's
   own stamp, separate from peer ratings.
5. **First 50 badge** = the first 50 approved applicants; the badge attaches at paid
   activation. Silver sibling of the gold "Founding 25" mark.

---

## Open questions still needing Kathleen's input

- [ ] Confirm the final category vocabularies (styles, levels, focus areas, regions) —
      see Open Decision 3 above.
- [ ] Confirm the email vendor: **Resend** vs **Postmark** (both fine; needed before
      wiring up onboarding emails).
