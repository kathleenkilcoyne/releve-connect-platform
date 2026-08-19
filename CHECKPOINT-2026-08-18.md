# ⏸ CHECKPOINT — 2026-08-18 · The payment sprint, `/subscribe`, and the visual system

**Read this first when picking the work back up.**

F5 and F1 are complete and verified. `/subscribe` is the canonical membership
chooser, carries the Relevé visual system, and welcomes founding members.
F2, F4 and F6 are **not started**.

---

## The working principle, from here on

> **One fact. One source of truth. Many useful places it can appear.**
> — Kathleen, 2026-08-18

A fact is captured **once**, in the place that owns it, and every surface that
needs it **reads** it. A surface never re-asks for something already known, and
never keeps a second copy that can drift. Derived views are the point; duplicated
*capture* is the failure. Full entry in `DECISIONS.md`.

---

## Current position

| | |
|---|---|
| **Branch** | `profile-v2-application-continuity` |
| **HEAD** | `7d79ece` |
| **`origin/main`** | untouched. Nothing merged, nothing deployed. |
| **Tests** | **603 passing** (was 483 at the last checkpoint) |
| **Typecheck** | clean · **Build** green (`npm run build` exits 0) |
| **Lint** | pre-existing baseline — 2 errors, both in `TeamJoinForm.tsx`, untouched |
| **Backup tag** | `f5-site-url-guard-2026-08-18` → `b3b8cc5` |

### Commits this session

```
7d79ece  feat: /subscribe carries the Relevé visual system, and welcomes its founding members
fa07cd6  fix: the Professional invitation goes through the front door, not the raw form
418347b  feat: /subscribe becomes the membership chooser, and the tiers become buyable
b3b8cc5  docs: F5 closed in the go-live checklist
387fba3  feat: one resolver for the ten membership situations
1aaf7e3  fix: a missing NEXT_PUBLIC_SITE_URL can no longer send a paying member to localhost
```

---

## What shipped

### F5 — `NEXT_PUBLIC_SITE_URL` can no longer fail silently

`siteUrl()` returned `http://localhost:3000` whenever the variable was unset. It
builds Checkout's success and cancel URLs and the billing portal's return URL, so
a wrong value in production meant: card charged, membership granted, member
redirected to a machine that isn't theirs, nothing in any log.

In production, missing / blank / relative / non-http / **loopback** now throws.
The loopback case is the one a presence check would have waved through. `next
build` is exempt — a broken build is its own outage. Checked at call time **and**
at boot via a new `src/instrumentation.ts`.

**Verified in a production-like run:** blank → refuses to serve (connection
refused); `localhost` → refuses to serve; correct value → boots silently, HTTP
200; dev with it unset → still 200, no complaint. Also proved the value is read at
**runtime**, not inlined at build — a build made with `localhost` accepted a
correct runtime override, which is what Vercel depends on.

### The membership-state resolver

`lib/membership/state.ts` — pure, no database, no Stripe, no clock (`now` is
injected), **79 tests**. `/subscribe` had been asking "does this person have a
membership?" — a yes/no question with **twelve** real answers.

`signed_out · pending · comp · comp_expired · active_profile_tier ·
active_live_pass · active_studio · lapsed · approved_no_membership · applied ·
declined · none`

Judgment calls, all in `DECISIONS.md`:

- **`isAdmin` is a flag, not a state** — activating a membership can never hide
  the door to the vetting queue.
- **`comp` outranks the paid states** — a founding member on a comped Professional
  row gets warm copy, no price list, and keeps their profile one click away.
- **Both comp vocabularies resolve at READ time**, not by migrating audit rows. A
  test pins the list so adding a source is deliberate.
- **`canManageBilling` is `stripe_customer_id != null`** — F11 as one condition,
  which also leaves a lapsed member the portal as their way back.
- **`pending` outranks everything for 15 minutes**, then falls through carrying
  `stalePendingTier`. The checkout route writes `pending` *before* redirecting to
  Stripe, so an abandoned checkout leaves a permanent row; a spinner with no end
  is the dead end this sprint exists to remove.
- **`comp_expired` decides nothing** — complimentary is an entitlement with a
  clock, not a permanent flag. Unreachable in production until **~2027-07-20**.
  What happens on that date is **F9, and Kathleen's call**.

