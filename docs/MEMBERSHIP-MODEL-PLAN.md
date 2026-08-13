# Relevé Membership Model — Unified Plan (source of truth)

*Approved by Kathleen 2026-08-12. Supersedes `PROFESSIONAL-ACTIVATION-MODEL-PLAN.md`
(professional-only). Covers all membership families: Professional, Studio, and
Team (Team reserved in the model, flow not yet built).*

---

## 1. Architecture

**Two membership families, one principle.**

| Family | Members | Flow |
|---|---|---|
| **Organization** | **Studio**, **Team** *(reserved)* | invite → **$30 activation → 60-day pilot** → select annual tier → subscriber \| expired |
| **Individual Professional** (the Roster) | **Teacher · Choreographer · Working Dancer** *(+ future explicit pro roles)* | free application → vetted → approved → **$30 activation → 60-day access** → continuing subscription → subscriber \| expired |

**Principle — "membership follows the role being used."** Owning a studio never
grants free Roster access; a studio owner who wants their own professional profile
activates it separately. A person can hold both an org membership and an individual
membership (the data model already allows multiple membership rows per user).

**The universal $30 activation** — the *first money toward membership*, not an
add-on fee. It opens a time-boxed access window and is **credited toward the
continuing subscription if they continue within that window**, otherwise
**retained/forfeited** (never a cash balance).

**Standard flow, all families:** `$30 → 60-day pilot/access → select membership →
$30 credited toward the first subscription invoice (if they continue in-window)`.

### Access period — STANDARDIZED and CONFIGURABLE (correction 2026-08-12)
The initial paid access period is **60 days across Professional, Studio, and Team**
(the earlier professional "30 days" was inherited, not ratified — retired). The
duration is **configurable in one place** (a per-family config, default **60**, so
it can be tuned per family or globally without a rebuild). `60/60/60` today.

**Prices (ratified):** Professional $149 · Professional·Full $199 · Studio
**Foundation** $249 · Studio Growth $499 · Studio Accelerator $1,499. Team: TBD.

---

## 2. The generalized activation ledger
Evolve the empty, dormant `professional_activations` → one clean **`activations`**
ledger (safe rename + extend — no data to migrate):

| Column | Purpose |
|---|---|
| `activation_id` | PK |
| `membership_family` | **`professional` · `studio` · `team`** (check) — the discriminator |
| `user_id` | the person (professional, or studio/team owner) |
| `employer_id` (nullable) | the org, for studio/team activations |
| `application_id` (nullable) | the approved application, for professionals |
| `amount_cents` / `credit_cents` | $30 paid / $30 credit |
| `status` | `pending → active → converted \| expired` |
| `access_started_at` / `access_expires_at` | window (start = payment; `+ configured days`) |
| `credit_status` | `available → applied \| forfeited` |
| `credit_applied_at` / `credit_forfeited_at` | timestamps |
| `stripe_checkout_session_id` / `stripe_payment_intent_id` | Stripe refs |
| `membership_id` (nullable) | the membership this converts into |
| `created_at` / `updated_at` | — |

**Team is a valid `membership_family` value now** (reserved). `activation.ts` becomes
family-aware, reading the access period from config (60 default). Owner-read RLS;
service-role writes.

**Two lifecycles (both families):**
- `status`: `pending → active → converted \| expired`
- `credit_status`: `available → applied \| forfeited`
- paid → `active` + window opens (+60d) + credit `available`
- continue in-window → `converted` + credit `applied` (one-time $30-off first invoice)
- window lapses → `expired` + credit `forfeited`

---

## 3. Access model (unified)
**The ledger's active window grants access** for both families, and each gate checks
*(active ledger window) OR (active paid membership)*:
- **Professional:** `hasActiveProfileTier` (+ ledger window) gates the profile
  builder / publish / Roster. Approved-Not-Activated = approved + no active
  window/membership → activation prompt.
- **Studio:** a **new** gate in `requireStudioAccess` (today it checks owner/staff
  only, no payment) considers *(active pilot window) OR (active studio
  subscription)*. Rolled out behind a flag, **with the existing test studio
  explicitly whitelisted** so it can never be locked out.
