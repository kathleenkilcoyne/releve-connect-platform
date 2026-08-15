# Relevé — Marketplace Phase 2 Architecture · Revision 2

*Prepared 2026-08-14 by Claude Code. **Rev 2** integrates Kathleen's ratified resolutions of Open Decisions A–D and her ring-fencing clarification (share the machinery, ring-fence the economics). **ARCHITECTURE ONLY — nothing implemented, migrated, deployed, or changed in production.** Reads on top of `Marketplace_Economics_AUDIT_2026-08-14.md` and `Rights_Management_Design_2026-07-20.md`.*

---

## 0. Ratified boundaries (Kathleen, 2026-08-14)

1. **Senior Spotlight is ring-fenced** — $499 fixed retail, curated/select choreographers, artist 80 / Relevé 20, artist bears processing, **no membership included or granted.** Not renamed, not merged.
2. **General Marketplace is a separate economic system** — licensing + commissions for vetted **Professional + Marketplace ($199)** sellers. **Status editorial only, never economic.** **One configurable Relevé fee**, no hardcoded rate, **shipped INACTIVE**, rate changeable later without migrations or status changes.
3. **Forward pricing; artist bears processing.** The artist **sets the buyer-facing list price.** Relevé fee = a percentage **of that list price.** Seller UI shows list price · est. Relevé fee · est. Stripe processing · est. payout. **No exact-net guarantee. Buyer sees one clean price.**
4. **License of Record is the center** — one durable, immutable granted-license record snapshotting terms at purchase. Relevé never owns the choreography.
5. **Licensing inventory built for future controls** — Standard/Open, Limited, Exclusive; future limits on count, geography, season, competition use, exclusivity — **none keyed to status.**
6. **IP protection = MVP seams only** — watermarked previews, purchase-gated delivery, License of Record/history. **Defer** forensic watermarking, proactive competition monitoring, Relevé-as-legal-enforcer, enterprise enforcement.
7. **Do not disturb production during this phase** — the live $499 path, memberships, Offerings, Studio/Team/Family, Swing, $30 app/credit flow, Live Pass, profiles/auth. **Offerings = labor/services, no fee. Marketplace = IP/product.**
8. **Ring-fence economics, not infrastructure** — share auth, buyer identity, Connect primitives, rights/license schema, License of Record, delivery/security, provenance. "Ring-fenced" means **neither system can inherit the other's pricing or eligibility rules — NOT two copies of the same licensing machinery.**

---

## 1. Decisions A–D — RATIFIED, and every stale reference they resolve

### A — Senior Spotlight membership bundle → **REMOVE (do not grandfather)**
The live code that bundles a free Year-1 membership into a $499 purchase is **stale behavior to be removed before Senior Spotlight sells.** There are **no** Senior Spotlight sales, so nothing to preserve. "Do not disturb the live path" governs *this architecture phase only* — it does not keep the bundle. **Ratified Senior Spotlight rule:** $499 fixed · curated/select · 80% artist / 20% Relevé · artist bears processing · **no Live Pass or membership included or granted.**

*Stale references flagged as **deliberate, tested removal items** (not touched now):*
- **Code:** the webhook `checkout.session.completed` **experience branch** that creates an `access` membership on purchase; the buyer-account+membership creation in that branch.
- **`tiers.ts`:** the `access` tier concept as a *bundled* Senior Spotlight grant (its defensive handling can stay; the *bundling* goes).
- **Docs:** `STRIPE-CONNECT-499-LICENSING.md` §2 (memberships row "bundled with a Signature Experience"), §5 Flow C step 2 ("create/attach the buyer's Access account… Year 1 free"), §8 ("Access is bundled, not a separate charge").
- **Sales-page / UI copy:** any "Year 1 included / Access included" language on the $499 experience.

### B — General Marketplace fee basis → **% of the artist-set list price (forward pricing)**
The artist chooses the **public license price.** The fee is a percentage **of that price**; processing is then borne by the artist. Example: list **$500**, future fee **20%** → Relevé **$100**, est. processing ≈ **$14.80** (artist-borne) → est. payout ≈ **$385.20**. **The rate stays configurable and INACTIVE until separately ratified.**

