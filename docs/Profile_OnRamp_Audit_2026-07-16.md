# Relevé Connect — Profile On-Ramp Audit
### Read-only audit · 2026-07-16 · Q: how close are (1) a real dancer/teacher and (2) a real studio to creating and publishing a profile?

**Method.** Read-only. Audited the code against the canonical docs (`docs/Releve_Connect_Member_Platform_Build_Spec_2026-07-11.md` §2/§4/§6/§7 and `docs/Releve_Pricing_RATIFIED_2026-06-25_SINGLE_SOURCE_OF_TRUTH.md`), the mirrored `schema.sql`, and all `supabase/migrations/`. Code claims below cite `file:line`. DB-state and Storage/vocab facts were verified directly against the live Supabase project `hmqqxbkhcqspqmsjxodq`. **Nothing was run through a browser or Stripe**, so "works end-to-end" means "the code path is complete and coherent," not "executed." Where that distinction matters, it's called out.

> ⚠️ **Doc gap:** The **Intake Form Spec** (`Releve_Professional_Intake_Form_Spec_2026-05-20.md`) is referenced by the Build Spec but is **not present in `docs/`**. The field-level intake requirements were audited against Build Spec §4 + the `applications` schema, not the missing form spec.

---

## Live-database reality (verified 2026-07-16)

| Table | State | Meaning |
|---|---|---|
| `applications` | **0 rows** | The intake/fee/approval pipeline has **never run** with real data |
| `application_fee_payments` | **0 rows** | No $30 fee has ever been taken |
| `talent_profiles` | **2 rows, both `draft`** (1 approved / 1 pending review; both `verification_flag=false`) | **Nothing has ever published** |
| `employer_profiles` | **0 rows** | Studio flow never exercised end-to-end |
| `memberships` | **2, both tier `access`** (bundled from the Signature test) | **Zero Professional/$149 memberships exist** |
| `users` | **4, all `account_type='talent'`** | Kathleen's test/founder accounts; no employer/consumer/admin-type users |
| Storage buckets | `headshots`, `gallery`, `resumes` **all exist** ✅ | Profile uploads are provisioned |
| Controlled vocab | `levels` = the exact five; `certifications` = the 7 spec tags; `studio_concentrations` = the 3; `styles` = 15 | Pick-lists fully seeded ✅ |

**Read this as:** the on-ramp is *built but never driven by a real person*. Both profile builders write to the DB correctly; the reason everything is `draft`/empty is lack of real users + an opt-in publish toggle, **not** a broken pipeline.

---

## 1. State of the on-ramp — plain English

The machinery is mostly built and internally consistent. A signed-in dancer can fill a real 13-section application, pay a real $30 through Stripe, be approved by an admin, subscribe to the $149 Professional tier (with the $30 credited back), build a genuinely rich visual profile, and publish a live public page at `/[handle]`. That whole spine exists in code today.

**But it has never been run by a real applicant, and three things stand between "built" and "usable by strangers":**

1. **The applicant-facing connective tissue is missing.** There is **no auto-save** on the long essay form (the code itself flags this as required-before-launch), and **every confirmation/approval/decline email and every MailerLite tag is a stub** — so an applicant who gets approved receives *nothing* and never knows. The money and database steps work; the human communication around them doesn't.

2. **The Professional profile is strong but has a few correctness gaps** — structured career credits (`resume_entries`) aren't implemented (replaced by one free-text box), the bio minimum isn't enforced, and a lapsed member's page stays public. None block a first real member; they're polish/correctness.

3. **Studios can be *created* but not *published*.** The studio create/edit flow is fully wired, but a saved studio profile is **visible only to its owner** — there is no public studio page, no directory surface, and no public read policy. Creating a studio profile currently does nothing for anyone.

**Bottom line:** **M1 (dancer/teacher) is close** — days of focused work, mostly on notifications + auto-save, not new architecture. **M2 (studio) needs a real build** — the "publish" half (a public surface + visibility model) essentially doesn't exist yet.

