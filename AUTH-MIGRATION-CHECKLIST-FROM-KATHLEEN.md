# Auth Migration — finish the existing migration, brick by brick
### NOT a redesign. Complete the incomplete migration, one verified step at a time.
*Kathleen · July 26, 2026 · releve-platform*

> ## ✅ COMPLETE — 2026-07-27. All six bricks done and PROVEN.
> - **Brick 1** ✅ Both **Magic link or OTP** *and* **Confirm sign up** templates → `{{ .Token }}` (typed code, no link).
> - **Brick 2** ✅ App verifies via `verifyOtp({type:"email"})` (no PKCE/link path used).
> - **Brick 3** ✅ OTP length confirmed **8** (delivered code was 8 digits).
> - **Brick 4** ✅ Resend Custom SMTP live — From = `"Relevé Connect" <no-reply@send.releveconnect.com>`. Required first resolving the MX by migrating to Google Workspace (see `GOOGLE-WORKSPACE-MIGRATION-PLAN.md`); Resend domain now **Verified**.
> - **Brick 5** ✅ Rate limit raised **2/hr → 30**.
> - **Brick 6** ✅ Delivery test passed at **all three named providers**: **Gmail**, Gmail plus-address, **Hotmail/Outlook**, and **iCloud** (`kathleen_mcaree@icloud.com` — **Delivered**) all got the code via Resend, typed 8-digit, no link. No 429.
>   - *(Note: an earlier iCloud test to `ryan_jk@icloud.com` bounced twice with "Recipient's inbox is full — no available space." Apple accepted our auth and refused only the delivery because that mailbox was over quota — a recipient-account condition, not our config. A second iCloud address delivered cleanly, confirming it.)*
>
> The bar is fully met: real 8-digit code, real inbox at Gmail + Hotmail + **iCloud**, releveconnect.com sender, no built-in mailer. **Do not change DNS.**

---

> ### Reset-password template — DORMANT, intentionally left with its link (2026-07-27)
> A codebase-wide search found **zero** `resetPasswordForEmail`, `signInWithPassword`, or
> `updateUser` password calls — Relevé is fully passwordless. The only code-entry screen is
> `src/app/login/page.tsx`, which verifies with `type: "email"` (not `"recovery"`). The
> `/auth/confirm` route is a passive `token_hash` link handler, not a recovery-code screen, and
> nothing generates a recovery link. Therefore the Supabase **Reset password** template
> (still `{{ .ConfirmationURL }}`, a link) is **never rendered by any flow** and was left
> untouched. Do not convert it to a code unless/until a real recovery user-flow (screen +
> verify-as-recovery) is built first.

## Confirmed: the architecture we want IS the recommended Supabase production setup

I verified this against Supabase's own documentation. Every piece below is the documented,
recommended production configuration — not a workaround. Stop re-evaluating the destination;
it is settled:

- **Email OTP only. No magic links.**
- **Resend as Custom SMTP** (no Supabase built-in mailer).
- **Supabase OTP verification** (`verifyOtp`).
- **Production-ready** for thousands of applicants.

Supabase's docs even name our exact bug and prescribe our exact fix: Microsoft Safe Links
prefetches the magic link and consumes the token — *"the ConfirmationURL sent will be
consumed instantly which leads to a 'Token has expired or is invalid' error"* — and the fix
is *"Use an email OTP instead by including `{{ .Token }}`."* (auth-email-templates).

**I do not want another redesign. I want the design we already have, finished.** This is an
**incomplete migration** — the front end was moved to a code screen, but the email and the
mailer were never migrated. Finish it step by step, brick by brick, verifying each brick
before starting the next.

---

## Stop the MX / domain rabbit hole — it is not the blocker

DKIM and SPF for `send.releveconnect.com` are **already live and correct.** That is what
authorizes Resend to send as us. The MX record everyone got stuck on at Namecheap is **only
for bounce notifications** — it does not block sending and it does not block Resend domain
verification. The DNS side is done enough to send. **The remaining blockers are in the app
and in Supabase Auth config — not in DNS.** Do not spend another cycle on MX.

## Evidence (verified live tonight, 10 PM, via Supabase auth logs + the actual email)

- The sign-in **page** asks for a code, but the **email** is still the default Supabase
  **magic link** (subject "Your sign-in link", `type=magiclink`, "powered by Supabase" template).
- Every auth email still sends from the **built-in mailer** `noreply@mail.app.supabase.io`.
  Resend is **not** connected to Supabase Auth.
- Rate cap hit after 3 sends in ~15 min: **`429: email rate limit exceeded`
  (`over_email_send_rate_limit`)**. Codes frequently don't arrive at all — one never reached
  even Gmail; Hotmail/iCloud never do.

