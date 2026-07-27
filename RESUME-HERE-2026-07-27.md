# Resume Here — 2026-07-27
*Snapshot at end of 2026-07-26. Start tomorrow from this file.*

## ✅ RESOLVED 2026-07-27 — the email migration is COMPLETE and PROVEN
The big open blocker below is **done**. Summary of what shipped:
- **DNS/email standardized:** apex MX → **Google Workspace** (`smtp.google.com`), `send.send` MX → **Resend** (`feedback-smtp…amazonses.com`), single authoritative apex SPF (`v=spf1 include:_spf.google.com include:_spf.mlsend.com ~all`). Old Namecheap free-forwarding retired. Inbound tested: Hotmail → `info@`/`billing@` land in Google Workspace.
- **Google Workspace:** one paid seat `kathleen@` + free aliases `hello@`, `billing@`, `info@`.
- **Resend domain `send.releveconnect.com` = Verified.**
- **Supabase auth:** Custom SMTP → Resend (`smtp.resend.com:465`, sender `no-reply@send.releveconnect.com`); both **Magic link or OTP** *and* **Confirm sign up** templates switched to `{{ .Token }}` (code, no link); OTP length 8; rate limit 2/hr → 30.
- **Delivery test PASSED:** 4 codes fired, all **Delivered via Resend**, from `"Relevé Connect" <no-reply@send.releveconnect.com>`, body = typed **8-digit code, no link**, incl. **Hotmail** (the inbox that never worked). No 429.
- **iCloud leg — ✅ CLOSED 2026-07-27:** `kathleen_mcaree@icloud.com` → **Delivered** via Resend, 8-digit code, no link. (An earlier test to `ryan_jk@icloud.com` bounced twice with "Recipient's inbox is full" — that mailbox was over quota, not our config; the second iCloud address delivered cleanly.) **All four provider types now green: Gmail, Gmail plus-address, Hotmail, iCloud.** Delivery test fully complete. **Do NOT change DNS.**

*Everything below is the pre-resolution snapshot, kept as history.*

---

The single open blocker is the **auth email migration**, and it comes down to **one DNS decision** you wanted to research before acting. Everything else is done and live.

---

## ✅ Done & live (nothing to revisit)

- **V1 three paths** — homepage "Build your future." fork (Professionals **Apply** · Studios **Partner** · Families **Join**), `/studios` interest form, `/studio`→`/studios` redirect, studio-gated `/join` family flow. Committed + pushed + verified on `releveconnect.com`.
- **Studio profile → "studio story"** (commit `2efd1f3`, live):
  - Location (**city + state**) is now **required** on both the `/studios` interest form *and* the `/studio/edit` profile — verified live.
  - Editor reordered to the story: Name → Artistic Director → Culture → Location → Styles → Scale → Getting there → Certifications → details last, with the new Artistic Director / "what makes you unique" / one-line mission fields (verbatim copy).
  - Interest-form confirmation rewritten to a professional "Request received." message.
  - Migration `20260725000000_studio_story_fields` applied live. 134/134 tests, prod build green.
- **Beyond Dance** tester studio + code **`BEYOND-2026`** exist in the DB (family-join testing).
- **Plus-addresses confirmed distinct** (`…+pro1@` ≠ `…+studio1@`) — safe to use as fresh test applicants.

---

## 🔴 THE open item — Auth email migration (finish, brick by brick)

Governing spec: **`AUTH-MIGRATION-CHECKLIST-FROM-KATHLEEN.md`**. This is *finishing* an incomplete migration, not a redesign.

### Step 0 audit — done 2026-07-26 (in place vs missing)

| Item | State | Evidence |
|---|---|---|
| App send/verify calls | ✅ **In place** | `signInWithOtp` (no `emailRedirectTo`) + `verifyOtp({type:"email"})`. Page `CODE_LENGTH = 8`. |
| Email template (link vs code) | ❌ **Still a link** | Auth logs: `mail_type: magic_link`/`confirmation` → still `{{ .ConfirmationURL }}`, not `{{ .Token }}`. |
| Custom SMTP (Resend) | ❌ **Not connected** | Every `mail.send` from `noreply@mail.app.supabase.io` (built-in mailer). |
| OTP length / expiry | ⚠️ **Verify in dashboard** | Page uses 8; confirm Supabase "Email OTP length" is still 8. |
| Rate limit | ❌ **Too low** | Logs show repeated `429 over_email_send_rate_limit` during the 10 PM test. |

