# Relevé — The Payment Sprint (F1–F6)

*From Kathleen, August 18, 2026. For Claude Code: one concentrated sprint on the
join-and-pay path. Nothing else is in scope until this is done.*

---

## Read first

- `CHECKPOINT-2026-08-17.md` — where we stopped. Profile V2 is complete and verified.
- `CLAUDE.md` — the guardrails. Guardrail #6 in particular governs how I want this built.
- `DECISIONS.md` — the ledger. Every decision in this sprint gets an entry.
- `GO-LIVE-CHECKLIST.md` §5 — accurate on Stripe, **stale elsewhere**. Its §8 database
  warning and §10 merge state are both out of date; §6's `unlisted` blocker is already
  built. Trust this brief over that file where they disagree.

Current position: branch `profile-v2-application-continuity`, HEAD `1aabead`, tree
clean, 483 tests passing, `main` untouched. Stay on this branch. Do not merge.

---

## The standard this sprint is held to

**No friction. No tension.** A person deciding whether to join Relevé must never hit a
wall, a loop, or a silent failure anywhere between "I want in" and "I'm in." If they do,
they leave, and they do not come back. There is no error message good enough to recover
someone who has already decided the thing is broken.

Every judgment call in this sprint resolves toward that. When in doubt: fail loudly to
*me*, never quietly to *them*.

---

## Two decisions that govern the whole sprint

1. **Both populations at once.** Founding members stay complimentary on their free year.
   New joiners pay. Every surface has to serve both without either one seeing copy meant
   for the other. A founding member must never see a paywall. A new joiner must never be
   told their membership is a gift.

2. **`/subscribe` is the buy path and the billing home.** One page: the tiers, the
   prices, what each includes, the purchase button, and the manage/cancel button. Every
   gated page in the app already redirects there, so rewriting it correctly closes three
   dead ends at once.

---

## Scope: F1 through F6. Nothing else.

**Explicitly NOT in this sprint** — do not start these, do not refactor toward them:

- Choreo License / `works` / the rights model. Still waiting on legal counsel.
- `invoice.paid` and the lapse-recovery logic (F7/F8) — **next** sprint. One exception
  below.
- Comp-membership expiry and conversion (F9). That's my decision to make first.
- The Roster region filter, OpenGraph, the DNS cutover, `professional_services` column
  privacy.
- MailerLite. Do not set those environment variables. Do not make `addBuyerToClimb`
  reachable in any new code path. It adds every buyer to a marketing list with no opt-in
  and no unsubscribe surface, and it is inert only because the keys are empty.

---

## Build this first: one membership-state resolver

Before touching any page, extract a single pure function that answers *"what is this
person's membership situation?"* — and unit-test it without a database, the same way
`lib/membership/access.ts` extracts its predicates under guardrail #6.

Every state below is real and reachable today, and getting any of them wrong is what
produces the loops in F2 and F3:

| State | How it arises | What they must see |
|---|---|---|
| `admin` | `users.account_type = 'admin'` | The door to the vetting queue. Keep the existing escape hatch — the comment at `subscribe/page.tsx:49` explains why it exists, and I am not losing an evening to that again. |
| `comp` | active row, `source` is a complimentary one, no Stripe customer | Warm founding-member copy. No prices. No manage button. |
| `active_profile_tier` | active `professional` / `professional_full` | Their profile, and manage/cancel. |
| `active_non_profile` | active `live_pass` or a studio tier | Their own home **and an upgrade path**. Never a profile CTA. |
| `pending` | row written at checkout, webhook hasn't landed | "Confirming your payment" — see F2. **Never a redirect.** |
| `lapsed` | failed invoice | A recovery path, not a locked door. Full fix is F7; do not regress it here. |
| `approved_no_membership` | application approved, no row | The tier chooser, with the $30 credit line **only if a fee was really paid**. |
| `applied` / `declined` / `none` | no approved application | Live Pass + apply, or the existing gentle copy. |

Two comp vocabularies exist and both must resolve to `comp`: `source = 'founding_comp'`
(`lib/membership/founding.ts`) and `source = 'complimentary_permanent' |
'complimentary_term'` (`lib/founding/founding-professional.ts`). Unify the *reading* of
them behind this resolver; don't migrate the data.

