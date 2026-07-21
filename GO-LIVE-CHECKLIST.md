# 🚀 GO-LIVE CHECKLIST — releveconnect.com

**What this is:** the single punch-list between the current build and this build
being the live site at releveconnect.com. Last updated **2026-07-20 (night, post-launch-day)**.

> ### 🌙 END OF LAUNCH DAY — status
> The build is now **DEPLOYED AND LIVE on a Vercel staging URL**:
> **https://releve-connect-platform.vercel.app** (verified working: homepage,
> DB connection, login redirect, zero console errors). Vercel is connected to
> GitHub `main` and **auto-deploys on every push**.
> - ✅ Code merged to `main` + pushed · ✅ Env vars loaded (Supabase, email) ·
>   ✅ Supabase redirect/site URLs set to the Vercel URL · ✅ **Database cleaned**
>   (only `kathleen@releveconnect.com` admin remains; all test/fixture/Stripe-test
>   rows removed) · ✅ `/subscribe` rewritten for the free launch.
> - ⏳ Resend domain verification was **pending** overnight (finishes on its own).
> - ❗ **NOT done — the DNS cutover.** `releveconnect.com` still serves Brent's
>   old site. Pointing the domain at Vercel is the next-session task (§3, §7).
> **Tomorrow's plan is in `START-HERE-TOMORROW.md`.**

**Original context (still true until cutover):** `releveconnect.com` still serves
**Brent's old Netlify site**. Real applications from it are **not** landing in our
Supabase project. The new build is live only on the Vercel staging URL above.

**Legend:** ✅ done · 🔨 needs building · ⚙️ config/ops (no code) · 🧍 needs a
decision from Kathleen · 🛑 blocker

---

## 0. The short version

| Phase | State |
|---|---|
| Security holes | ✅ both closed |
| Email sending | ✅ implemented; keys set in Vercel; Resend domain ⏳ verifying |
| Free founding launch | ✅ live in code |
| Apply flow (auto-save, re-entry, admin feedback) | ✅ done |
| Hosting | ✅ **deployed to Vercel staging** (auto-deploys from `main`) |
| DNS cutover to releveconnect.com | ❗ **not done — next session** |
| Production env vars | ✅ loaded in Vercel (site-URL → real domain at cutover) |
| Database cleanup | ✅ **done — only the admin account remains** |
| `/subscribe` reflects free launch | ✅ done |
| Homepage + calendar polish | ✅ done |

**Nothing is half-finished in the code.** What's missing is infrastructure,
config, and two content builds.

---

## 1. ✅ Done (verified, committed)

- **Connect payout-hijack closed.** `/api/connect/*` had no auth and used the
  service-role client — anyone could mint a Stripe onboarding link for another
  artist and redirect their payouts. Now ownership-gated. Verified a signed-in
  non-owner gets 403.
- **Admin PII leak closed.** `/admin/applications` rendered every applicant's
  name, email, mobile, references and work authorisation to anyone with the URL.
  Now gated on `users.account_type = 'admin'`. Kathleen's account was promoted.
- **Email actually sends.** All 10 emails implemented via Resend (`lib/email/send.ts`).
  Proven with a real HTTP call. Never throws, never goes quiet.
- **Free founding launch.** No application fee; approval grants a complimentary
  **one-year** membership (`source = 'founding_comp'`, $0, no Stripe ids).
- **Auto-save + 14-day resume link.** Draft saves ~2.5s after typing stops and
  restores exactly, including role-branched sections.
- **Safe re-entry.** A returning applicant no longer gets a blank form that
  silently overwrites their submission.
- **Admin approve feedback.** Row stays visible and reports the outcome.
- **"This Week" calendar** wired to live data, with personal events and the
  compensation model (`teaching_engagements` + `teaching_earnings`).

---

## 2. 🛑 Must happen before real applicants

| # | Item | Who |
|---|---|---|
| 2.1 | 🧍 **Decide the studio/employer questions.** The studio path is currently ONE free-text box. `employer_profiles` has unused `student_count_band`, `staff_count`, `room_count`, `year_founded` — the questions Kathleen liked on the old site. | Kathleen → then build |
| 2.2 | 🧍 **Decide what the PRIMARY role requires.** Today almost nothing is required: only the 150-word story has a minimum, references are optional, §12 "select at least one" is unenforced. | Kathleen → then build |
| 2.3 | ⚙️ **Verify a real email actually arrives.** Set the keys (§4) and send one to yourself. Implemented ≠ delivered. | Kathleen |
| 2.4 | 🔨 **Progress bar on /apply** (CLAUDE.md §4F requires it; not built). | Build |

