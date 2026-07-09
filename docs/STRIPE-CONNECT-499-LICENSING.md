# Build Spec — Stripe Connect (Express) + the $499 Signature Experience

*Implementation guide for the Senior Spotlight licensing flow. Prepared July 8, 2026. Read alongside `CLAUDE.md` §4G, the financial canon (80/20), and `docs/SETUP-SUPABASE.md`.*

> **Golden rule:** memberships are simple one-way charges to Relevé (no Connect). **Only the $499 Signature Experience uses Connect + the 80/20 split.** Teaching/hiring wages never touch Relevé's payment system.

---

## 0. What we're building

A student buys a **$499 Signature Experience**. The money runs through **Stripe Connect (Express)**: **80% ($399.20) goes to the choreographer's own connected account, 20% ($99.80) stays with Relevé** as an application fee. Stripe issues the artist's 1099-K. On success, the purchase **creates/attaches the buyer's Access account** (Year 1 included), unlocks the gated experience (private Vimeo + notes + count sheet), and surfaces the two session booking links.

Charge type: **destination charge with `application_fee_amount`** (Relevé is the merchant of record; funds route to the artist). This keeps checkout on Relevé and matches the canon.

---

## 1. Prerequisites (Kathleen, in the Stripe dashboard — no code)

1. Platform account = **Relevé Connect LLC** (done).
2. **Enable Connect** → Settings → Connect; complete the platform profile; choose **Express** as the connected-account type; add Relevé branding (logo/name) for the onboarding screens.
3. Stay in **test mode** for the build.
4. Env vars (already slotted in `README` / `.env.local`):
   - `STRIPE_SECRET_KEY` (test)
   - `STRIPE_WEBHOOK_SIGNING_SECRET` (test)
   - `NEXT_PUBLIC_SITE_URL`

*Kathleen's own works need no connected account for the first proof — she keeps 100% of her own sale. Connect matters when other artists onboard.*

---

## 2. Data model additions (reconcile with `schema.sql`)

Extend, don't re-architect (CLAUDE.md §6 says design the seams). Suggested:

- **`talent_profile`** → add `stripe_account_id` (text, nullable) and `payouts_enabled` (bool, default false). Set when the artist finishes Express onboarding.
- **`signature_work`** (new — the catalog piece): `id`, `profile_id` (FK → artist), `title`, `style`, `length_label` (e.g. "2 min"), `level`, `built_for` (short text), `price_cents` (default 49900), `vimeo_performance_url`, `vimeo_breakdown_url`, `count_sheet_url`, `music_note`, `artistic_intent`, `status` (draft/published), `created_at`. *(This is the "video reels become sellable catalog pieces" seam from CLAUDE.md §3.)*
- **`experience_purchase`** (new — the order/relationship record): `id`, `signature_work_id` (FK), `buyer_user_id` (FK → the Access account created at purchase), `stripe_checkout_session_id`, `stripe_payment_intent_id`, `amount_cents`, `application_fee_cents`, `artist_transfer_cents`, `status` (pending/paid/refunded), `access_granted_at`, `welcome_booked_at`, `checkin_booked_at`, `created_at`.
- **`membership`** (existing) → the purchase creates an Access membership for the buyer with `tier = access`, `membership_status = active`, `term = annual`, `renewal_date = +1 year`, and a flag/source noting it was **bundled with a Signature Experience** (Year 1 free; $99 renewal starts next cycle).

---

## 3. Flow A — Artist onboarding (Express)

1. Artist (a Founding 25 choreographer) is on their profile → clicks **"Connect payouts."**
2. Server: `stripe.accounts.create({ type: 'express', country: 'US', capabilities: { transfers: {requested:true}, card_payments:{requested:true} }, business_type:'individual' })` → store the returned `acct_…` as `talent_profile.stripe_account_id`.
3. Server: `stripe.accountLinks.create({ account, type:'account_onboarding', refresh_url, return_url })` → redirect the artist to the hosted onboarding (they enter their own bank/tax info — Relevé never sees it). **Account Links are single-use.**
4. Webhook `account.updated` → when `charges_enabled && payouts_enabled`, set `talent_profile.payouts_enabled = true`. Only then can their works be purchased.

