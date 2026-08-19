# Relevé — Membership + Marketplace Economics · AUDIT & PROPOSED ARCHITECTURE

*Phase 1 deliverable. Prepared 2026-08-14 by Claude Code at Kathleen's direction. **Audit only — nothing implemented, no migrations run, no Stripe or checkout economics changed.** This reports what exists, what conflicts with the new model, what is reusable, what would need to change, and the risks — for review before any Phase 2 work.*

> **New source of truth.** Kathleen's 2026-08-14 directive supersedes the marketplace economics in `Releve_Pricing_RATIFIED_2026-06-25...md` (the status-based split ladder) and the split language in `STRIPE-CONNECT-499-LICENSING.md` / `CLAUDE.md §3B`. Those docs are **not** deleted; they are historical. Where they describe *status → revenue split*, the new model wins.

---

## 0. The new model in one paragraph

Relevé has **two economically distinct systems.** **Connect** is professional infrastructure funded by annual membership; **Relevé takes 0% of any labor** a professional is hired for (teaching, coaching, setting, rehearsal, sessions, consulting…). **Marketplace** is commerce on intellectual property (choreography licenses, later other creative products); **Relevé earns a configurable fee when a license sells**, because it provides the infrastructure that makes the sale possible. Status/curation is **editorial only** — it never determines an artist's cut. Pricing is **forward** *(superseded 2026-08-14 — see `Marketplace_Phase2_Architecture_2026-08-14.md` §1.B; earlier drafts said "reverse/desired-net," which is retired)*: the artist **sets the buyer-facing list price**, Relevé's configurable fee is a **percentage of that price**, the artist bears processing, and the buyer sees **one clean price.**

---

## 1. What already exists (as built)

The codebase already implements **three distinct Stripe flows**, and they map cleanly onto the two-system model. All three are Stripe **Checkout Sessions** — there are **no Payment Links** anywhere.

| Flow | Code | Type | System |
|---|---|---|---|
| **Annual membership** | `POST /api/membership/checkout` → webhook `handleMembershipCheckout` | `mode: subscription`, one Stripe Price per tier, **one-way charge to Relevé, no Connect** | **Connect (membership)** |
| **$30 application fee** | `POST /api/applications/[id]/fee-checkout` → webhook `handleApplicationFeePaid` | `mode: payment`, inline price_data, **one-way charge to Relevé** | **Connect (onboarding)** |
| **$499 Signature Experience** | `POST /api/experiences/[workId]/checkout` → webhook (default branch) | `mode: payment`, **Stripe Connect destination charge with `application_fee_amount` + `transfer_data.destination`** | **Marketplace (licensing)** |

**Membership system (built and live):**
- `memberships` table — `tier`, `price_cents`, `term` (annual), `membership_status` (`pending|active|lapsed|canceled`), `stripe_customer_id`, `stripe_subscription_id`, `renewal_date`, `source`.
- Six tiers in `src/lib/membership/tiers.ts`: `live_pass` $99 · `professional` $149 · `professional_full` $199 · `studio_connect` $249 · `studio_growth` $499 · `studio_accelerator` $1,499. Each carries `applicationRequired`, `hasProfile`, `priceEnvVar`. Prices are real Stripe Prices created by `scripts/setup-stripe-tiers.mjs` (lookup keys `releve_<slug>_annual`).
- Access gates in `src/lib/membership/access.ts`: `hasActiveProfileTier` (Professional / Professional·Full → profile builder) and `hasAnyActiveMembership` (any tier → Roster browse).
- Activation paths: paid subscription (webhook), founding comp (`grantFoundingMembership`, `source='founding_comp'`), Founding Professional comp (`materializeEntitlement`, `complimentary_permanent`/`complimentary_term`). Downgrades: `subscription.deleted → canceled`, `invoice.payment_failed → lapsed`.