---

## 3. 🔨 Deployment / domain

**Settle first:** `README.md`, `CLAUDE.md` and `DECISIONS.md` all ratify
**Vercel**. `RESUME-HERE.md:122` says Netlify. **Recommendation: Vercel** (three
docs agree; Next 16 is first-class there). This decides where env vars and the
Stripe webhook live.

There is **no** `netlify.toml`, `vercel.json`, `.github/workflows`, or Dockerfile
in the repo. Everything is configured in the host's dashboard.

**Cutover order — do NOT start with DNS:**

1. ⚙️ Connect the GitHub repo to the host; set every env var from §4.
2. ⚙️ Deploy to the `*.vercel.app` preview URL. Set `NEXT_PUBLIC_SITE_URL` to it.
3. ⚙️ Add that preview URL to **Supabase → Auth → URL Configuration**.
4. ⚙️ Create the **live** Stripe webhook endpoint (§5).
5. 🧪 Rehearse everything in §7 on the preview URL.
6. ⚙️ **Lower DNS TTL to ~300s and wait 24h.**
7. ⚙️ Add `releveconnect.com` as a custom domain; set `NEXT_PUBLIC_SITE_URL` to it; redeploy.
8. ⚙️ Add the real domain to Supabase's allow-list + Site URL.
9. ⚙️ Point DNS at the new host.
10. ⚙️ Leave Brent's Netlify site **up but unlinked** for ~1 week as rollback.

**What breaks if missed:**

| Thing | Consequence |
|---|---|
| Supabase redirect allow-list | **Login completely broken, no error in your logs.** The classic cutover outage. |
| `NEXT_PUBLIC_SITE_URL` | Every Stripe link + email link silently points at `localhost:3000`. Fails soft — payments look fine, then dead-end. |
| Stripe webhook endpoint | Payments take money and never grant access. |

⚠️ `src/lib/stripe/config.ts` falls back to `localhost:3000` **silently** if the
site URL is unset. Consider making it throw in production.

**Also absent (not blockers):** no `robots.txt`, no sitemap, no `metadataBase`,
no OpenGraph tags — profile links shared to Instagram render as bare links. No
security headers (HSTS/CSP). No `images.remotePatterns`, so `next/image` with a
remote host will throw.

---

## 4. ⚙️ Production environment variables

| Variable | Now | Needed |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | 🔴 `http://localhost:3000` | `https://releveconnect.com` |
| `EMAIL_API_KEY` | 🔴 absent | Real Resend key |
| `EMAIL_FROM_ADDRESS` | 🔴 absent | e.g. `hello@releveconnect.com` — **domain verified in Resend** |
| `ADMIN_ALERT_EMAIL` | 🔴 absent | Your inbox — **without it you are never told an application arrived** |
| `STRIPE_SECRET_KEY` | 🔴 **EXPIRED** test key | Fresh `sk_test_…` now; `sk_live_…` at go-live |
| `STRIPE_WEBHOOK_SIGNING_SECRET` | 🟡 CLI/test value | `whsec_…` from the live endpoint |
| `STRIPE_PRICE_*` (6) | 🟡 test-mode ids | **Regenerate in live mode** — `node scripts/setup-stripe-tiers.mjs` |
| `MAILERLITE_API_KEY` / `_GROUP_ID` | ⚪ empty | 🛑 **KEEP EMPTY** — see §6 |
| `ADMIN_TOKEN` | 🟡 local dev value | Rotate for production |
| `FOUNDER_WELCOME_BOOKING_URL` | ⚪ empty | Set, or post-purchase emails ship without booking links |
| Supabase (3) | ✅ real | See §8 |

Also in the **Supabase dashboard** (not the repo):
- ⚙️ Auth → Site URL + redirect allow-list (`/auth/callback`, `/auth/confirm`).
- ⚙️ **Real SMTP.** Magic links currently use Supabase's default sender, rate-limited
  to a handful per hour — that will not survive a founding-cohort launch.

---

## 5. ⚙️ Stripe (dormant while free, needed for the $499 flow)

- Create the webhook endpoint at `https://releveconnect.com/api/webhooks/stripe`
  for these 7 events: `checkout.session.completed`, `account.updated`,
  `payment_intent.payment_failed`, `charge.refunded`,
  `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.upcoming`.
- Enable **Connect / Express** in live mode.
- Configure the **Customer Portal** — live mode has no default config, so
  `/api/membership/portal` will 500 and **nobody can cancel**. That's a
  compliance problem for auto-renewing annual billing, not just a bug.
- Pin the Stripe `apiVersion` (currently inherits the account default).

