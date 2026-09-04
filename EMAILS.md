# Email Register

**The rule (Guardrail #5):** email discipline is sacred. On sign-up we send exactly
**one** confirmation to the applicant and **one** internal alert to the admin — nothing
else automatic. No newsletter auto-subscribe. Approval / decline emails go out **only**
when an admin clicks the button. There are **no hidden triggers**.

Every automated email the system can ever send is listed in this file, with its exact
trigger and current version. If an email isn't in this table, it must not be sent.

> **Sending is IMPLEMENTED (2026-07-20).** All sends go through one function —
> `sendEmail()` in `src/lib/email/send.ts` — which POSTs to **Resend** over `fetch`
> (no SDK dependency; swap vendors by editing that one file). It **never throws**, so a
> failed email can never fail a paid Stripe webhook or an admin action, and it **never
> goes quiet**: with the vendor unconfigured it logs the full message it would have sent.
>
> Nothing actually leaves the building until **`EMAIL_API_KEY`** and
> **`EMAIL_FROM_ADDRESS`** are set (plus **`ADMIN_ALERT_EMAIL`** for #2), and the
> sending domain is verified in Resend.

> **⚠️ FREE FOUNDING PERIOD (2026-07-20).** The $30 application fee is switched OFF.
> Emails #1 and #2 therefore fire from **`submitApplication`** (the Submit click) rather
> than from the fee-paid webhook. That is still exactly one applicant confirmation and
> one admin alert. The webhook branch remains wired with the approved fee wording
> (`APPLICATION_FEE_NOTE`) for when payment is switched back on.
>
> **⚠️ Approval no longer auto-grants complimentary membership (2026-08-23).** For a
> **public** applicant, `approve` in `/admin/applications` now sets Professional Roster
> status ONLY (email #4 below still fires, but without the "your membership is
> complimentary" line unless a comp was already granted). Complimentary founding
> membership requires a second, explicit admin action — `grant_complimentary` in the
> same route, with its own confirmation, no separate email. This does **not** apply to
> the invited Founding Professional flow (`/admin/founding-professionals`), which grants
> its own complimentary membership on invite/claim and is unchanged.

---

## Live emails

| # | Email | Trigger (exactly when it fires) | To | Template | Status |
|---|---|---|---|---|---|
| 1 | Application received (confirmation) | Applicant clicks **Submit** (free period). Reverts to the $30 fee-paid webhook when payment is on. | Applicant | `application-received.v3` | ✅ implemented |
| 2 | New application alert | Same event as #1 | Admin (`ADMIN_ALERT_EMAIL`) | `admin-new-application.v1` | ✅ implemented |
| 3 | Save-and-resume link | **Once**, and only when the applicant LEAVES (tab hidden/closed — the form flags that save). Never on a routine autosave, and never twice (guarded by `resume_email_sent_at`). | Applicant | `application-resume-link.v1` | ✅ implemented |
| 4 | Approved — welcome | **Admin manually approves** (`/admin/applications` → Approve). Grants Professional Roster status only — does NOT grant membership. | Applicant | `application-approved.v3` | ✅ implemented |
| 5 | Request more information | **Admin manually** requests more info | Applicant | `application-more-info.v2` | ✅ implemented |
| 6 | Application declined | **Admin manually** declines (also auto-refunds the $30, if one was paid) | Applicant | `application-declined.v2` | ✅ implemented |
| 7 | Membership active — you're live | Stripe webhook confirms a membership subscription (`checkout.session.completed`, `kind: membership`) | Member | `membership-active.v1` | ✅ implemented (dormant while free) |
| 8 | New intro request | A member sends a lean in-app intro request on the Roster (explicit user action; no contact revealed) | Talent | `intro-request.v1` | ✅ implemented |
| 9 | Signature Experience — access & booking links | Stripe webhook confirms a $499 Signature Experience purchase | Buyer | `buyer-experience-confirmation.v1` | ✅ implemented |
| 10 | Membership renewal reminder | Stripe `invoice.upcoming` (~2 weeks before the annual charge; lead time set in Stripe → Billing) | Member | `membership-renewal-reminder.v1` | ✅ implemented (dormant while free) |
| 11 | ~~New studio interest~~ | **RETIRED 2026-07-28** — the public interest form was removed when studio onboarding became invite-only. `sendStudioInterestAlert` is kept in code but no longer wired to any UI. | Admin (`ADMIN_ALERT_EMAIL`) | `studio-interest.v1` | ⛔ retired |
| 12 | Founding Studio invitation | **Admin creates an invitation** in `/admin/studios` (or re-sends), `org_type = studio`. Carries the secure `/studio/setup?token=…` link. | Studio owner | `studio-invitation.v1` | ✅ implemented |
| 12b | Dance Team invitation | **Same trigger as #12**, `org_type = dance_team`. Same `sendStudioInvitation()`, branched copy via `orgCopy()` (2026-08-28) — never mentions the $30 fee or the public Professional application; this is a private invited pilot. | Team Director | `dance-team-invitation.v1` | ✅ implemented |
| 13 | Studio submitted for review | A studio flips its profile to `submitted` (its own "Submit for review" action) | Admin (`ADMIN_ALERT_EMAIL`) | `studio-submitted.v1` | ✅ implemented |
| 14 | Your studio/team is live | **Admin publishes** an org (`approved` → `live`) in `/admin/studios`. Wording branches on `org_type` via `orgCopy()` — "studio page" for `org_type = studio`, "team page" for `org_type = dance_team`. **v2 (2026-09-04):** adds a short next-steps list under the profile link, all pointing at the owner's own `/studio/schedule`. Dance Team: "Invite your {member_label}," "Build This Week," "Open your team dashboard." Studio: "Build This Week," "Open your studio dashboard" — no invite line, since `/studio/schedule` has no self-serve invite tool for a Studio today (only Dance Teams get a Team Join Code there). Never says "Manage your team/studio" (explicitly rejected — full member add/remove doesn't exist). | Studio owner / Team Director | `studio-live.v2` | ✅ implemented |
| 15 | New dance-team interest | A Team Director submits the `/welcome/team` inquiry (onboarding gateway). ONE internal alert; no applicant email — the on-page confirmation is their acknowledgement. | Admin (`ADMIN_ALERT_EMAIL`) | `team-interest.v1` | ✅ implemented |
| 16 | New industry-partner interest | An organization submits the `/welcome/partner` inquiry (onboarding gateway). ONE internal alert; no applicant email. | Admin (`ADMIN_ALERT_EMAIL`) | `partner-interest.v1` | ✅ implemented |

> Emails #4, #5, #6 are **manual-only** — they never fire automatically. Emails #1 and #2
> are the only two that fire automatically on the apply flow. Per the guardrail, that's
> exactly one applicant confirmation + one admin alert, and no newsletter auto-subscribe.

> **⚠️ NOT an email, but outbound and unresolved: MailerLite.** `addBuyerToClimb()`
> adds every $499 buyer to a marketing group with **no opt-in checkbox anywhere in the
> purchase flow and no unsubscribe surface in the app**. It is inert only because
> `MAILERLITE_API_KEY` / `MAILERLITE_CLIMB_GROUP_ID` are unset — **setting those env vars
> turns it on for every buyer.** That contradicts "no newsletter auto-subscribe" above.
> Decide consent (and add an opt-in) BEFORE setting those keys.

---

## Rules for every email here

- **Templated & versioned.** Each email has a named template id carrying its version
  (e.g. `application-received.v3`); material copy changes bump the version. The id is
  logged on every send and attached as a Resend tag.
- **Single sender.** One from-address (`EMAIL_FROM_ADDRESS`), vendor Resend.
- **No tangled automation.** No drip sequences, no marketing lists, no "while we're at it" sends.
- **Never throws.** A send failure is logged and returned, never raised — see `send.ts`.

---

## How to add a new email (process)

1. Add a row to the table above with its exact trigger.
2. Note it in `DECISIONS.md` with the reason it's needed.
3. Only then build it. An email that isn't in this register must not exist in code.
