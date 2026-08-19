# ⏸ CHECKPOINT — 2026-08-17

**Read this first when picking the work back up.**

Profile V2 is complete and verified. Choreo License has not been started, pending
legal counsel on the licensing/rights structure.

---

## Current position

| | |
|---|---|
| **Branch** | `profile-v2-application-continuity` |
| **HEAD** | `2a6d6840fd00987ed226fbe1117d356f0c3ea3cf` (`2a6d684`) |
| **Remote** | Identical — pushed, 0 ahead / 0 behind |
| **Working tree** | Clean, no stashes |
| **`origin/main`** | `0db55cd6b21f8fc2f0d2839ef566cfc69c463711` — **untouched. Nothing merged, nothing deployed.** |
| **Backup tag** | `phase3-checkpoint-2026-08-17` → `53af66f` (pre-reconciliation state) |
| **Other preserved branch** | `reconcile-schema-before-profile-v2` → `508b36f` |
| **Tests** | 483 passing · typecheck clean · lint at pre-existing baseline |

### Commits on this branch (newest first)

```
2a6d684  fix: save confirmation reports what happened, not what the box asked for
38a8835  fix: a live profile can no longer be edited into an incomplete one
3abebe4  fix: an approved, activated professional no longer lands on /welcome
1edb1cf  feat: Profile V2 slice 4 — review, publish gate, first-run screen
0fabbcd  feat: Profile V2 slice 2b — admin-conferred trust signals, with provenance
c8bb609  feat: Profile V2 slice 3 — privacy/publication correction (D1)
f41ab7c  feat: Profile V2 slice 2 — activation creates the profile, not the form
5692647  feat: Profile V2 slice 1 — activation gate, provenance, one-time seed
508b36f  docs: reconcile Git and schema.sql with the live Supabase schema
```

---

## Migrations applied to production (2026-08-17)

Both were pre-flighted, applied on explicit approval, verified afterwards, given
filenames matching their ledger versions, and had their headers updated to say
APPLIED the moment they went live.

| Ledger version | Name | What it added |
|---|---|---|
| `20260817221638` | `profile_v2_activation` | unique index on `talent_profiles.user_id`; `prefilled_from_application_id` (FK → `applications`, **ON DELETE SET NULL**); `prefilled_at`; `teaching_philosophy`; `adaptive_experience`; `choreographer_years` |
| `20260817232844` | `profile_trust_events` | append-only trust audit table; RLS **on** with **zero policies** and no Data-API grants (service-role only); `actor_user_id` **ON DELETE RESTRICT** |

**Production baseline after cleanup:** 1 profile, 1 membership, 1 application,
9 auth users, 6 founding grants, 0 trust events, **0 works**, zero `zz-` rows.

---

## What Profile V2 established

The ratified journey, now enforced in code:

```
Apply → Relevé accepts → activate/pay → Relevé creates the DRAFT
     → member reviews/completes → member publishes
```

- An application alone creates nothing. Approval alone is not enough.
- Activation (approved **AND** active paid or authorized comp membership) creates
  the profile, seeds it **once** from the accepted application, always as a DRAFT.
- Trust signals are conferred by Relevé — stamped at activation or by an admin at
  `/admin/profiles`, never writable from any member action. Guarded by tests
  across all three member-facing write paths.
- `draft/published` and `public/unlisted` are separate axes. `unlisted` is
  genuinely link-only, with `noindex`.
- A profile cannot go live without the four essentials — headshot, story, role,
  location — **and cannot be edited into incompleteness while live.**

Verified end-to-end in a real browser against production Supabase using a
synthetic `zz-` account, since removed.

---

## Non-blocking backlog

1. **Roster Region filter is dead** — nothing writes `talent_profiles.region_id`;
   selecting any region returns nothing.
2. **`professional_services` column privacy** — `anon` can read `business_email` /
   `business_phone` through PostgREST even when `show_email` / `show_phone` are
   false. The app strips them server-side; the REST API does not. Needs the same
   REVOKE-then-grant treatment migration `20260815173203` gave the other two
   tables. **0 rows today**, so nothing is exposed yet.