**Marketplace / licensing system (built for exactly one case):**
- Full Stripe **Connect Express** onboarding: `POST /api/connect/onboard` (creates `acct_…`, stores on `talent_profiles.stripe_account_id`), `return`/`refresh` routes, `talent_profiles.payouts_enabled`, UI at `/connect/payouts`. Ownership-guarded against payout hijack (`requireProfileOwner`).
- `signature_works` (the catalog piece: title, price_cents default 49900, Vimeo URLs, count sheet, status draft/published) and `experience_purchases` (order/ledger: `amount_cents`, `application_fee_cents`, `artist_transfer_cents`, status). Admin **authors** signature works (`/admin/signature-works`); public buys at `/experiences/[workId]`.
- The webhook creates the buyer's free Year-1 `access` membership on purchase, grants gated Vimeo access, and can refund + revoke.

**Professional Offerings (live in production, ON):** `professional_offerings` table, flag `isProfessionalOfferingsEnabled()`. **Carries no fee, no Stripe, no money** — it is a "what can I hire this person to do" catalog with CTAs (Inquire reuses the connections flow). Already structurally on the labor side. ✅

---

## 2. What conflicts with the new model

| # | Conflict | Where | Severity |
|---|---|---|---|
| **C1** | **Flat 20% fee is hardcoded.** `PLATFORM_FEE_BPS = 2_000` is a compile-time constant. The new rule: the marketplace fee must be **configurable from one controlled location** and **not activated until you approve the number.** | `src/lib/stripe/config.ts:12` | **High** — but contained (see risk §6) |
| **C2** | **Pricing is list-price-first, not reverse-priced.** The buyer is charged `work.price_cents` and the artist gets 80% of it. The new model is **artist-desired-earnings-first**: artist names a payout, the system computes the buyer price. No reverse-pricing calculator exists. | `experiences/[workId]/checkout/route.ts:97-98` | **High** (new capability) |
| **C3** | **Artist bears Stripe processing fees.** `on_behalf_of = artist` makes the artist the merchant of record, so Stripe's card fee settles out of the artist's share. Under reverse pricing, a "desired payout of $500" cannot be delivered exactly unless the calculator grosses up for processing (or Relevé absorbs it). **This is a real decision, not a bug.** | `experiences/[workId]/checkout/route.ts:129` | **Decision needed** |
| **C4** | **Docs (not code) tie status → split.** The pricing SSOT describes Emerging 60/40 / Established 70/30 / Signature 80/20. **Good news: `choreographer_tier` carries zero economic weight in code today** — it's already editorial. Only the *docs* assert the ladder. | `Releve_Pricing_RATIFIED...md §Marketplace`; enum in `setup.sql:138` | **Low** (docs-only; one enum has a retired `featured` value to clean up later) |
| **C5** | **Admin authors works; artists can't submit.** Today an admin creates `signature_works`. The new model has the **$199 artist submit** original work, which **admin approves** before it lists. The per-work approval seam exists (`status draft/published` + admin publish), but the artist-submission workflow does not. | `/admin/signature-works/*` | **Medium** (workflow gap) |
| **C6** | **No "marketplace seller" entitlement.** $199 (`professional_full`) exists and its description already says "Marketplace + Audition Library," but there is no `hasMarketplaceSellerAccess()` gate deriving seller tools from the tier. | `tiers.ts`, `access.ts` | **Low** (additive helper) |

**Not conflicts (already aligned — preserve):**
- Memberships are one-way charges, never Connect. ✅ matches "Connect = labor protected."
- The $499 licensing sale already uses a **destination charge**, so funds route to the artist's connected account and **Relevé never custodies the artist's money** — it keeps only its `application_fee`. ✅ matches "Relevé should not unnecessarily custody artist funds."
- Professional Offerings has no fee path. ✅ matches "do not apply Marketplace fees to Offerings."
- Buyer already sees one clean line item (`Signature Experience — <title>`), no itemized fees. ✅ matches the clean-commerce principle.

---

## 3. What can be reused (most of it)