🔨 **Known gap — matters when payment turns on:** there is no `invoice.paid`
handler, so annual renewals never extend `renewal_date`, and a member who lapses
on one failed payment is **never restored** when the retry succeeds.

---

## 6. 🧍 Decisions to hold

- 🛑 **MailerLite stays OFF.** `addBuyerToClimb()` adds every $499 buyer to a
  marketing list with **no opt-in checkbox and no unsubscribe surface**. It is
  inert *only* because the env vars are empty — **setting them turns it on for
  every buyer.** Needs a real opt-in before those keys go anywhere near
  production. Do not let anyone flip them.
- ✅ **Launch free** — done and live in code.
- 🧍 **Stripe:** regenerate a fresh `sk_test_…` to keep testing now, or go
  straight to live keys as part of cutover. Nothing Stripe-related works locally
  until this is done.
- 🧍 **Founding members were promised ONE FREE YEAR** (through ~2027-07-20).
  They need a real renewal path before then. The four-step "switch payment back
  on" recipe is in `RESUME-HERE.md`.

---

## 7. 🧪 Rehearse on the preview URL before DNS

1. Apply end-to-end as a stranger, on a real external email address.
2. Confirm **you** receive the admin alert and **they** receive the confirmation.
3. Refresh mid-form — confirm the draft restores.
4. Approve them; confirm the welcome email and the comp membership.
5. Confirm they can then build a profile and browse the Roster.
6. Test magic-link login on a real external email.
7. Buy a $499 experience with a live card, then refund it.
8. Open `/this-week` signed in.
9. Confirm `/admin/applications` is **404 for a non-admin** and 200 for you.

---

## 8. 🧍 Database — test data is in the production candidate

The Supabase project in `.env.local` (`hmqqxbkhcqspqmsjxodq`) is the same one
used for all development. It currently holds:

- Fixture data: **Bergen Ballet**, a fake minor (**"Ava"**), fixture staff
  accounts, classes, sessions, comms — all documented in
  `supabase/seed/this-week-demo.sql` with a teardown block.
- **Test-mode Stripe money rows**: `memberships` and `experience_purchases` from
  test payments, plus ~32 `processed_stripe_events`. These **will pollute real
  reporting**.

**Decide:** clean this project before launch (teardown blocks exist), or stand up
a fresh production project and re-apply the 20 migrations. Cleaning is less work;
a fresh project is cleaner. **Either way, do not launch on top of the test-mode
money rows.**

⚠️ **No migration runs in any deploy pipeline** — all 20 have been applied by
hand. A deploy can ship code ahead of schema. Keep applying deliberately.

---

## 9. Queued builds (the beauty layer)

- ✅ **Homepage — DONE.** Real hero, courage line, promise section, and the gold
  ecosystem artwork. Black · cream · gold only. Nav renders **only links that
  exist**: The Roster, For Studios, Sign in, Apply.
  - 🧍 **The mockup listed 4 more nav items with no pages yet** — *Teachers*,
    *Choreographers*, *Dancers* (these could point at `/roster?role=…`, which
    works but is membership-gated), and **The Beat · The Climb · The Green Room**
    (no route at all). Say the word once those pages exist and each is a one-line
    add.
- ✅ **"This Week" additions — DONE.**
  - **"You Matter Here"** greeting band with all **30** of Kathleen's lines,
    rotating by day-of-year (stable all day, cycles monthly). Rebuilt in black ·
    cream · gold — the source mockup's plum is deliberately not carried over.
  - **Music player** — the pipe is built: `music` storage bucket, a single
    `this_week_current_track` config value Kathleen sets herself, tap-to-play
    (never autoplay), `preload="none"`. No track set = no player, which is normal.
  - 🧍 **To use it:** upload an audio file to the `music` bucket, then set
    `app_config.this_week_current_track` to the filename (and optionally
    `this_week_current_track_credit`).
  - 🛑 **LICENSING — standing hazard, like MailerLite.** Only (a) royalty-free
    tracks Relevé has licensed or (b) a member's ORIGINAL work may go in that
    bucket. Never commercial music, not even as a placeholder — a public bucket
    on a real domain is publication.

---

## 10. Merge state

- `main` = `64ef72d` (Brick 4).
- `feature/this-week-calendar-pass-one` is **~10 commits ahead**, PR open, **not
  merged**, and **not fully pushed**.
- The branch carries **migrations already applied to the live database**, so the
  schema is ahead of `main`. **Merge before deploying** — deploying `main` as-is
  would run code that doesn't match the database.

**Order:** push → merge to `main` → connect host → deploy from `main`.