---

## Likely state (from reading the repo) — the app side is largely DONE

The sign-in page (`src/app/login/page.tsx`) already uses the code flow: `signInWithOtp` to
send, `verifyOtp({ type: 'email' })` to verify, and a single `CODE_LENGTH = 8` constant. Its
own header comment states the page **"only works once the Supabase email template has been
switched to send the code (`{{ .Token }}`)"** — and that switch was never completed. So the
remaining work is almost entirely **Supabase-dashboard config, not app rewrites:** the email
template, custom SMTP, and the rate limit. Confirm this in the audit below.

## Step 0 — AUDIT FIRST (report before changing anything)

Compare the current repo + Supabase Auth config against the target above, and report what is
already in place vs. missing for each of these — do not start editing until this is reported:

1. Which auth calls the app uses — `signInWithOtp` to send, and `verifyOtp({ type: 'email' })`
   to verify a typed code? Or is it still the magic-link / PKCE `/auth/v1/verify` redirect?
2. The current **Magic Link / Confirmation email templates** — do they use `{{ .ConfirmationURL }}`
   (link) or `{{ .Token }}` (code)?
3. Is **Custom SMTP** configured in Supabase (Authentication → Emails → SMTP Settings)?
   (It is not — every send is from the built-in mailer. Confirm and report.)
4. The current **OTP length and expiry** settings.
5. The current **auth email rate limit** setting.

---

## The migration — complete each brick, verify, then move to the next

**Brick 1 — Email carries a CODE, not a link.**
Change the Magic Link template (and the signup/confirmation template if that flow is used) to
present `{{ .Token }}` and remove the `{{ .ConfirmationURL }}` link.
✅ *Verify:* the received email shows a typed numeric code and **no** clickable sign-in link.

**Brick 2 — App verifies by OTP, not by link redirect.**
Send with `supabase.auth.signInWithOtp({ email })`; verify with
`supabase.auth.verifyOtp({ email, token, type: 'email' })`. Retire the magic-link/PKCE
redirect path.
✅ *Verify:* entering the code on the page signs in on the **first try**, with no bounce back
to the sign-in screen.

**Brick 3 — Confirm the code length matches (do NOT change the page to 6).**
The page already uses a single `CODE_LENGTH = 8` constant, and per the in-code comments the
project's Supabase **"Email OTP length" was deliberately set to 8** to match. Supabase's
*default* is 6, but this project overrode it — the "8" is intentional and correct. **Do not
"fix" the page to 6.** A prior mismatch (UI 6 / project 8) already caused a silent failure
where the Sign-in button never enabled and codes got their last two digits chopped. Just
**verify** the Supabase "Email OTP length" setting is still 8 so the issued code and the page
agree.
✅ *Verify:* the real code in the received email is 8 digits and signs in on the page.

**Brick 4 — Resend as Custom SMTP (replace the built-in mailer).**
In Supabase → Authentication → Emails → SMTP Settings, enable Custom SMTP with Resend:
host `smtp.resend.com`, port 465, username `resend`, password = Resend API key, sender = an
address on the verified domain (`send.releveconnect.com`). Confirm the Resend domain reads
**Verified** (DKIM + SPF already live).
✅ *Verify:* a new sign-in email's **From** is the releveconnect.com/Resend address (NOT
`noreply@mail.app.supabase.io`), and it lands in **Gmail, Hotmail/Outlook, AND iCloud** within
~1 minute.

**Brick 5 — Raise the rate limit for production.**
Raise the auth email rate limit above the default (~30/hr) so testing and launch surges don't
hit 429. It's a setting, not a ceiling.
✅ *Verify:* send 5+ codes in a row with **no** rate-limit error.

**Brick 6 — End-to-end acceptance (do NOT report done from a dashboard).**
Full pass with fresh addresses: request code → it arrives at **all three** providers as a
typed code → type it → signed in first try → repeat without a rate-limit error.
✅ *Report back:* the exact **From** address on the received email, and which inboxes got it.

---

## Scope guard
This checklist is **only the auth migration.** The public `/apply` routing (removing the
sign-in wall) and the studio-form fixes are **separate** items in the other handoff docs —
do not fold them in here, and do not lose them.

## The standard
"Done" = a real 6-digit code, in a real inbox, at Gmail + Hotmail + iCloud, signing in on the
first try, from a releveconnect.com sender. Nothing less counts, no matter what any dashboard
says. Tonight's live test already failed this bar — the next report should pass it.

*— finish the migration · brick by brick · together we rise · relevé —*