---

## 2. Detailed findings

### A. Vetting gate / intake (spec §4)

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Intake route + page + form | ✅ Built (save path real; not runtime-verified) | `src/app/apply/page.tsx`, `ApplyForm.tsx` (13 sections), `apply/actions.ts:39-201` (RLS-scoped insert/upsert `:157-198`), `apply/submitted/page.tsx` |
| 2 | Talent vs employer branching | 🟡 Partial | Branches *within talent* by role (`ApplyForm.tsx:230,246,253,273`). No true talent-vs-employer split: a `studio_owner`-only applicant is still pushed to the $30 fee (`ApplyForm.tsx:125-133`), contradicting §4 ("not studios"). Real studio light-onboarding is a *separate* path (`studio/edit/page.tsx:8-9`) |
| 3 | Intake fields (identity, roles-as-array, story/philosophy, credentials-in-own-words, private references, digital presence, consents, min word counts) | ✅ Built (all present) | Identity `ApplyForm.tsx:148-168`; roles[] `actions.ts:56,93-94`; story `:205-211`; credentials `:222-225`; refs `:284-293` (private); social `:300-312`; **6** consents required `actions.ts:30-37` (spec says 5 — extra is Code of Conduct); story min 150 words enforced client+server (`ApplyForm.tsx:16,111-114`, `actions.ts:25,68-73`). Only Story is word-gated |
| 4 | $30 fee wired through Stripe | ✅ Built (code-complete; not runtime-verified) | Checkout `api/applications/[id]/fee-checkout/route.ts` (RLS+ownership `:37-54`, idempotency `:59-70`, pending row `:89-101`, session `:107-132`, copy rule followed `:117`); webhook `handleApplicationFeePaid` in `webhooks/stripe/route.ts:201-266` |
| 5 | Fee lifecycle | 🟡 Partial | **waived** ✅ (`fee-checkout:73-86`) · **paid** ✅ (`webhook:225-233`) · **credited** ✅ (`membership/checkout/route.ts:70-92`, `webhook:331-338`) · **refunded** ✅ (admin decline `admin/applications/[id]/route.ts:132-168` + `charge.refunded` `webhook:506-514`) · **forfeited** ❌ **never implemented** (DDL + type only; no writer) · `is_founding_25` ❌ **never SET by any code** (waiver needs a manual DB edit) |
| 6 | Auto-save / save-and-resume | ❌ Missing | Columns `resume_token`/`resume_expires_at` exist; **no code reads/writes them**. In-code comments flag it as a required fast-follow ("don't open to real applicants until auto-save lands"). Form is submit-only — a refresh loses everything |
| 7 | Admin pending queue + filters | ✅ Built | `admin/applications/page.tsx:32-58`; filters state/role/free-text in `ApplicationsConsole.tsx:65-79`. Date is sortable, not a range filter |
| 8 | Admin full submission view | ✅ Built (one caveat) | Expandable card `ApplicationsConsole.tsx:248-293`. Caveat: the private **references block is not rendered to the admin** either; media are link-outs + headshot img, not embedded players |
| 9 | Admin actions (Approve / Approve-at-tier / Honorific / Request-info / Decline) | ✅ Built (2 deviations) | `api/admin/applications/[id]/route.ts` (ADMIN_TOKEN-gated `:41`): approve `:75`, tier `:80-95` (choreographer-only), honorific `:106`, more-info `:119`, decline+auto-refund `:132-169`. **Deviations:** approvable tiers are `emerging\|established\|signature` — "featured" retired, "signature" made admin-selectable (`:28-30`); Approve has **no guard** that the fee is paid / app is in-review (`:75`) |
| 10 | MailerLite tag fires on action | 🟡 Stub | Called at the right moments (`route.ts:100,126,166`) but `fireMailerLiteTag` only logs — `notifications.ts:172-180` has `TODO(mailerlite)`, no HTTP call. All decision emails (`sendApplicationApproved/MoreInfo/Declined`) are also stubs (no email vendor wired). A real MailerLite POST pattern exists (`addBuyerToClimb:61-91`) but wasn't applied to lifecycle tags |