---

## The six

### F1 — There is no way to buy a membership

`/subscribe` renders free-founding-period copy with no price list and no purchase button.
`SubscribeButtons.tsx` exists, works, and is imported by nothing. `POST
/api/membership/checkout` is proven end to end with a real test purchase and is
unreachable from the product. All three individual tiers are currently unsellable.

**Build:** rewrite `src/app/subscribe/page.tsx` on top of the state resolver, and wire in
`SubscribeButtons`. Prices come from `lib/membership/tiers.ts` — that file is correct and
is the source of truth. **Do not change any slug, price, or label.** "Creator" is the
customer-facing name for `professional_full`; the slug stays.

**Done when:** a stranger and an approved applicant can each reach Stripe Checkout in two
clicks, and neither is ever shown a price that doesn't apply to them.

---

### F2 — The first thing a paying member does is hit a redirect loop

Checkout succeeds → `/subscribe/welcome` says "Build your profile →" → but the membership
row is still `pending` until the webhook lands, which your own comment at
`subscribe/welcome/page.tsx:16` records as **three minutes** in testing → `/profile/edit`
gates on `hasActiveProfileTier`, fails, redirects to `/subscribe?from=profile` →
`/subscribe` sees an approved application and offers "Build your profile" → bounce.

This is the ten seconds immediately after someone hands us their card. It is the single
worst moment in the product for anything to look broken.

**Build:** make `pending` a first-class state everywhere.

- `/subscribe` recognises it and holds the person on a calm, self-refreshing panel that
  says what is happening.
- The gated pages render that same panel instead of redirecting.
- The `?from=` parameter that every gate already passes is currently ignored — use it, so
  the panel knows where to send them the moment they're active.

**Two traps:** don't poll Stripe on every render — poll our own database through a small
status endpoint. And give the wait a hard stop (~90 seconds), after which they get a warm
"we've got your payment, we'll email you the moment it's ready" rather than a spinner
forever. `/profile/edit` already has catch-up activation, so a late webhook still lands
them correctly.

**Done when:** pay with a test card, click Build your profile the instant the page
renders, and never bounce.

---

### F3 — A Live Pass member is in a loop that never resolves

`subscribe/page.tsx:41` selects *any* active membership, so an active $99 Live Pass holder
is told "You're a founding member 🎉" and handed a profile button. Live Pass is
`hasProfile: false`, so `/profile/edit` bounces them back to the same page. F2's loop
resolves in three minutes. This one never resolves.

**Build:** branch on tier, not on "has a membership." Live Pass gets its own home and a
clear upgrade to Professional. Falls out of the resolver and the F1 rewrite.

**Note:** Live Pass is primarily the family/minor admission through a studio or team —
not a Roster membership. The neutral copy already on `/subscribe/welcome` reflects that
and I want it preserved.

**Done when:** a Live Pass holder is never shown a profile CTA, and can upgrade without
emailing me.

---

### F4 — Cancellation is promised in writing and does not exist

`/subscribe/welcome` tells every payer *"you can cancel anytime in one click from the
membership page"* and links to `/subscribe`, which has no such button. And Stripe's
Customer Portal has **no default configuration in live mode**, so the first real call to
`/api/membership/portal` will 500.

Auto-renewing annual billing with no cancel surface is a consumer-protection exposure, not
just friction. It is also exactly what makes a careful person decline to enter a card.

**Build:** render the manage button on `/subscribe` for anyone holding a
`stripe_customer_id`.

**Bring F11 along — it's one condition.** Comp rows carry no `stripe_customer_id` by
design, so `/api/membership/portal` returns a 404 telling them to go subscribe. Hiding the
button for comp members is required *now*, or F4 creates a brand-new error path aimed at
our most loyal people.

Portal configuration in live mode is mine to do (below).

**Done when:** a paying member cancels in one click from the page the confirmation email
points them at, and a founding member never sees a button that errors.

---

### F5 — `siteUrl()` falls back to localhost silently