---

## 4. Flow B — Purchase the $499 Experience (destination charge)

On the gated buy action for a published `signature_work`:

```
stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{ price_data: {
      currency: 'usd',
      unit_amount: work.price_cents,            // 49900
      product_data: { name: `Signature Experience — ${work.title}` }
    }, quantity: 1 }],
  payment_intent_data: {
    application_fee_amount: Math.round(work.price_cents * 0.20),  // 9980 = Relevé 20%
    transfer_data: { destination: artist.stripe_account_id }       // 80% → artist
  },
  client_reference_id: buyerRef,               // ties back to the purchase
  customer_email: buyerEmail,
  success_url, cancel_url,
  metadata: { signature_work_id, artist_profile_id }
})
```

- **Kathleen's own works:** omit `transfer_data`/`application_fee_amount` — she keeps 100% (she's artist + platform). Use this path for the first end-to-end proof.
- Create the `experience_purchase` row as `pending` with the session id.

---

## 5. Flow C — On payment success (webhook: `checkout.session.completed`)

Verify signature with `STRIPE_WEBHOOK_SIGNING_SECRET`, then:

1. Mark `experience_purchase.status = paid`; record `payment_intent_id`, `application_fee_cents`, `artist_transfer_cents`.
2. **Create/attach the buyer's Access account:** if no user for `customer_email`, create one (magic-link invite); create a `membership` row (`tier=access`, active, Year 1, renewal +1yr, bundled flag).
3. **Grant access** to the gated experience page for `signature_work_id` (performance + breakdown Vimeo embeds, count sheet, notes).
4. **Surface booking links:** founder Welcome (Kathleen's Google Calendar link) + the artist's Check-In link.
5. **Email** (add to `EMAILS.md` first — no hidden triggers): one buyer confirmation with access + booking links.
6. **MailerLite:** add buyer to The Climb.

Other webhooks to handle: `account.updated` (Flow A), `payment_intent.payment_failed` (mark purchase failed), `charge.refunded` (mark refunded, revoke access).

---

## 6. Gating & delivery

- The experience page checks: is there a `paid` `experience_purchase` for this `buyer_user_id` + `signature_work_id`? If yes → render private Vimeo embeds (domain-locked) + downloads. If no → paywall.
- Vimeo videos stay **private / domain-locked** so links only play when embedded on releveconnect.com.

---

## 7. Test plan (test mode)

1. Create a **test Express account** for a fake artist; complete onboarding with Stripe's test data; confirm `payouts_enabled` flips true.
2. Publish a test `signature_work` under that artist.
3. Buy it with test card `4242 4242 4242 4242` → confirm: split shows 80/20 in the Stripe dashboard, `experience_purchase` = paid, Access membership created, gated page unlocks, booking links appear, confirmation email fires.
4. Repeat with **Kathleen's own work** (no split) to prove the founder path.
5. Test refund → access revoked.

---

## 8. Guardrails (do not violate)

- **Only licensing uses Connect.** Memberships stay simple charges; wages never touch RC.
- **Access is bundled, not a separate charge.** Year 1 free with the $499; $99 renewal begins the following cycle (Aug 2027 for launch buyers).
- **Stripe issues the artist's 1099-K**, not Relevé.
- **Every email in `EMAILS.md`** before it's built — no hidden triggers (Guardrail #5).
- Artist can't sell until `payouts_enabled = true`.

---

*Build order: (1) Kathleen enables Connect/Express in the dashboard; (2) build Flow B + C against her own work (no split) to prove the loop; (3) add Flow A so other artists onboard and the 80/20 split goes live.*
