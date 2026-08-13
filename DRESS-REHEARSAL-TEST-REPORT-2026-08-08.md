# Relevé Connect — Pilot Onboarding Dress-Rehearsal Test Report

*Manual + DB-verified test pass on production (`releveconnect.com`, Supabase project `hmqqxbkhcqspqmsjxodq`). Prepared 2026-08-08. Driver: Kathleen (owner) with Claude, using a real invited "test studio" and a real family join in a separate browser session. Test records were preserved for retest and are listed at the end.*

## Result at a glance
**The full pilot path is proven working end to end**, and the one blocker found was fixed and re-verified live.

| Step | Result | Notes |
|---|---|---|
| Public "Dance Studio" path → invitation-only Founding Studio wall | ✅ Pass | `/studios/join` correctly says "by invitation — no form here." Not the onboarding path. |
| Admin creates studio invitation | ✅ Pass | `/admin/studios` → "Invite a studio." Row shows "Invited." |
| Invitation email delivered | ✅ Pass | From `hello@releveconnect.com`, lands in inbox. |
| Secure setup link | ✅ Pass | Works from the real email. (An earlier "invalid" result was a Claude link-extraction artifact — see below.) |
| Email-match guard on setup link | ✅ Pass | Correctly blocks a mismatched signed-in email. |
| 8-digit passwordless sign-in | ✅ Pass | Code emailed via `no-reply@send.releveconnect.com`, one-time, 1-hour. |
| Studio profile submission | ✅ Pass | Full profile captured (director, styles, certs, address, etc.). |
| Admin **Approve** | ✅ Pass | Status → `approved`. (No email at Approve — by design; the email is at Publish.) |
| Family **join code** generation | ✅ Pass | `RELE-4Z4W`, `kind=family`, unlimited uses. (Earlier "no-op" was a Claude click artifact.) |
| Family `/join` (auth, guardian consent, dancer create) | ✅ Pass | Family + dancer + guardianship saved; landed on This Week showing the studio. |
| **BLOCKER:** admin "families joined" + roster showed 0 | ✅ **Fixed & verified** | Root cause = read-side querying the wrong tables; fix sources from `affiliations`. Now shows 1 family / 1 dancer. |
| Targeted event delivery (This Week) | ✅ Pass | "Test Solo Private" reached exactly the 1 affiliated dancer. |
| **"Got It"** acknowledgement loop | ✅ Pass | Family tap → studio readout flipped to "✓ Got it: all 1 dancer acknowledged." `event_acknowledgements` migration applied in prod. |
| **Publish** → live + go-live email + public page | ✅ Pass | Status → `live`, slug `releve-pilot-test-studio`, email "…is live on Relevé," public page renders. |
| **Unpublish** | ✅ Pass | Reverts to `approved`, public page 404s, data preserved. |
| Professional profile (public view) | ✅ Pass | `releveconnect.com/kathleen-mcaree` (`/talent/<slug>`), public + shareable. |
| The Roster (`/roster`) | ✅ Works as designed | Members-only; non-members redirect to `/subscribe`. Card click → `/talent/<slug>`. (See open decision below.) |

## The blocker (found → fixed → verified)
Family joins were saving correctly (family, dancer, guardian consent, **and** the studio link in `affiliations`, which the family app reads), but the admin "families joined" count and the studio roster/schedule-targeting read from the empty `enrollments` / `studio_class_dancers` / `studio_group_members` tables and returned 0. Fix (commit `f8e3eb2`) sources those reads from `affiliations`. Re-verified live: studio shows **1 family / 1 dancer**, and the targeted event reached the dancer. Full diagnosis: `BLOCKER-FAMILY-JOIN-ROSTER.md`.

## Corrections to earlier notes
- **Studio go-live email is NOT missing.** It fires at **Publish** (subject: "…is live on Relevé", with the public studio link) — the right moment. Do **not** build a duplicate "approved" email. (Approve intentionally sends nothing.)

## Not bugs (Claude testing artifacts — ignore)
1. The invitation setup link looked "invalid" only because the token's leading `19` was dropped when the link was pulled via the email API; the real emailed link works.
2. "Generate family join code" and several button clicks appeared to no-op only because the browser-automation click didn't fire on this app; every one worked when clicked manually.

## Open items (minor / decisions — not blockers)
- **Founding-studio rate copy** — reframe as a time-boxed founder perk (see `PRICING-AND-ROSTER-VISIBILITY-DIRECTION.md`).
- **Roster visibility model** — decision captured in the same doc (recommend: public profiles stay public; keep Roster tools paid).
- **Passport** view — not exercised this pass.

## Preserved test records (for retest; delete when done)
- `employer_profiles` `696d53cc-604b-42a2-a5c0-e4d81442e206` (status `approved`, unpublished)
- `studio_invites` `RELE-4Z4W` (`9641bae8-d3a2-4155-b710-d6ea90d2cc39`)
- `family_accounts` `b650402a-f6a9-4d00-b5ff-2dc0800f216c`
- `students` `aeca1e93-42c7-410f-b369-1879c44b62c6` (+ its `guardianships` row)
- `affiliations` `8750e2bb-b6bf-4fa2-b84f-c6d38b5e1620`
- `event_acknowledgements` row from the "Got it" test (dancer `aeca1e93…`)
- Test emails go to `kathleen+teststudio@releveconnect.com`.
