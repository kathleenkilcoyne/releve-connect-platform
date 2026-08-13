> **⚠️ SUPERSEDED 2026-08-12** by **`docs/MEMBERSHIP-MODEL-PLAN.md`** — the unified
> plan covering Professional · Studio · Team, with the standardized **60-day**
> access period (the "30 days" below was retired) and the generalized `activations`
> ledger. Kept for history; where this disagrees with the unified plan, the unified
> plan wins.

# Professional Roster Activation — Implementation Plan (superseded)

*Approved by Kathleen 2026-08-12. Supersedes the old "free 12-month founding
membership" model FOR PROFESSIONAL ROSTER MEMBERS ONLY. Studios are a separate
ecosystem and are NOT touched by this work.*

---

## The model (locked)

1. Application is **free**; no payment to submit.
2. Relevé **vets**; approval is **vetting only**.
3. Once approved, the professional **stays approved whether or not they activate**.
4. After approval they are offered **Professional Profile activation for $30**.
5. Paying $30 begins **30 days** of Professional access (the clock starts at payment).
6. The **full $30 is credited** toward the continuing Professional subscription
   **only if they elect to continue during the 30-day window**.
7. The credit **does not persist** — if the 30 days lapse without continuing, the
   $30 is **forfeited**. It is not cash value and not an account balance if they leave.
8. If they never activate, they remain approved but have **no active Professional
   access** (no profile build/publish, not on the Roster).
9. At day 30 they must transition to the continuing subscription to remain active.

**Non-negotiables:** free application · vetting determines acceptance · $30 after
approval · $30 → 30-day access · full $30 credited toward continuing subscription
(time-boxed) · approval never revoked for non-payment · **no** auto free 12-month
membership for professionals · **studios untouched** · no Senior Spotlight
pricing/splits, licensing checkout, The Beat, or messaging in this work · preserve
the completed licensing work · nothing deploys without explicit approval.

---

## Architecture decision: **B** — a distinct Professional Activation concept

Reuse only the **safe Stripe primitives** (`getStripe`, `siteUrl`, the webhook
signature-verification + `processed_stripe_events` idempotency guard, Checkout in
`mode: 'payment'`). Do **not** rename the old `application_fee`: its webhook flips
state → `in-review`, its meaning is "refunded if not accepted", and its table is
named for the *application* — all wrong for a post-approval, forfeitable,
vetting-independent charge. Leave the old application-fee machinery **dormant** for
eventual retirement; delete no historical data.

### The one principle: two separate state machines
- **Vetting** → `applications.state`: `Submitted → In Review → Approved / Declined /
  More-Info`. **Payment never writes here.**
- **Membership / Activation** → `memberships` (+ new `professional_activations`):
  `Approved-Not-Activated → 30-Day Access → Continuing Subscriber / Expired`.
  **Vetting never writes here.**

Access is granted by the **`memberships`** row (the existing `hasActiveProfileTier`
gate needs no change). The `professional_activations` row is the **payment + credit
ledger**.

---

## Credit architecture (locked policy → clean design)

The credit is **time-boxed and forfeitable**, so we must NOT pre-load a Stripe
customer-balance credit (that would persist and auto-apply forever). Instead:

- On payment we **record the credit as data**, banking no money in Stripe.
- The credit is applied **only at continuation, only if `now ≤ access_expires_at`**,
  as a **one-time `amount_off: 3000`** on the first continuing-subscription invoice
  (Stripe coupon or a negative first-invoice line), gated by our DB row.
- If the window lapses → credit **forfeited** (marked, never applied).

**Price-agnostic:** the $30 is a fixed subtraction, independent of the subscription
price. When the price is set later (via `stripePriceId()` env config), the
continuing-subscription slice creates the subscription at that price and attaches
the $30 discount — **the activation system does not change.**

### `professional_activations` — two parallel lifecycles
- `status`: `pending → active → converted | expired`
- `credit_status`: `available → applied | forfeited`