- **The three-flow Stripe architecture** is the right spine — it already separates membership (one-way) from marketplace (Connect split). No re-architecture needed.
- **Connect Express onboarding** (`onboard`/`return`/`refresh` + `payouts_enabled`) is exactly the "manage payouts/Stripe Connect" seller capability. Reuse as-is.
- **`signature_works` + `experience_purchases`** are the listing + order/ledger tables. **Generalize** `signature_works` into the broader marketplace listing model; Senior Spotlight becomes the *first collection*, not the whole thing.
- **Webhook + `processed_stripe_events` idempotency + service-role-only writes** — reuse the discipline for all new money events.
- **Tier system + access-helper pattern** (`tiers.ts` / `access.ts`) — add seller entitlement the same way existing gates are written.
- **The destination-charge, no-custody model** — keep. It is already the "Relevé doesn't hold artist funds" architecture.

---

## 4. What would need schema / Stripe changes (PROPOSED — not built)

*All of this is Phase 2 proposal for your sign-off. None applied.*

**Schema (additive migrations, no drops):**
1. **A single marketplace-fee config record** — e.g. `marketplace_config(id, platform_fee_bps, effective_from, note)` or a row in an `app_config` table. **One controlled location**, admin-editable, read everywhere. Replaces the `PLATFORM_FEE_BPS` constant. Seed it **inactive / clearly test-only** until you approve the number.
2. **Reverse-pricing fields on the listing** — `desired_payout_cents` (what the artist wants), `published_price_cents` (computed, what the buyer sees), plus a stored snapshot of the fee model used at publish time (so a later fee change never rewrites a live listing's math — same snapshot discipline as `experience_purchases`).
3. **Collection / category taxonomy** — so `Marketplace → Senior Spotlight → General Licensing → Commissions → …` nest over shared listing infra without flattening Senior Spotlight's curated experience.
4. **Artist submission + approval workflow fields** — `submitted_by`, `submission_status` (draft → submitted → approved → listed / rejected), reviewer, timestamps. Per-work curation stays admin-controlled.
5. *(Later phases)* the rights/license-terms record and the exclusivity conflict engine from `Rights_Management_Design_2026-07-20.md` — already fully designed there; not needed for the fee/pricing engine.

**Stripe:**
1. **Fee becomes config-driven**, read from #1 above — not the constant. **Do not activate real-money marketplace pricing until you approve the final fee.**
2. **A reverse-price calculator that models Stripe processing** — a pure function `publishedPriceForDesiredPayout(desiredPayoutCents, feeBps, processingModel)` and its inverse `breakdown(publishedPriceCents, …)` → { artist desired earnings, published price, Relevé revenue, processing treatment, expected payout } for the private seller dashboard. Buyer sees one number; artist sees the full breakdown.
3. **Resolve C3** (who bears processing) — decides how the gross-up is computed. See §7 Decision 2.

**No change to fund custody** — the destination-charge model already avoids Relevé holding artist funds. Keep it.

---

## 5. The $30 application fee — reported separately (as requested)

**Exactly how it works today:**
- **Charge:** `POST /api/applications/[id]/fee-checkout` creates a Checkout Session, `mode: payment`, **inline `price_data`** for **$30 (3000¢)** named "Relevé application fee" — **it does NOT use a saved Stripe product/price.** It is a **one-way charge to Relevé** (no Connect, no transfer). Idempotency-guarded so a settled application can't be charged twice.
- **What it grants:** on payment, the webhook (`kind: 'application_fee'`) marks the fee `paid` and moves the application **`submitted → in-review`** (it funds the council's vetting). **It does not grant membership.**
- **Credited toward annual membership: YES.** When the approved applicant subscribes to a vetted tier, `membership/checkout` finds their `paid` fee and applies a **one-time $30-off coupon** (`releve_app_fee_credit_30`, `amount_off: 3000`, `duration: once`) to the first invoice; the webhook marks the fee row `credited`.
- **Founding-25:** `is_founding_25` → fee row `waived`, straight to review, no charge.
- **Refund:** admin `decline` refunds a `paid` fee in full.
- **CURRENT STATE: DORMANT.** The free founding period means approval comps membership and applicants are never routed to fee-checkout, so this flow does not run in production today.

**Recommendation:** **change nothing here now.** It already implements the ratified intent ("credited toward membership when accepted, refunded if not accepted") and it's dormant. How the $30 entry point transitions into the $149/$199 annual structure is a **separate, explicit decision** to make later — not folded into this work. Preserve the intentional launch behavior.

---

## 6. Migration & production risk

- **Lowest-risk path is exactly what you asked for: audit + design now, no economic changes.** Nothing in this document requires touching live checkout.
- **Do-not-regress baseline is safe:** none of the proposed work touches Professional Offerings (ON), the membership flow (live), messaging, Studio/Team/Family, or admin flows.
- **Live-money risk — CONFIRMED ZERO (read-only query, prod, 2026-08-14).** The Marketplace subsystem is **greenfield in production**: `experience_purchases` = **0 rows** (no sales, founder or third-party), Connect payout accounts = **0**, `payouts_enabled` = **0**, `signature_works` = **0**, `application_fee_payments` = **0** (confirms the $30 flow is dormant). Active memberships = **1** (the founder's own), with **0** on `professional_full`. Generalizing the fee model, adding reverse-pricing, and relabeling tiers therefore disrupts **no historical transaction and re-charges no one.**
- **User → tier mapping (before any migration):** see §8. The headline: **this is a label change, not a data migration** — nobody gets re-charged, no comp/founder access is removed.

---

## 7. User → new-tier mapping (report before migrating, as requested)

The new two-tier framing already exists in the data — **the slugs don't need to change:**

| New label | Existing slug | Price | Change |
|---|---|---|---|
| **Professional** | `professional` | $149 | **Label only.** No data change. |
| **Professional + Marketplace** | `professional_full` | $199 | **Rename display** from "Professional · Full"; **add** a `hasMarketplaceSellerAccess` entitlement derived from this tier. No price change, no re-charge. |

- **Existing approved professionals** hold comp/paid memberships on `professional` (`founding_comp`, `complimentary_permanent/term`, or `self_subscribe`). They **keep** their tier and access. Changing a *label* never re-bills a subscription.
- **Founder, Founding Professional, invited cohorts, Founding 25** — all preserved; their entitlements are identity/complimentary rows independent of the labels.
- **Live Pass ($99) and the studio tiers** stay as-is; they're outside the Professional/Marketplace axis this directive addresses.
- **No destructive migration.** The only cleanups (optional, later): add `access` + studio slugs to the `TierSlug` union (today handled by a defensive price fallback), and retire the `featured` enum value.

---

## 8. Decisions I need from you before Phase 2 design is final

1. **Confirm the fee is fully configurable + inactive until you set it.** I'll wire the calculator to a config record and leave marketplace pricing OFF (behind a flag, like Offerings) until you approve the number. No hardcoded percentage anywhere. *(Assumed yes — confirming.)*
2. **Who bears Stripe processing on a license sale?** → **RESOLVED 2026-08-14: the ARTIST bears it** (matches today's `on_behalf_of = artist` behavior — no Stripe change). Pricing is **forward** (superseding note): the artist **sets the buyer-facing list price**; the fee is a **percentage of that list price**; processing is then artist-borne. The seller dashboard shows four estimated lines — *listed price · est. Relevé fee · est. processing · est. payout* — honest without guaranteeing a net. *(The earlier "reverse/desired-net" framing here is retired — see `Marketplace_Phase2_Architecture_2026-08-14.md` §1.B, §4.)*
3. **Scope of "Marketplace" for the first build** — confirm we generalize `signature_works` into a listing model with Senior Spotlight as collection #1, rather than build a parallel system. (Reuse, don't fork.)
4. **Leave the $30 flow untouched for now?** *(My recommendation: yes.)*

**Nothing proceeds to code until these are settled.**

---

## 9. Protection & Provenance layer — MVP scope (added 2026-08-14)

*Source: `Releve_IP_Protection_Breakdown.docx`, treated as **HISTORICAL DESIGN INPUT, not current requirements** (Kathleen's instruction). The docx uses the retired name "Relevé Create" and ties protection strength to "Signature-tier" artists — **both corrected below.** Only the realistic MVP portions are carried forward. Cost/budget modeling in the docx is **out of scope for engineering** — that's the founder + accountant conversation; the old figures are explicitly void and to be re-priced from scratch.*

**Why this belongs in Marketplace at all.** The fee is justified because Relevé builds the infrastructure that makes ownership *commercially useful* — discovery → controlled preview → transaction → **license terms → payment routing → buyer record → artist record → delivery → provenance** → (later) enforcement support. **"The Marketplace does not claim ownership of the work; it creates the record around it."** Baseline protection is **part of every Marketplace transaction**, not an upsell.

**Governing correction (ratified 2026-08-14):** protection strength scales with the **license type / value / risk** (an Exclusive or Limited license warrants stronger controls), **NOT with artist status** — status is editorial. This keys cleanly off the license-type dimensions already designed in `Rights_Management_Design_2026-07-20.md` (Standard · Limited Edition · National Exclusive).

### The four promises, MVP-scoped

| Promise | Launch decision | MVP requirement | Code reality |
|---|---|---|---|
| **Watermarking** | **KEEP, simplified** | "Previews are protected and watermarked; **licensed delivery is tied to the buyer + transaction record**." Client-side/short watermarked previews now; provider-burned watermark (Cloudflare Stream / Mux) when paid delivery is live. **No** forensic/screen-record-resistant claim unless that tech is actually purchased. | **Not built.** `signature_works` hold private/domain-locked Vimeo URLs; no watermarking, no per-buyer delivery copy. |
| **License of Record** | **KEEP — central** | **Every Marketplace sale produces a durable License of Record**: choreographer → buyer → work → date → price → license type → duration → permitted use → geo/exclusivity → transaction ID. **Do NOT** commit to a per-sale e-signed PDF (DocuSign/Dropbox Sign) — counsel decides the acceptance/signature mechanism per transaction type. | **Partial seam only.** `experience_purchases` records the *money* (amount, fee, transfer, status, session ids) but **no license terms**. No rights/terms table exists. |
| **Infringement response** | **KEEP idea, REDUCE promise** | "Relevé **maintains the transaction & licensing record and provides tools + documentation** to support an artist when unauthorized use is reported." **NOT** "Relevé is your copyright enforcement department." Platform-managed enforcement is a later graduation, after counsel. | **Not built.** Nothing. |
| **Competition monitoring** | **REMOVE from launch** | Not promised for $199. A future technology/service, not a launch commitment. | **Not built** (correctly). |

### Architectural implications for Phase 2 (design only — not built)

1. **License of Record = the granted-license terms record** — this is the convergence point of the IP doc, the email, and `Rights_Management_Design`. It's a record that **snapshots the full terms at sale time** (like `experience_purchases` already snapshots the money). Extends the existing order row rather than forking. This single record is the provenance spine that justifies the fee.
2. **Delivery control** — move from "permanent public URL" to **buyer-tied, revocable delivery** (signed/expiring links; provider watermark later). `Rights_Management_Design` already flags this as required (its build-order step 4).
3. **Protection tier is derived from license type**, not artist — a clean switch: Standard = baseline; Limited/Exclusive = stronger controls. No status coupling.
4. **Infringement = record + document support**, modeled as artist-facing tooling that assembles the License of Record into a claim packet — **not** an automated takedown engine, and **not** an enforcement-rights assignment, until counsel structures it.

### Explicit launch non-goals (do not build, do not promise)
Forensic/screen-recording-resistant watermarking · automated/platform-run DMCA takedowns · enforcement-rights assignment · proactive competition monitoring · per-sale e-signature PDFs · the retired "Relevé Create" name. All are post-launch graduations gated on counsel and real volume.