`src/lib/stripe/config.ts:26` returns `http://localhost:3000` whenever
`NEXT_PUBLIC_SITE_URL` is unset. If that variable is missing or wrong in production, then
Checkout's success URL, its cancel URL, the billing-portal return URL, and every link in
every email all point at localhost. **Payment succeeds and the member lands nowhere**,
with nothing in the logs. I would learn about it from a confused member.

**Build:** make it impossible to deploy without it.

**Trap:** don't throw at module import. That can break the Vercel build, where the
variable may not be present at build time in every configuration, and a broken build is
its own kind of outage. Throw when the function is *called* in production, or add an
explicit boot-time check that runs in the server runtime. Local development must keep
working with the localhost default.

Do this one first. It's small and it protects everything else in the sprint.

**Done when:** deploying without `NEXT_PUBLIC_SITE_URL` is impossible rather than
invisible.

---

### F6 — Live Stripe isn't set up

The environment still holds an `sk_test_…` key, a CLI-issued `whsec_…`, and six test-mode
Price ids. There is no live webhook endpoint. If the domain goes live against this,
**Checkout takes real money and grants nothing.**

**This one is mostly mine.** What I need from you:

1. A numbered, in-order checklist I can follow in the Stripe dashboard, written for
   someone who is not going to enjoy doing it.
2. Confirmation that `scripts/setup-stripe-tiers.mjs` regenerates all six prices cleanly
   in live mode, and what it outputs that I need to paste where.
3. A verification script or route I can run *after* I've done it that proves the live
   configuration is coherent — keys present, all six prices resolve, webhook signing
   secret valid, portal configured.

Subscribe the live endpoint to the seven events already handled **plus `invoice.paid`**.
The handler is next sprint, but unhandled events are acknowledged safely by the existing
`default` branch, and subscribing now means one less dashboard trip later.

Also pin the Stripe `apiVersion` (F14) while you're in there. The webhook already carries
defensive code reading `current_period_end` from two shapes because Stripe moved it once;
pinning turns that from load-bearing into belt-and-braces.

**Do not invent, guess, or commit any key.** Nothing secret goes in the repo.

**Done when:** a real card buys a real membership on the real domain, access is granted
within seconds, and a refund revokes it.

---

## How I want it built

Slice it the way you sliced Profile V2 — that worked, and I could follow it.

1. **F5** — small, protective, first.
2. **The state resolver** — pure, unit-tested, no database.
3. **`/subscribe` rewritten** on top of it (F1, F3).
4. **The pending state** across the gates (F2).
5. **Manage/cancel** (F4 + the F11 condition).
6. **F6** — my checklist, the verification tooling, the API version pin.

One commit per slice, in the voice the existing log uses. A `DECISIONS.md` entry for
every judgment call, especially anything about how the two populations are told apart.
Update `GO-LIVE-CHECKLIST.md` §5 as items actually close — and correct §8 and §10 while
you're there, they're both stale. Finish with a `CHECKPOINT` doc like yesterday's.

**Standing guardrails:** no migration without a pre-flight and my explicit approval. No
merge to `main`. Tests green and typecheck clean at every commit. If a fix needs a
schema change, stop and show me the pre-flight before writing it.

---

## The walkthrough that has to pass before this is done

In a real browser, in Stripe test mode, against production Supabase — the way Profile V2
was verified. Clean up any `zz-` accounts afterward.

1. A stranger lands on `/subscribe` signed out, and gets to Checkout for Live Pass.
2. An approved applicant buys Professional, and **clicks "Build your profile" the instant
   the confirmation page renders.** No bounce. This is the test that matters most.
3. The same member cancels in one click, from the page the confirmation copy names.
4. A Live Pass holder loads `/subscribe`. No profile CTA anywhere. The upgrade works.
5. A founding comp member loads `/subscribe`. Warm copy, no prices, no manage button, no
   error, and their profile is one click away.
6. A member with `lapsed` status is offered a way back, not a locked door.
7. An admin with no membership still gets the door to the vetting queue.
8. Unset `NEXT_PUBLIC_SITE_URL` in a production-like run and confirm it fails loudly.

If any of those eight produces a loop, a dead end, or a silent failure, the sprint isn't
finished — regardless of what the tests say.

---

*together we rise · relevé*