*Stale reference resolved:* the **"reverse pricing / artist-desired-net"** framing in `Marketplace_Economics_AUDIT_2026-08-14.md` (§0, §8) and in **Rev 1 of this doc** (the `fee_base` dual-mode and `buyerPrice = artistAmount/(1−rate)` derivation) is **superseded** — there is no gross-up and no derived buyer price. *(I've annotated the audit doc accordingly.)*

### C — "Audition Library" → **RETIRED**
Historical terminology only. **Not** a synonym, alias, route name, DB concept, or UI name for Senior Spotlight. Senior Spotlight is the product name.

*Stale references flagged for cleanup (not a Senior Spotlight name):* `Releve_Pricing_RATIFIED…md` ($199 row "Marketplace + Audition Library"); `CLAUDE.md` §3A ("Marketplace + Audition Library"), §4G ("Marketplace + Audition Library"), §6 ("Audition Library commerce").

### D — Who may buy a General license → **any authenticated buyer account**
No paid membership required to buy; **a purchase grants no membership.** Authentication exists so Relevé can identify the buyer, store the transaction, and issue the License of Record. **Seller access is the gated thing** — only vetted Professional + Marketplace sellers may list/license.

### Other stale conflicts these confirm
- **"Only the $499 uses Connect + 80/20"** (`STRIPE-CONNECT-499-LICENSING.md` golden rule) → superseded: General also uses Connect, with a configurable fee; economics ring-fenced by the resolver (§3).
- **Status→split ladder** (pricing SSOT) → already retired 2026-08-14; reaffirmed.
- **`CLAUDE.md §3B` "80/20 = Signature tier"** → superseded: 80/20 is the **Senior Spotlight product** rate, not a status rate.
- **"separate tables, separate code"** (Rev 1 of this doc) → superseded by the shared-spine + resolver model (§2–§3).

---

## 2. The model — one shared licensing spine, economics ring-fenced by product type

```
                         ONE SHARED LICENSING SPINE  (single implementation)
     ┌──────────────────────────────────────────────────────────────────────────────┐
     │ buyer identity · Stripe Connect · rights/license-terms schema · LICENSE OF     │
     │ RECORD · delivery & security · transaction provenance · checkout→webhook→      │
     │ license-issuance→delivery pipeline                                              │
     └──────────────────────────────────────────────────────────────────────────────┘
                                        ▲
                    resolveListingEconomics(product_type)   ← the RING-FENCE
              ┌─────────────────────────┴──────────────────────────┐
   product_type = 'senior_spotlight'                     product_type = 'general_license'
   • price: FIXED $499                                    • price: ARTIST-SET list price
   • fee:  SENIOR_SPOTLIGHT_FEE_BPS (2000, constant)      • fee:  marketplace_fee_config (INACTIVE)
   • eligibility: curated/select (admin-invited)          • eligibility: vetted Professional+Marketplace
   • bundle: NONE                                         • bundle: NONE
```

**The resolver is the only place economics diverge.** Because it keys on the row's **immutable `product_type`**, a Senior Spotlight sale can never read `marketplace_fee_config`, and a General sale can never use the Senior Spotlight constant. Eligibility, pricing, and bundling rules are all resolved from `product_type`. Everything else — how a license is issued, recorded, delivered, and paid out — is **one implementation**, satisfying "don't maintain two copies of the same machinery."

Offerings/Swing/memberships remain on their own paths (labor/one-way); **Offerings carries no fee and never touches this spine.**

---

## 3. Economics resolver (the ring-fence, in one function)

Proposed `src/lib/marketplace/economics.ts` — pure, the single source of divergence:

```
resolveListingEconomics(product_type):
  'senior_spotlight' → { priceMode:'fixed', priceCents: 49900,
                         feeSource:'constant', feeBps: SENIOR_SPOTLIGHT_FEE_BPS /*=2000*/,
                         eligibility:'curated_invite', bundlesMembership:false }
  'general_license'  → { priceMode:'artist_set',
                         feeSource:'config' /* marketplace_fee_config; refuse if !active */,
                         eligibility:'professional_full_seller', bundlesMembership:false }
```

- **`SENIOR_SPOTLIGHT_FEE_BPS`** is the existing `PLATFORM_FEE_BPS = 2000`, conceptually renamed for clarity and **never** read from config.
- **General `feeSource:'config'`** reads `marketplace_fee_config`; if `active=false` the resolver **refuses** (checkout blocked). This is the economic ring-fence *and* the launch gate in one place.

---

## 4. Seller pricing (forward) + one clean buyer price

Proposed `src/lib/marketplace/pricing.ts` — pure, no hardcoded rate:

```
computeSellerBreakdown(listPriceCents, feeBps, processing{pctBps:290, fixedCents:30}):
  releveFee     = round(listPriceCents × feeBps/10000)          // % of the artist-set list price
  estProcessing = round(listPriceCents × pctBps/10000 + fixedCents)   // ARTIST bears it
  estPayout     = listPriceCents − releveFee − estProcessing     // ESTIMATE — never guaranteed
  → { listPrice: listPriceCents, releveFee, estProcessing, estPayout }
```

- **Seller Workspace shows four labeled lines:** *Your listed price* · *Est. Relevé Marketplace fee* · *Est. Stripe processing* · *Est. payout* — all marked **estimated**; copy states the payout follows processing and isn't guaranteed.
- **Buyer sees only `listPrice`** — one clean price, no fee math exposed.
- **Estimate → actual:** the License of Record stores the **actual** fee and (when Stripe exposes it) **actual** processing from the balance transaction.
- **Senior Spotlight does not use this** — fixed $499, fixed 20%, resolved by `product_type`.

---

## 5. Database additions only (PROPOSED — not applied; all additive)

**5.1 `marketplace_fee_config` — the single configurable General fee (shipped inactive)**
```sql
create table marketplace_fee_config (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'general' check (scope = 'general'),  -- never touches Senior Spotlight
  rate_bps integer not null,           -- placeholder only until ratified; NOT a shipped rate
  active boolean not null default false,   -- OFF until Kathleen ratifies
  ratified_by text, ratified_at timestamptz,
  effective_from timestamptz not null default now(), note text,
  created_at timestamptz not null default now()
);   -- ratify later = update one row: no migration, no status change. (No fee_base — fee is always % of list price.)
```

**5.2 `marketplace_listings` — unified listing with `product_type` discriminator**
```sql
-- One listing model for both systems; economics resolved from product_type (never stored-fee).
-- Senior Spotlight's existing signature_works folds into this as a deliberate, tested Phase-4
-- migration (0 rows → no data risk); until then it is untouched (see §11).
create table marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  product_type text not null check (product_type in ('senior_spotlight','general_license')),
  profile_id uuid not null references talent_profiles(profile_id) on delete cascade,
  collection_id uuid references marketplace_collections(id),
  title text not null, summary text, description text,
  preview_video_url text,           -- watermarked preview (MVP: short/clipped)
  delivery_asset_ref text,          -- gated licensed asset (never public)
  list_price_cents integer,         -- artist-set (general); fixed 49900 (senior_spotlight)
  -- licensing inventory / future controls (boundary #5) — NONE status-dependent
  license_type text check (license_type in ('standard','limited','exclusive')),
  permitted_use text[], territory text default 'national', season_id uuid,
  duration_label text, sales_cap integer, renewal_option text default 'no_renewal',
  -- lifecycle: submit → admin approve → listed
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','listed','rejected','withdrawn')),
  submitted_at timestamptz, reviewed_by text, reviewed_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
```

**5.3 `marketplace_collections` — lightweight taxonomy**
```sql
create table marketplace_collections (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null,      -- 'senior_spotlight','general_licensing','commissions'
  curated boolean not null default false, description text,
  sort_order int default 0, created_at timestamptz default now()
);
```

**5.4 `licenses` — the LICENSE OF RECORD (center; shared by both product types)**
```sql
-- One durable, IMMUTABLE granted-license record per Marketplace sale — the provenance spine.
-- Created ONLY by the webhook (service role). Serves both product types uniformly.
create table licenses (
  id uuid primary key default gen_random_uuid(),
  product_type text not null check (product_type in ('senior_spotlight','general_license')),
  listing_id uuid,                 -- FK marketplace_listings (post-migration, both types)
  seller_profile_id uuid not null, buyer_user_id uuid not null,
  -- money, snapshotted (estimate at issue; actuals reconciled from Stripe balance txn)
  buyer_price_cents integer not null,          -- the one clean price paid
  releve_fee_bps integer not null,             -- rate actually applied (SS: 2000; general: config value)
  releve_fee_cents integer not null,           -- fee actually applied
  processing_fee_cents_est integer, processing_fee_cents_actual integer,   -- artist-borne
  artist_gross_cents integer not null,         -- transferred before processing
  artist_net_cents_est integer,                -- gross − est processing (NOT a guarantee)
  stripe_payment_intent_id text, stripe_transfer_id text,
  -- license terms, snapshotted (immutable)
  license_type text, duration_label text, permitted_use text[],
  exclusivity text, territory text, season_id uuid, competition_restrictions jsonb,
  intent_to_use jsonb, terms_snapshot jsonb,
  -- delivery / provenance
  watermark_token text,            -- "Licensed by {buyer} · Relevé · {license.id}"
  issued_at timestamptz not null default now(),
  status text not null check (status in ('active','refunded','revoked')) default 'active',
  created_at timestamptz not null default now()
);
-- IMMUTABLE: no UPDATE policy for anyone; only the webhook/admin service role flips status.
-- Exclusivity EXCLUSION CONSTRAINT (or guarded SERIALIZABLE txn) enforces the conflict rule for
--   general_license exclusives (Rights_Management_Design); activated with General Licensing.
```

*`season_id` references the small named-date-range `seasons` table from `Rights_Management_Design`, built with General Licensing.*

---

## 6. Feature flags (double-gated OFF for General; Senior Spotlight unaffected)

- **`GENERAL_MARKETPLACE_ENABLED`** (new env flag, default **OFF**, mirrors `PROFESSIONAL_OFFERINGS_ENABLED`) — gates General listing publish, browse, checkout.
- **`marketplace_fee_config.active`** (default **false**) — even with the flag ON, the resolver refuses General checkout until the rate is ratified + activated. **Both** must be true to transact.
- **Senior Spotlight** has **no** new flag and reads **no** config — it is unaffected by either gate.

---

## 7. Stripe flow (General) — reuses Connect; fee from the resolver

```
POST /api/marketplace/listings/[id]/checkout       (guard: flag ON + fee config active + status='listed' + seller payouts_enabled)
  econ = resolveListingEconomics('general_license')          // refuses if config inactive
  fee  = computeSellerBreakdown(listing.list_price_cents, econ.feeBps).releveFee
  stripe.checkout.sessions.create({
    mode:'payment',
    line_items:[{ price_data:{ unit_amount: listing.list_price_cents, product_data:{ name: listing.title } } }],
    payment_intent_data:{
      application_fee_amount: fee,                            // % of the artist-set list price
      transfer_data:{ destination: artist.stripe_account_id },
      on_behalf_of: artist.stripe_account_id,                // artist = merchant of record → bears processing
    },
    metadata:{ kind:'marketplace_license', listing_id, seller_profile_id, buyer_ref },
  })
```

- **Connect onboarding reused unchanged** (`/api/connect/*`, `payouts_enabled`, `requireProfileOwner`); an artist onboards **once** and can sell in either system.
- **Webhook** gains one branch `kind:'marketplace_license'` → create the **License of Record** with actual amounts → issue delivery grant + watermark token → confirmation email (to `EMAILS.md` first). **No membership created or bundled** (rule for both systems now).
- **No custody** — funds route to the artist's connected account; Relevé keeps only its `application_fee`.

---

## 8. End-to-end flow

1. **Submit** — a `professional_full` seller creates a `marketplace_listings` row (`product_type='general_license'`, `draft`), sets **list price**, license type, permitted use, preview → `submitted`.
2. **Approve** — admin curates (incl. ownership attestation) → `approved → listed`; rejections carry a reason. *($199 ≠ auto-listing.)*
3. **List** — public sees the **one clean list price** + **watermarked preview**; no economics exposed.
4. **Purchase** — any authenticated buyer checks out (§7). No membership required; none granted.
5. **License of Record** — webhook writes the immutable `licenses` row (actual money + snapshotted terms + watermark token); exclusivity checked in the same guarded txn for exclusives.
6. **Delivery** — buyer gets **purchase-gated, buyer-tied, revocable** access (signed/expiring URL, watermark stamp). History visible to buyer and seller.

Senior Spotlight runs the **same pipeline** with `product_type='senior_spotlight'` → fixed price, fixed 20%, curated eligibility, no bundle.

---

## 9. Refund / revocation

- **Refund** (`charge.refunded`) → `licenses.status='refunded'` → delivery **revoked**. Reuses the existing refund-handler pattern.
- **Revoke** (admin) → `status='revoked'`, access removed, record **kept** (audit).
- **Exclusive release** — a refunded/revoked exclusive reopens that work+season.
- **Append-only** — status flips only, by the webhook/admin service role; terms never rewritten.

---

## 10. IP protection — MVP seams only

**Build:** watermarked previews (`preview_video_url`, client overlay MVP → provider-burned later) · purchase-gated, buyer-tied, revocable delivery (`delivery_asset_ref` + signed URLs + `watermark_token`) · License of Record / history (§5.4).
**Defer (promise none at launch):** forensic/screen-record-resistant watermarking · proactive competition monitoring · Relevé-as-legal-enforcer / automated takedowns · enforcement-rights assignment · enterprise enforcement · per-sale e-signature PDFs. Later Relevé *may* assemble the License of Record into an artist-filed claim packet — **not** an enforcement department.

---

## 11. Reuse map + Senior Spotlight migration (deliberate, tested — not now)

| Existing asset | In the shared spine | Change |
|---|---|---|
| **Stripe Connect** (`/api/connect/*`, `payouts_enabled`, `requireProfileOwner`) | Shared onboarding + payout status for both systems | Used as-is |
| **Destination-charge pattern** (`application_fee_amount`+`transfer_data`+`on_behalf_of`) | Shared checkout; fee from resolver | Pattern reused |
| **Webhook + `processed_stripe_events`** | New `kind:'marketplace_license'` branch; License-of-Record issuance | Additive branch; **de-bundle** SS branch (Decision A) as a flagged item |
| **`signature_works`** | **Folds into `marketplace_listings`** (`product_type='senior_spotlight'`) — one catalog machinery | Phase-4 migration (0 rows), deliberate + tested |
| **`experience_purchases`** | **Folds into `licenses`** (its money fields are the template) | Phase-4 migration, deliberate + tested |
| **`tiers.ts`/`access.ts`** | New `hasMarketplaceSellerAccess` (from active `professional_full`) | Additive helper |
| **`Rights_Management_Design`** license types + conflict rule + seasons | Directly informs §5 (status-independent) | Design reused |

**Senior Spotlight migration is an implementation item, not architecture work now:** fold `signature_works`/`experience_purchases` onto the shared spine and remove the membership bundle, each behind its own do-not-regress test, **before** Senior Spotlight sells. Production is untouched during this phase.

---

## 12. Entitlements

- **Seller access** = active **`professional_full`** ($199 "Professional + Marketplace"), or founder/admin override → `hasMarketplaceSellerAccess(userId)`. Grants Seller Workspace + submit; **not** auto-listing.
- **Per-work approval** = admin, via `marketplace_listings.status`.
- **Buyer** = any authenticated account (Decision D); membership neither required nor granted.
- **Label change only:** `professional_full` displays as "Professional + Marketplace"; slug unchanged, nobody re-charged; founder/cohort access preserved.

---

## 13. Public site

- **Pricing** — Professional **$149/yr** · Professional + Marketplace **$199/yr** ("Submit, manage, and license approved original choreography"). Annual. No auto-approval implication.
- **For Choreographers (Marketplace)** — the artist owns the work; the artist sets the price; Relevé builds the infrastructure that lets it sell; Relevé earns when IP sells and takes **0% of the labor** that follows; **Senior Spotlight is the launch collection, not the endpoint.**
- **Seller Workspace** (`professional_full` only) — catalog, listing status, sales/license history, payouts (Connect), the four-line pricing breakdown.
- **Senior Spotlight** keeps its own curated $499 experience — not merged, not reskinned.
- **Brand:** editorial / curated / premium. Not a storefront.

---

## 14. Security / RLS

| Table | Read | Write |
|---|---|---|
| `marketplace_listings` | public only when `status='listed'`; owner reads own | owner manages own; `approved/listed` transitions = admin/service role |
| `licenses` (License of Record) | buyer reads own; seller reads own sales; never public | **service role only; no UPDATE policy** (immutable) |
| `marketplace_fee_config` | admin only | service role/admin only |
| `marketplace_collections` | public | admin only |

Connect writes stay `requireProfileOwner`-guarded. Delivery assets never public; access checked against an active License of Record. Buyer PII and internal fee math never exposed publicly.

---

## 15. Exact do-not-regress tests (must pass unchanged)

**Senior Spotlight ring-fence (economics):**
1. $499 list price and 80/20 split unchanged; founder no-split path unchanged; `on_behalf_of` (artist bears processing) unchanged.
2. **Changing or activating `marketplace_fee_config` does NOT alter any Senior Spotlight fee** — assert the resolver returns the fixed constant for `senior_spotlight` regardless of config.
3. `resolveListingEconomics('senior_spotlight')` never reads `marketplace_fee_config`; `resolveListingEconomics('general_license')` never reads the SS constant.
4. **No bundle:** a Senior Spotlight purchase creates **no** membership (this test encodes Decision A; it will fail against today's stale bundle → that is the signal the de-bundle work must ship before SS sells).

**Firewall:** 5. Offerings applies no fee, writes no `licenses`/fee rows, stays ON. 6. Membership subscription, $30 credit, comp/founding paths unchanged.

**General dormancy:** 7. Flag OFF → no listing/browse/checkout reachable. 8. Flag ON + `active=false` → resolver refuses checkout.

**Correctness (TEST rate only, never a shipped one):** 9. `computeSellerBreakdown` golden vectors (e.g. list $500 @ 20% → fee $100, est proc ≈ $14.80, est payout ≈ $385.20). 10. `licenses` immutability — no UPDATE path; created only by webhook. 11. Exclusivity constraint holds.

**Untouched:** Studio/Team/Family, Swing, Live Pass, profiles, auth — existing suites green.

---

## 16. Build sequence (Phases 3–5 — for approval, not execution)

- **Phase 3** — public Pricing + For-Choreographers pages, tier relabel ($199), `hasMarketplaceSellerAccess`, Seller Workspace shell. No economics. Production untouched.
- **Phase 4** — additive migrations (`marketplace_listings`, `marketplace_fee_config` inactive, `licenses`, `collections`, `seasons`), resolver + forward-price calculator, seller submit→approve→list workflow, General checkout + webhook branch + delivery — **behind flag OFF + fee inactive.** Also: the **Senior Spotlight migration onto the shared spine + de-bundle**, each with its do-not-regress test. Nothing live.
- **Phase 5** — **only on explicit approval + ratified rate:** set + activate the fee, flip the flag, go live.

---

## 17. Remaining item for your ratification
Only one economic value is still open: **the actual General Marketplace fee percentage.** Everything else (A–D, forward pricing, ring-fence model, shared spine) is settled above. The config ships inactive; you ratify the number when ready, and it activates by updating one row — no migration, no status change.

**STOP for approval. No Phase 3 or implementation begins until you approve this revised architecture.**