### F1 / F3 — the chooser

`/subscribe` is the canonical chooser and billing home. `SubscribeButtons.tsx`
existed, worked, and was imported by nothing; `POST /api/membership/checkout` was
proven end-to-end and unreachable from the product. **All three individual tiers
are now sellable.**

Four pathways as peers — **01 Professional · 02 Creator · 03 Studio / Arts
Organization · 04 Live Pass** — 2×2 on desktop, equal heights, CTAs on a shared
baseline. The bug underneath was structural: the page rendered `offeredTiers()`
directly, which is *what you may buy right now*, so a stranger saw one card. An
eligibility list masquerading as an information architecture. Separated now.

- **One CTA treatment for all four.** The verb carries the difference (Apply /
  Explore / Join); the styling never does.
- **The Professional Roster is a pathway, not an upsell.** The vetted tiers 403
  without an approved application, so an unvetted member is invited to apply —
  via `/welcome`, the front door, never `/apply`, the raw form.
- **Live Pass is a real family membership** and is never re-sold to someone who
  holds it. That is F3, the loop that never resolved.
- Signed-out visitors see prices **without** being bounced to `/login`, and their
  chosen tier survives sign-in.

### The visual system

`app/subscribe/tokens.css` — a third scope built from the **exact values already
in** `components/home/tokens.css` and `components/this-week/tokens.css`. Cream
`#f5eee1`, ivory `#fcf9f1`, ink `#1e1a17`, gold `#b6912f`, hairline `#e3d9c3`,
Iowan Old Style / Palatino / Georgia. Gold is an accent and never a fill.

### The founding-member state

A centred recognition plate: *"Welcome to Relevé. You're here at the beginning."*
"Build your profile" is the one filled button. The black admin slab became a
discreet `Admin · View vetting queue →` link — the escape hatch still renders in
every state. Silent on when a complimentary term ends: naming a date turns a gift
into a countdown.

### Copy

All founder-authored, verbatim, in `lib/membership/tier-copy.ts` — **not** in
`tiers.ts`, which keeps every slug, price and label. Supersedes the tier
descriptions in the 2026-06-25 pricing doc. Thirteen bold phrases are stored as
**data**; `tier-copy.test.ts` (19 checks) fails the build if a copy edit orphans
one.

---

## ⚠️ Not committed — awaiting founder review

The **My Services** work is in the working tree, deliberately uncommitted:

- migration `20260818143121_currently_accepting_to_my_services.sql` — **APPLIED
  to production**, pre-flighted and verified
- `profile/edit/ProfileEditor.tsx`, `profile/page.tsx`,
  `profile/offerings/page.tsx`, `[handle]/page.tsx`, `[handle]/OfferingsSection.tsx`

**The migration is already live.** 4 `currently` tags → 4 services, tags set
`is_active = false` (preserved, not deleted), all 6 `profile_availability` rows
intact, idempotency proven. Reversal is written into the migration header.

**🔴 The open regression:** the Roster does **not** query `professional_offerings`.
Retiring those four tags removed four Roster filters and nothing replaced them —
availability filters went 9 → 5, and a studio can no longer filter "Accepting
Choreography." **Roster-searches-My-Services is required before those tags can
ever be deleted.**

---

## Next

1. **Roster must search My Services** — closes the regression above.
2. **The Profile Editor visual pass** — the IA is reconciled; it still wears the
   old form styling. Wants the 01–06 editorial sections.
3. **This Week write path** — nothing writes `personal_events` today. It must
   **derive** its service choices from My Services, never re-ask.
4. **F2** — `pending` across the gates. The panel on `/subscribe` is static; the
   status endpoint, self-refresh and the gated pages are not built.
5. **F4 + F11** — the manage/cancel surface.
6. **F6** — live Stripe. Still an `sk_test_…` key and six test-mode Price ids.
7. **F9** — comp expiry. Kathleen's decision, with a real calendar deadline.

**Preserve:** the privacy firewall between `personal_events` (private) and
`service_availability` (public). Publishing is the existence of a row in a
separate table, never a flag on a private event. A person's private calendar may
inform public availability; Relevé must never expose *why* they are unavailable.

---

*together we rise · relevé*
