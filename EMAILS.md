# Email Register

**The rule (Guardrail #5):** email discipline is sacred. On sign-up we send exactly
**one** confirmation to the applicant and **one** internal alert to the admin — nothing
else automatic. No newsletter auto-subscribe. Approval / decline emails go out **only**
when an admin clicks the button. There are **no hidden triggers**.

Every automated email the system can ever send is listed in this file, with its exact
trigger and current version. If an email isn't in this table, it must not be sent.

---

## Live emails

| # | Email | Trigger (exactly when it fires) | To | Version | Status |
|---|---|---|---|---|---|
| 1 | Application received (confirmation) | Stripe webhook confirms the $30 application fee (`kind: application_fee`) — or the fee is waived for a Founding-25 | Applicant | v1 (draft) | 🔌 wired to a seam (Resend, sender TBD) |
| 2 | New application alert | Same fee-paid/waived event as #1 | Admin (`ADMIN_ALERT_EMAIL`) | v1 (draft) | 🔌 wired to a seam (Resend, sender TBD) |
| 3 | Save-and-resume link | Applicant's progress auto-saves mid-form | Applicant | v1 (draft) | ⏳ not built yet |
| 4 | Approved — next step is payment | **Admin manually approves** an application (`/admin/applications` → Approve) | Applicant | v1 (draft) | 🔌 wired to a seam (Resend, sender TBD) |
| 5 | Request more information | **Admin manually** requests more info | Applicant | v1 (draft) | 🔌 wired to a seam (Resend, sender TBD) |
| 6 | Application declined | **Admin manually** declines (also auto-refunds the $30) | Applicant | v1 (draft) | 🔌 wired to a seam (Resend, sender TBD) |
| 7 | Membership active — you're live | Stripe webhook confirms a membership subscription (`checkout.session.completed`, `kind: membership`) | Member | v1 (draft) | 🔌 wired to a seam (Resend, sender TBD) |
| 8 | New intro request | An employer sends an in-app intro request | Talent | v1 (draft) | ⏳ not built yet |
| 9 | Signature Experience — access & booking links | Stripe webhook confirms a $499 Signature Experience purchase (`checkout.session.completed`) | Buyer | v1 (draft) | 🔌 wired to a seam (vendor TBD) |
| 10 | Membership renewal reminder | Stripe `invoice.upcoming` (~2 weeks before the annual charge; lead time set in Stripe → Billing) | Member | v1 (draft) | 🔌 wired to a seam (Resend, sender TBD) |

> Emails #4, #5, #6 are **manual-only** — they never fire automatically. Email #3's
> resume link is valid for a 14-day window (fast-follow). Emails #1 and #2 are the only
> two that fire automatically on the apply flow, and they fire **once the $30 fee is paid
> (or waived)** — not on the raw Submit click — so an abandoned, unpaid draft triggers
> nothing. Per the guardrail, that's still exactly one applicant confirmation + one admin
> alert, no newsletter auto-subscribe.
>
> Email #9 fires once, transactionally, when a buyer completes a $499 Signature
> Experience purchase (like #7 for membership). It is currently **wired to a seam**:
> the trigger and payload are built and logged, but the actual send waits on the
> email-vendor decision (see `DECISIONS.md`). No email leaves the system until the
> vendor is chosen and the template is finished — no hidden triggers.

---

## Rules for every email here

- **Templated & versioned.** Each email has a named template; content changes bump the version.
- **Single sender.** One from-address (Resend or Postmark — vendor TBD, see `DECISIONS.md`).
- **No tangled automation.** No drip sequences, no marketing lists, no "while we're at it" sends.
- **Tested.** The onboarding emails (#1, #2) are one of the two flows that get automated
  tests — they cannot silently break (Guardrail #6).

---

## How to add a new email (process)

1. Add a row to the table above with its exact trigger.
2. Note it in `DECISIONS.md` with the reason it's needed.
3. Only then build it. An email that isn't in this register must not exist in code.