**Bottom line A:** The pay-and-approve spine is code-complete and coherent. Blockers before real applicants: **(1) no auto-save**, **(2) all applicant emails + MailerLite tags are stubs** (approvals are invisible to the applicant), **(3) `forfeited` unimplemented + `is_founding_25` never set** (edge/waiver branches need manual DB edits).

### B. Professional (teacher/dancer) profile — gated at $149 (spec §6)

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Profile builder/editor UI | ✅ Built end-to-end | `profile/edit/page.tsx` → `ProfileEditor.tsx` (753 lines, real fields) → `profile/edit/actions.ts` (`saveProfile`) |
| 2 | Field wiring (bio, years, credits, certs, 5 levels, styles, focus, socials, location) | 🟡 Partial | years/styles/focus/location/certs ✅. **bio min word count NOT enforced** (soft gauge only, `ProfileEditor.tsx:75-79`; `actions.ts:191` accepts empty). **credits via `resume_entries` ❌ unimplemented** (zero refs in `src/`; replaced by free-text `credentials` `ProfileEditor.tsx:284-293`). 5 levels ✅ wired via `profile_levels`, seed verified live. **LinkedIn** collected server-side but **no input in the form** (`ProfileEditor.tsx:405-425`) |
| 3 | Uploads: headshot / 8-gallery / résumé PDF / reel link | ✅ Built (bucket risk cleared) | Headshot → `headshots` bucket (`actions.ts:128-140`); gallery → `gallery`, hard-capped 8 (`:159-180`); résumé PDF → `resumes` (`:142-157`); reel = URL field → embed (`reel.ts`, `[handle]/page.tsx:206-218`) — correct per spec. **All 3 buckets confirmed present in the live project** (audit-verified — resolves the code-only "headshots bucket may be missing" caveat) |
| 4 | Draft → published flow | ✅ Built | Publish checkbox `ProfileEditor.tsx:486-497` sets `profile_status`; public page requires `published`+`public` (`[handle]/page.tsx:69`). **Why all draft:** publish is opt-in and **defaults OFF** (`ProfileEditor.tsx:491`) — no bug, no forced-draft code path |
| 5 | Public visibility gated to active $149 | 🟡 Build-time only | Editing gated by `hasActiveProfileTier` (`page.tsx:50-52`, `membership/access.ts:15-17,56-66`). **View-time NOT gated** — public route shows any `published`+`public` row with no active-membership check (`[handle]/page.tsx:55-69`), so a lapsed member stays public. `saveProfile` also doesn't re-check tier |
| 6 | Public URL `/[handle]` | ✅ Built + gated | `src/app/[handle]/page.tsx` full visual-first render; non-live → null to the world, owner draft-preview allowed (`:69-86`); reserved slugs rejected at save (`actions.ts:104-124`); legacy `/talent/[slug]` redirects |
| 7 | Join-table read/write (styles/levels/focus/certs) | ✅ Correct | `replaceJoin` delete-then-reinsert by slug→id (`actions.ts:249-267`); reads via embeds (`page.tsx:94-119`) |

**Bottom line B:** An approved, paying member can genuinely build **and publish** a live profile — this half is real and end-to-end. Gaps are correctness/polish: **structured `resume_entries` not built**, **bio minimum not enforced**, **view-time visibility not re-gated to active membership**, **no LinkedIn input**. None block a first real member.