3. **No `invoice.paid` webhook handler** — annual renewals never extend
   `renewal_date`, and a member who lapses on one failed payment is never restored
   when the retry succeeds. Matters when paid membership switches on.
4. **No UI path to buy a membership** — `POST /api/membership/checkout` works end
   to end (proven with a real test purchase); `SubscribeButtons.tsx` is rendered
   nowhere.
5. **`signature` tier still doubles as a Founding 25 proxy** in an admin console
   comment. Decouple now that `founding_25` is properly conferrable.
6. **Two legacy honorifics** — "Verified Artist" and "Founding Artist" — retired
   from conferral because they collided with the system-controlled marks. They may
   still exist on historical rows; the console offers one-click removal.
7. **`first_50`** exists in the `founder_distinction` enum, intentionally unused.
8. **Kathleen's own Verified mark has no traceable basis** in current logic (set by
   hand or by older code). Leave it — the provenance columns prevent recurrence.
9. **Four production migrations still have no reconstructable original** — they
   were hand-run in the SQL editor and are documented from the live catalog only.
10. **Deployment**: DNS cutover to `releveconnect.com` still pending; live Stripe
    webhook endpoint, Customer Portal config, and live-mode Price IDs still needed.
11. **Slice 4's review screen and the refusal panel** are browser-verified, but the
    rest of Profile V2's UI has only been exercised via the `zz-` walkthrough.

---

## Choreo License — exact starting point

> **Do not create a third choreography table. Two already exist.**

### 1. Read what is already built

`preservation/backlog-2026-08-13`, commit **`700a2b6`** — *"Licensing (works +
admin review) — Pass One"*. It contains:

- `works` — a reviewed choreography portfolio, **live in production, 0 rows**
- a working admin review queue at `/admin/licensing`
- an artist workspace and a public profile render
- ~1,500 lines, already reviewed

Also `talent_profiles.available_for_licensing` — live, and the capability switch.

### 2. Read the ratified design

- `docs/Marketplace_Phase2_Architecture_2026-08-14.md` **§5** — proposed tables
- `docs/Rights_Management_Design_2026-07-20.md` — the rights model

Both are ratified design with **zero implementation**.

### 3. Reshape `works` while it is still empty

This is the last moment these changes are free.

- **Retire `license_type` as a rights field.** It is unconstrained free text
  despite its name; the UI labels it "Licensing note". Rename it and build the
  real rights model beside it. Do not let a new engine read that column.
- **Add the `product_type` discriminator** so the economics resolver can
  ring-fence Senior Spotlight's fixed 20% from a configurable General fee.
- **Add DB CHECKs** for `work_type` and `origin` (TypeScript-only today).
- **REVOKE-then-grant** the column privileges.
- **Decide co-ownership FIRST if it is in scope** — `works` is single-owner at the
  FK level, and retrofitting shared ownership after it has rows is painful.

### 4. Decide `works` ↔ `signature_works` explicitly

The ratified architecture makes `works` the shared licensing spine, with Senior
Spotlight migrating onto it as `product_type='senior_spotlight'`. Make that call
deliberately, with the do-not-regress tests the architecture doc specifies.

### 5. Build the ring-fence before anything transacts

**`marketplace_fee_config` does not exist.** It is referenced in code comments and
docs as the economic ring-fence and the launch gate. The General fee rate is still
unratified.

### What Choreo License inherits, already working

Stripe Connect onboarding with `payouts_enabled` gating · 80/20 destination-charge
checkout · an idempotent, signature-verified webhook · purchase records with the
fee/transfer split broken out · purchase-gated content delivery · refund → revoke.

Plus a settled identity layer: activation, provenance, admin-conferred trust
signals with an audit trail, and a privacy model that means what it says.

### Still entirely absent

License types · terms · scope · territory · exclusivity · the conflict rule ·
license-of-record · seller-set pricing · buyer entitlements · collections ·
watermarking / DRM / signed URLs.

---

*together we rise · relevé*
