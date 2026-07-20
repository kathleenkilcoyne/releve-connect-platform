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

---

## Live emails

| # | Email | Trigger (exactly when it fires) | To | Template | Status |
|---|---|---|---|---|---|
| 1 | Application received (confirmation) | Applicant clicks **Submit** (free period). Reverts to the $30 fee-paid webhook when payment is on. | Applicant | `application-received.v2` | ✅ implemented |
| 2 | New application alert | Same event as #1 | Admin (`ADMIN_ALERT_EMAIL`) | `admin-new-application.v1` | ✅ implemented |
| 3 | Save-and-resume link | **Once**, the first time a draft auto-saves. Never again for that application (guarded by `resume_email_sent_at`) — autosave runs every few seconds, so "once" is load-bearing. | Applicant | `application-resume-link.v1` | ✅ implemented |
| 4 | Approved — welcome | **Admin manually approves** (`/admin/applications` → Approve). Free period: also grants the complimentary first year. | Applicant | `application-approved.v2` | ✅ implemented |
| 5 | Request more information | **Admin manually** requests more info | Applicant | `application-more-info.v1` | ✅ implemented |
| 6 | Application declined | **Admin manually** declines (also auto-refunds the $30, if one was paid) | Applicant | `application-declined.v1` | ✅ implemented |
| 7 | Membership active — you're live | Stripe webhook confirms a membership subscription (`checkout.session.completed`, `kind: membership`) | Member | `membership-active.v1` | ✅ implemented (dormant while free) |
| 8 | New intro request | A member sends a lean in-app intro request on the Roster (explicit user action; no contact revealed) | Talent | `intro-request.v1` | ✅ implemented |
| 9 | Signature Experience — access & booking links | Stripe webhook confirms a $499 Signature Experience purchase | Buyer | `buyer-experience-confirmation.v1` | ✅ implemented |
| 10 | Membership renewal reminder | Stripe `invoice.upcoming` (~2 weeks before the annual charge; lead time set in Stripe → Billing) | Member | `membership-renewal-reminder.v1` | ✅ implemented (dormant while free) |

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
  (e.g. `application-received.v2`); material copy changes bump the version. The id is
  logged on every send and attached as a Resend tag.
- **Single sender.** One from-address (`EMAIL_FROM_ADDRESS`), vendor Resend.
- **No tangled automation.** No drip sequences, no marketing lists, no "while we're at it" sends.
- **Never throws.** A send failure is logged and returned, never raised — see `send.ts`.

---

## How to add a new email (process)

1. Add a row to the table above with its exact trigger.
2. Note it in `DECISIONS.md` with the reason it's needed.
3. Only then build it. An email that isn't in this register must not exist in code.