### C. Studio (employer) profile (spec §7)

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Studio account creation (employer user + profile row) | ✅ Built (light onboarding; auth handoff not runtime-verified) | No separate signup — folded into first save. `/studio` → `/studio/edit`; login redirect `studio/edit/page.tsx:42-47`; upserts `users` as `account_type:'employer'` (`actions.ts:64-73`) + inserts `employer_profiles` (`:131-143`); RLS allows both (`20260702000000:117-119,259-261`) |
| 2 | Studio create/edit UI | ✅ Built | `studio/edit/StudioEditor.tsx` → `saveStudioProfile`; validator unit-tested (`lib/studio/profile.test.ts`) |
| 3 | Field wiring | 🟡 Mostly built, 2 gaps | name/website/address/year/band/staff/room/accessibility(transit,car,parking,directions)/culture/bio all ✅ (`StudioEditor.tsx` → `lib/studio/profile.ts` → `actions.ts:89-111`). **map pin/geocode 🟡** — columns exist, **no geocoder wired**, lat/lng stay NULL (`actions.ts:115-119`). **logo_url ❌** — column exists, **no upload field**, never written. `links` only holds website |
| 4 | Join read/write (styles/concentrations/certs) | ✅ Correct | `replaceJoin` delete-then-reinsert, correct FK columns (`actions.ts:146-188`); RLS-scoped (`20260713000000:154-194`) |
| 5 | Visibility / publish + tier gating | 🟡 **No publish model AND invisible** | No status/published flag; no tier gate (by design). **Critical:** only SELECT policy is `employer_profiles_select_own = owner_user_id = auth.uid()` (`20260702000000:255-257`); **no public/anon read policy** and **no page reads `employer_profiles` except the owner's own editor** → a saved studio is invisible to everyone else |
| 6 | Verified Employer badge (admin-set) | 🟡 Column only | `verified` exists; **no admin route/UI sets it** |
| 7 | Ever run end-to-end? | ❌ Not yet (built-but-unused) | 0 rows; write path complete and un-stubbed, so consistent with "written 2026-07-13, never driven" |

**Bottom line C:** A studio can *create* a profile (UI, validation, account + all joins are wired and RLS-safe) but **cannot publish** one in any meaningful sense — there is no public read policy and no consumer surface, so it's invisible. Biggest blockers: **(1) no public studio visibility/surface**, **(2) no geocoding** (no distance matching), **(3) `logo_url` + `verified` have columns but no path to populate them**.

---

## 3. Milestone checklists (ordered) + effort sizing

Effort key: **S** = <½ day · **M** = ~1–2 days · **L** = 3+ days / needs a design decision.

### M1 — a real dancer/teacher: apply → pay $30 → approved → build → publish

Mechanically this path **already runs in code**. To make it safe for real strangers:

1. **[M] Auto-save / save-and-resume on the intake** — wire the existing `resume_token`/`resume_expires_at` columns; the essay form will lose people without it (explicitly flagged in-code as required-before-launch).
2. **[M] Email delivery** — replace the `sendApplicationApproved/MoreInfo/Declined` + `sendApplicationReceived` stubs (`notifications.ts:118-234`) with a real provider so applicants actually hear back. **Without this, approval is invisible.**
3. **[S] MailerLite tag integration** — implement `fireMailerLiteTag` (map tag→group id + POST) reusing the working `addBuyerToClimb` pattern (`notifications.ts:61-91`).
4. **[S] Admin "Founding-25 / waive fee" control** — set `is_founding_25` (currently never written) so the waiver branch can occur without a manual DB edit.
5. **[S] Approve guard** — require fee `paid` + app `in-review` before Approve (`admin/applications/[id]/route.ts:75`).
6. **[S] Route studio-owner-only applicants away from the $30 intake** to light onboarding (spec §4 says the fee is talent-only).
7. *(Correctness, not blocking — can trail the first cohort):* **[S]** enforce bio minimum; **[S]** add the LinkedIn input; **[S/M]** re-gate `/[handle]` visibility to an active Professional membership at view time; **[M]** build structured `resume_entries` (or formally accept the free-text `credentials` box as the decision).
8. **[S] `forfeited` transition** — define + implement the "approved but never subscribed" trigger (needs a small product decision on the window).

**M1 realistic core:** items 1–3 are the true blockers; 4–6 are quick correctness. Call it **~3–5 focused days**.