Transitions (all vetting-independent):
- **paid** → `active`, access window set (start = payment, expires = +30d), credit `available`
- **continue within window** → `converted`, credit `applied` (one-time $30 off first invoice)
- **window lapses w/o continue** → `expired`, credit `forfeited`

---

## The 10 areas (condensed)

1. **Applicant journey.** Approval creates **no membership**. Next visit → activation
   screen. One "approved + activation invite" email. Click Activate → $30 Checkout →
   30-day access on. Do nothing → stays approved, prompted to activate; optional
   reminders. Approval never expires.
2. **Activation screen (`/activate`, and `/subscribe` repurposed for
   approved-not-activated):** "You've been accepted to the Relevé Professional
   Roster. Activate your Professional Profile — **$30 · 30 days of access.** Your full
   $30 is credited toward your continuing subscription. [Activate for $30] · Not now —
   you'll stay approved."
3. **Stripe.** New `POST /api/professional/activation-checkout` (approved caller,
   creates a `pending` activation row + Checkout, `metadata.kind:
   'professional_activation'`). New webhook branch (dedup via
   `processed_stripe_events`): mark paid, set the 30-day window, **create the 30-day
   Professional membership**, record the credit. **Never touches `applications.state`.**
4. **Membership/access.** Remove the auto free grant **for professionals only**
   (behind a feature flag); studios unchanged. Approved-Not-Activated = approved +
   no active membership. Access unlocks on payment (membership row). Clock starts at
   payment. Day 30 w/o subscription → membership lapses, profile leaves the Roster,
   **approval stays**. Lapse via lazy on-access check + optional cron.
5. **Credit.** As above — recorded on `professional_activations`, applied one-time at
   continuation within the window, else forfeited; price-agnostic.
6. **Code/data.** Change: admin approve route (professional branch: drop
   `grantFoundingMembership`, send new email), webhook (new branch), `/subscribe`,
   notifications + `EMAILS.md`, tiers (new `ACTIVATION_FEE_CENTS`). New:
   `professional_activations` table, activation-checkout route, `/activate`,
   `activation.ts` (+ tests), optional expiry cron. Obsolete-but-dormant:
   fee-checkout, webhook `application_fee` branch, `grantFoundingMembership` (for
   professionals), decline-refund, "founding period"/"application fee" copy,
   `application_fee_payments` (kept as history).
7. **Admin.** Vetting queue stays vetting-only (done). Membership/activation status
   (Approved-Not-Activated · Active-30-Day · Active Subscriber · Inactive/Expired)
   lives in a **separate** members/roster admin view, not the vetting queue.
8. **Emails (map only):** submitted (exists) · approved+invite · activation success ·
   ~day-25 reminder · expired/subscription-needed. Via Resend + MailerLite tags; in
   `EMAILS.md` before sending.
9. **Safety.** Additive migration only; preserve profiles, public pages, licensing,
   admin licensing, application workflow, RLS, data. Rollback: model switch behind a
   **feature flag** (flip to restore old grant, no redeploy); drop the new table to
   reverse schema. Tests: activation state machine, 30-day window math, credit
   transitions, the **payment-never-changes-`applications.state`** invariant, webhook
   idempotency, gate behavior. Local test: Stripe TEST mode + card 4242 + `stripe
   listen` CLI webhook + feature flag + clearly-labeled TEST data, cleaned up after
   (no staging DB — same method used for licensing).
10. **Build sequence:**
    0. Plan approved + policies locked (this doc).
    1. **Data + pure logic** — additive `professional_activations` migration +
       `activation.ts` state machine + tests. *Dormant.* ← current slice
    2. Stop the free grant (professional-only, flagged) + surface Approved-Not-Activated.
    3. Activation checkout + webhook + 30-day membership + credit recording (Stripe TEST).
    4. Activation screen + `/subscribe` repurpose.
    5. Day-30 expiry (lazy + optional cron).
    6. Admin members/roster status view.
    7. Continuing subscription + apply the $30 credit (price inserted here).
    8. Emails + retire obsolete application-fee framing.

Each slice: build → test locally → review → next. No deploy until approved.