Also confirmed real from logs: the **magic-link consumption bug** (`403: Email link is invalid or has expired` on `/verify`) — exactly what switching to a code fixes.

### 🧱 The blocker for Brick 4 (Custom SMTP): the Resend domain is not verified

Checked live in Resend on 2026-07-26: `send.releveconnect.com` was **`Failed`**; I clicked **Restart** → **`Pending`**, and Resend's own dashboard shows, verbatim:

> ⚠️ **"Missing MX record: This record wasn't found. Add it to enable sending. Once fixed, restart verification."**

So **Resend itself says the MX is required to *send*** (not "just for bounces"). No MX → domain never verifies → Custom SMTP from the branded address will keep bouncing (`550 domain not verified`). **This is the one thing gating the whole email migration.**

---

## 🧭 The DNS decision you're researching (do this first tomorrow)

**The record Resend needs:**

| Type | Host (Namecheap) | Full name | Value | Priority |
|---|---|---|---|---|
| MX | `send.send` | `send.send.releveconnect.com` | `feedback-smtp.us-east-1.amazonses.com` | 10 |

**Your current forwarding MX (root domain):** `eforward1-5.registrar-servers.com` @ priorities 10/10/10/15/20.

**Coexistence analysis (already done):**
- **At the DNS level they coexist fine** — different hostnames (root vs the `send.send` subdomain). Adding Resend's MX does **not** replace or touch your forwarding MX.
- **Namecheap's product blocks it:** while "Mail Settings" = **Email Forwarding**, the UI hides/blocks adding *any* custom MX. To add Resend's, you must switch to **Custom MX** and **manually re-add the 5 eforward records**.
- **The unresolved risk:** whether Namecheap's forwarding *service* keeps working under Custom MX once the eforward records are re-added — or whether it's tied to the "Email Forwarding" *mode*. Best case = seconds-to-~30-min propagation gap (no mail lost, senders retry). Worst case = forwarding stays down until you revert.

**➡️ Safe next step — get this in writing from Namecheap support before switching:**
> "If I change Mail Settings from 'Email Forwarding' to 'Custom MX' and manually re-add the eforward1–5 MX records, will forwarding for kathleen@/hello@/billing@ keep working — or does forwarding require Mail Settings to stay on 'Email Forwarding'?"

If yes → switch, re-add all 6 MX in one sitting (5 eforward + 1 Resend), Restart in Resend, verify. Then Bricks 1/4/5 (dashboard) can proceed.

**MailerLite is NOT involved** (it uses TXT/SPF, not MX). One caveat: a Namecheap mode switch can rewrite the apex SPF — after any switch, re-confirm the apex SPF line is unchanged (`include:_spf.google.com … _spf.mlsend.com …`). I can verify it live in one lookup.

---

## Who does what (capability reality)

- **Dashboard bricks (Kathleen / Cowork):** email template → `{{ .Token }}` (Brick 1), Custom SMTP with Resend key (Brick 4), raise rate limit (Brick 5), confirm OTP length = 8 (Brick 3). I have **no API/tool** for Supabase auth config, and I won't paste your Resend secret key.
- **Claude Code can:** the Step-0 audit, verify every result from the auth logs, the optional code cleanup (retire the `/auth/confirm` + `/auth/callback` link routes — Brick 2), and run the Brick 6 end-to-end + report the real From-address and which inboxes delivered.
- **The bar (do NOT report done from a dashboard):** a real 8-digit code, in Gmail + Hotmail/Outlook + iCloud, signing in first try, from a releveconnect.com sender, 4+ in a row with no 429.

---

## Scope guards
- Studio work and V1 are **finished** — don't re-open.
- The public `/apply` routing change (removing the sign-in wall) and any other refinements are **separate** handoff docs — don't fold them into the auth migration.
- Deploy freeze windows are per-request (last one was the 10 PM–midnight test). Nothing is queued to deploy now (`0 ahead of origin`, clean tree).

*— finish the migration · brick by brick · together we rise · relevé —*
