# ▶️ RESUME HERE — Relevé Connect build
*Updated 2026-07-11. **Step 2 (the vetting-gate spine) is complete and committed.** Next session picks up at **Step 3 — the visual-first Professional profile.***

---

## 📍 EXACT PICK-UP POINT FOR NEXT SESSION

**Start Step 3 — the Professional (Teacher) profile, visual-first (build spec §6).**
Do **not** start until re-reading `docs/Releve_Connect_Member_Platform_Build_Spec_2026-07-11.md` §6 + the §17 guardrails.

Step 3 is, concretely:
1. **Gate `/profile/edit` behind an active Professional membership** (§17: "profile gated at Professional $149"). Right now it's open to any signed-in user — that gate is the first task of Step 3. Use `memberships.membership_status = 'active'` on a `professional`/`professional_full` tier (helper belongs in `src/lib/membership/`).
2. **Visual-first profile** per §6: above-the-fold hero = autoplay-muted **vertical Teaching Reel** + headshot + name/roles/location + earned proof (completed-Swing count + rating); text credentials *below* the hero.
3. **Native media via Supabase Storage:** headshot (exists), an **8-image photo gallery grid**, résumé/CV PDF upload, Teaching Reel (Vimeo/YouTube) as the highest-value item.
4. **Shareable public profile URL** `releveconnect.com/[handle]` — public visibility gated to Professional tier.
5. **Carry the approval decision onto the profile:** transfer `applications.honorifics` + `approved_tier` + the **Verified Member** identity mark onto the talent_profile at creation (they live on the application today).
6. **Teaching levels = the 5 seeded rungs**, multi-select; **no age-group filter** (age is demographic only).

**Rule for the session:** check in before starting Step 4 (Roster/discovery). Ask on anything TBD — don't guess.

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

## 🗄️ Backup
- This repo has **no git remote** — it lives only at `C:\Users\kathl\releve-platform`. Worth pushing to a fresh **private GitHub repo** before long (needs `gh` installed or a manual remote).

*— together we rise · nous nous levons · relevé —*