### M2 — a real studio: create → publish a studio profile

Create is done; **publish must be built**:

1. **[L] Public studio surface + read policy** — add a public/anon SELECT path (a view or policy) and an actual public studio page and/or directory entry that reads `employer_profiles`. This is the core missing piece; decide the visibility model (auto-public on save? gated behind a Studio subscription? §7 is light-onboarding, but §5 lists paid studio tiers — **this needs a founder decision**).
2. **[S] Logo upload** — add a `logo_url` upload field (reuse the talent Storage-upload pattern; a studio-logos bucket may need creating).
3. **[M] Geocoding** — fill `lat`/`lng` from the address via a provider, so the §8 radius search and Swing geo-match can ever work.
4. **[S] Verified Employer badge admin control** — an admin path to set `employer_profiles.verified` (Growth-tier benefit).
5. **[M] Studio subscription checkout** — if studio visibility is gated behind Connect/Growth/Accelerator, wire the studio-tier Stripe checkout into this flow (tiers are defined in `lib/membership/tiers.ts` but never used by the studio path).

**M2 realistic core:** item 1 is the whole game and carries a product decision. Call it **~1 week+**, gated on the visibility/monetization decision.

---

## 4. Recommended build order

1. **M1 #2 + #3 (emails + MailerLite)** — highest leverage; nothing else matters if approved members hear nothing.
2. **M1 #1 (auto-save)** — the other hard gate before opening intake to strangers.
3. **M1 #4–#6 (Founding-25 flag, Approve guard, studio-applicant routing)** — quick correctness; do together.
4. **Recruit the first real Professional cohort** — the profile builder + publish already works; prove the supply loop end-to-end before investing in studios.
5. **M2 #1 (studio public surface + visibility decision)** — the big studio build; make the founder decision first.
6. **M2 #2–#5 (logo, geocoding, verified, studio checkout)** — round out the studio side once it's visible.
7. **M1 #7 correctness backlog (resume_entries, bio min, view-time gating, LinkedIn)** — fold in as the roster grows.

---

## 5. Drift (code ↔ live schema ↔ spec)

- **Pricing: no drift.** `lib/membership/tiers.ts` matches the Pricing SSOT exactly (6 tiers, annual prices, $30 fee, `hasProfile` only on Professional+).
- **Consents count:** code requires **6** agreements; spec §4/§13 says "five" (extra = Code of Conduct). Harmless but a spec-vs-code mismatch to reconcile in copy.
- **Choreographer tiers:** code uses `emerging | established | signature` and made **signature admin-selectable**; spec §4 lists "Emerging / Established / Featured (+ Signature reserved for Founding)." Code intentionally retired "featured" (matches the Pricing SSOT, which also retired "Featured") — so **the Build Spec §4 is stale here**, not the code. Update §4.
- **`resume_entries`:** defined in schema (`schema.sql:191-201`), spec §6 wants structured credits, but **no code touches it** — replaced by free-text `credentials`. Code-vs-schema-vs-spec drift; decide whether to build it or retire the table.
- **`forfeited` fee status & `is_founding_25`:** exist in schema, referenced in types, but **never written by code** — schema ahead of code.
- **`logo_url` (studio) & `verified` (studio):** columns exist, no code path — schema ahead of code.
- **Geocoding:** `lat/lng/geocoded_at` columns exist and are actively *invalidated* on address change, but **never populated** — intended "build the column, fill it later," so this is planned drift, not a mistake.
- **Studio visibility:** schema/RLS only supports owner-read; spec §7/§8 assume studios surface in discovery — **the public-read half is unbuilt**.
- **Missing doc:** the **Intake Form Spec** is referenced everywhere but absent from `docs/` — restore or re-author it so the intake has a field-level source of truth.

---

*Audit performed read-only. No code, migrations, or data were modified. Code line-citations are from a static read (not executed); DB counts, Storage buckets, and vocabulary seeds were verified live against project `hmqqxbkhcqspqmsjxodq` on 2026-07-16.*