- **Team:** reserved — no gate change until the Team model arrives.

---

## 4. The $30 credit (universal, price-agnostic)
Recorded in the ledger; **not** banked as a Stripe balance (would persist — against
policy). Applied **only at continuation, only within the 60-day window**, as the
existing one-time **`amount_off: 3000` coupon** on the first subscription invoice
(already implemented in `api/membership/checkout`). Repoint that route's credit
check from the old `application_fee_payments` to the **`activations` ledger**.
Fixed $30 subtraction, independent of the (future/configurable) tier price — set
prices via the existing `priceEnvVar` config, no activation rebuild.

---

## 5. Relabel (decision, 2026-08-12)
"Studio Connect" → **"Studio Foundation"**: change the **`label`** in `tiers.ts`
only. Internal slug stays **`studio_connect`** (no data migration). Sweep
customer-facing "Studio Connect" copy → "Studio Foundation".

---

## 6. What exists vs. what we build (from the audit)
**Exists / reuse:** the Founding-Studio invite onboarding; `api/membership/checkout`
(annual auto-renew subscription for all tiers, incl. studios); the $30 one-time
coupon mechanism; the Stripe webhook + `processed_stripe_events` dedupe; the
`memberships` gate for professionals.

**Build:** generalize the ledger; stop the professional free grant (flagged); the
$30 activation checkout + webhook (both families); the 60-day window logic; the
studio access gate (net-new — studios are ungated today — with test-studio
whitelist); the activation screens; day-60 expiry; repoint the credit to the
ledger; the admin status view; emails; retire obsolete framing.

**Obsolete → dormant, then retire (no data deletion):** `grantFoundingMembership`
(the free 12-month grant — for BOTH professionals and studios), the old
`application_fee` semantics/webhook branch, `fee-checkout`, "free founding period"
/ "application fee" copy, `application_fee_payments` (kept as history).

---

## 7. Grandfathering
No live studio membership exists → nothing to migrate. The **test studio is
whitelisted** in the new studio gate. Kathleen's own professional `founding_comp`
membership is left as-is for now (convert later if desired — flagged, untouched).

---

## 8. Slice sequence (safe, flag-gated, no deploy without per-slice approval)
| # | Slice | Track | Notes |
|---|---|---|---|
| **1′** | Generalize ledger → `activations` (+ `membership_family`, `employer_id`) + family-aware, **configurable 60-day** `activation.ts` + tests | shared | additive/empty — safe |
| **A** | Relabel Connect→Foundation | studio | trivial copy |
| **2** | Stop free grant — professionals only, flagged; surface Approved-Not-Activated | prof | flag-off = no change |
| **3** | Professional activation checkout + webhook + credit (60-day) | prof | Stripe TEST |
| **4** | Professional activation screen + `/subscribe` repurpose | prof | UI |
| **5** | Professional day-60 expiry (lazy + cron) | prof | — |
| **6** | Studio activation + 60-day pilot ledger | studio | Stripe TEST |
| **7** | Studio access gate (test-studio **whitelisted**, flagged) | studio | careful rollout |
| **8** | Studio pilot→annual + $30 credit | studio | reuse checkout |
| **9** | Admin members/roster status view (both families) | admin | read view |
| **10** | Emails (both families) + retire obsolete application-fee/founding framing | shared | copy |

**Team flow** slots in later, after the Team model is sent. Its `membership_family`
value, ledger support, and 60-day config are reserved from Slice 1′.

Each slice: build → test locally (Stripe TEST + `stripe listen` + labeled TEST data,
cleaned up) → review → next. **No deploy without approval.**

---

## 9. Non-negotiables
Free application · vetting-only approval · $30 after approval (prof) / $30-first
(studio) · **60-day** time-boxed access, credit forfeited on lapse · approval never
revoked for non-payment · studios changed only per the ratified ladder · **test
studio never locked out** · **Team reserved, not built** · keep `studio_connect`
slug · no Senior Spotlight pricing/splits, licensing checkout, Beat, or messaging ·
licensing + This Week work preserved · nothing deploys without approval.
