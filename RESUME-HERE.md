# ▶️ RESUME HERE — Relevé Connect build
*Updated July 9, 2026. **Payment setup is DONE and the $499 flow passed an end-to-end test.** What remains is real content + the other-artist path + notifications + go-live. Nothing is broken.*

---

## 🎉 What's finished (the whole setup + first proof)

- ✅ **Database migrations applied** (RLS first, then Stripe Connect / $499). Verified: `signature_works` + `experience_purchases` tables exist, `talent_profiles` has `stripe_account_id` + `payouts_enabled`, `memberships` has `source`, RLS on 24 tables.
- ✅ **`SUPABASE_SECRET_KEY`** set in `.env.local` (server/webhook admin client works).
- ✅ **Admin console** built & proven — `/admin/signature-works` (add artist → create/publish a $499 work).
- ✅ **Stripe webhook** working — `stripe listen` forwards to `/api/webhooks/stripe`; signing secret matches.
- ✅ **`FOUNDER_PROFILE_ID`** set so the founder path sells with **no split** (keeps 100%, no connected account).
- ✅ **END-TO-END $499 PURCHASE PASSED** — Buy → Stripe Checkout (test card 4242) → back with session. The `experience_purchases` row: `status=paid`, `buyer_email` set, `amount_cents=49900`, `application_fee_cents=0`, `artist_transfer_cents=49900`, `buyer_user_id` set (Access account created), `access_granted_at` populated.

---

## ✅ TO-DO — what's still left (in rough priority)

### A. Make it real (before selling for real)
1. **Create the real Signature Work(s)** with real assets: private/domain-locked **Vimeo** performance + breakdown URLs, count-sheet URL, music note, artistic intent. *(The current test work is a placeholder with no video.)*
2. **Point `FOUNDER_PROFILE_ID` at Kathleen's REAL founder profile.** Right now it points at the **test** artist id (`b782d686…`). Create her real `talent_profile` and swap the id.
3. **Fill the booking links** in `.env.local`: `FOUNDER_WELCOME_BOOKING_URL` (Kathleen's Google Calendar) + `DEFAULT_CHECKIN_BOOKING_URL`.

### B. Flow A — the 80/20 split path (so OTHER artists can sell)
4. **Test artist Express onboarding** (`/api/connect/onboard`) with a Stripe **test Express** account → confirm `payouts_enabled` flips true via the `account.updated` webhook.
5. **Run a split purchase** under that artist → confirm Stripe shows **80/20** (`application_fee` 9980, transfer 39920) and the artist path grants access the same way.

### C. Notifications (currently safe stubs — they log, they don't send)
6. **Pick an email vendor** (Resend vs Postmark), set `EMAIL_API_KEY` + `EMAIL_FROM_ADDRESS`, implement the send in `src/lib/notifications.ts`. *(Register the email in `EMAILS.md` first — Guardrail #5.)*
7. **Wire MailerLite "The Climb"**: `MAILERLITE_API_KEY` + `MAILERLITE_CLIMB_GROUP_ID`.

### D. Edge cases & hardening
8. **Test refund → access revoked** (`charge.refunded`) and **payment failed** (`payment_intent.payment_failed`).
9. ~~**Clean up stale `pending` purchases**~~ — ✅ existing abandoned rows deleted (July 9). Only a reusable auto-sweep/expiry remains as an optional nicety.
10. **Resolve the buyer account-type question** — buyers are currently filed as `account_type='talent'` (flagged in `DECISIONS.md`).

### E. Go live (when ready to take real money)
11. Switch to **live** Stripe keys; create a **real webhook endpoint** in the Stripe dashboard (permanent `whsec_`, not `stripe listen`); set the live Supabase secret; point `NEXT_PUBLIC_SITE_URL` at the real domain; deploy.

---

## 📁 Reference
- **`docs/STRIPE-CONNECT-499-LICENSING.md`** — the full $499 build spec (Flows A/B/C, test plan, guardrails).
- **`CLAUDE.md`** — master brief (product rules, tiers, out-of-scope).
- Migrations: **`supabase/migrations/`**. Admin console: **`src/app/admin/signature-works/`**. Webhook: **`src/app/api/webhooks/stripe/route.ts`**.

*The hard part — the payment rails — is done and proven. What's left is content, the other-artist path, and wiring the notifications. — together we rise · relevé —*
