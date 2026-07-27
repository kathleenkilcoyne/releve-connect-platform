# Migration Plan — Google Workspace + Resend (branded email, done right)
*2026-07-26 · releve-platform · supersedes the "preserve free forwarding" approach*

> ## ✅ EXECUTED & VERIFIED — 2026-07-27
> - Namecheap switched to **Custom MX**; apex MX → `smtp.google.com` (1), `send.send` MX → `feedback-smtp.us-east-1.amazonses.com` (10). Old `eforward` forwarding retired.
> - Apex SPF re-published as the single authoritative record: `v=spf1 include:_spf.google.com include:_spf.mlsend.com ~all`. All preserved records (MailerLite, Clerk, Google DKIM, both Resend DKIMs, DMARC, Vercel A/www) left intact.
> - **Google Workspace:** one seat `kathleen@` + free aliases `hello@`/`billing@`/`info@`. Inbound tested — Hotmail → `info@`/`billing@` land in the Workspace inbox.
> - **Resend domain Verified**, and Supabase Custom SMTP is live sending from `no-reply@send.releveconnect.com` (see `AUTH-MIGRATION-CHECKLIST-FROM-KATHLEEN.md`).
> - Full pre-change snapshot preserved in `DNS-BACKUP-2026-07-26.md`. **Do not change DNS further.**

## Why this is the right move
Namecheap officially confirmed: **free Email Forwarding cannot coexist with the Custom MX that Resend needs.** Google Workspace resolves both problems at once:
1. **Real branded mailboxes** (`kathleen@`, `hello@`, `billing@`) — better than forwarding (you log in, send, store, search).
2. **Custom MX becomes available**, so Resend's return-path MX can finally be added → Resend verifies → the auth-email migration unblocks.

The two mail systems live on **different hostnames** and coexist cleanly:
- **Google Workspace** = MX on the **apex** (`releveconnect.com`) — your inbound mailboxes.
- **Resend** = MX on the **`send.send.releveconnect.com`** subdomain — transactional send return-path only.

DNS stays at **Namecheap** (no registrar/nameserver move). The website stays on **Vercel** — the apex `A` record is untouched by any of this.

---

## DECIDED architecture (2026-07-26)
**One paid Google Workspace seat, four addresses, one inbox:**

| Address | Role |
|---|---|
| `kathleen@releveconnect.com` | **Primary mailbox** (the one paid seat — the login) |
| `hello@releveconnect.com` | **Alias** → same inbox |
| `billing@releveconnect.com` | **Alias** → same inbox (created fresh; verified unused) |
| `info@releveconnect.com` | **Alias** → same inbox (new) |

- Aliases are **free** on the one seat — **no separate paid users.** If any address later needs its own login, we convert it to a seat then, not now.
- **Verified before building (2026-07-26):** `support@` is unused (no code, no forwarder) — not being created. `billing@` has no existing forwarder/catch-all and no code reference — safe to create fresh.

### Still open
- **Cutover timing.** The MX switch has a short propagation window. Pick a **low-traffic time** (evening/weekend). No mail is *lost* (senders retry), but new inbound mail routes over during the window.
- **Old forwarded mail.** Everything already forwarded to `relevewerise@gmail.com` stays there. After cutover, new mail lands in the Workspace inbox. Keep `relevewerise@gmail.com` as your personal/reference account.

---

## The phased migration

### Phase 1 — Stand up Google Workspace (Kathleen; account creation is yours, not mine)
- Sign up at **workspace.google.com** (Business Starter ≈ $7/mo — **one seat**). Add domain **`releveconnect.com`**.
- **Verify domain ownership** — Google may accept the existing `google-site-verification` TXT already in your DNS, or issue a new TXT to add at Namecheap.
- Create the **one user**: `kathleen@releveconnect.com`.
- Add three **email aliases** to that user (Admin console → Users → kathleen → Add alias): `hello@`, `billing@`, `info@`. All land in the same inbox. No extra seats.
- ⚠️ **Do NOT switch the MX yet.** Get the mailbox + aliases created first.

### Phase 2 — DNS cutover at Namecheap (the coordinated step — I verify each record live)
Switch **Mail Settings: Email Forwarding → Custom MX** (this ends free forwarding, intentionally), then set:
| Action | Type | Host | Value | Priority |
|---|---|---|---|---|
| **Add** Google inbound | MX | `@` | `smtp.google.com` *(use exactly what Google's wizard shows; older wizards list the 5 `aspmx` records)* | 1 |
| **Add** Resend return-path | MX | `send.send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| **Edit** apex SPF | TXT | `@` | `v=spf1 include:_spf.google.com include:_spf.mlsend.com ~all` *(drop the `spf.efwd…` forwarding include; keep Google + MailerLite)* | — |

**Leave untouched:** apex `A` → Vercel (76.76.21.21), `www` CNAME, DMARC TXT, `google-site-verification` TXT, `mailerlite-domain-verification` TXT, Resend DKIM (`resend._domainkey.send`), Resend SPF (`send.send`).

### Phase 3 — Google DKIM (Kathleen, in Workspace Admin)
- Admin console → Apps → Google Workspace → Gmail → **Authenticate email** → generate DKIM → add the `google._domainkey` (or given selector) **TXT** at Namecheap → **Start authentication**.

### Phase 4 — Verify everything (I run these)
- **Google:** send + receive a test at `kathleen@` — real inbox works.
- **Resend:** the MX now exists → **Restart verification** → domain flips **Failed/Pending → Verified**.
- I confirm apex SPF is exactly the new line, MX resolve correctly (Google on apex, Resend on `send.send`), and MailerLite's records are intact.

### Phase 5 — Resume the auth-email migration (now unblocked)
With Resend **Verified**, finish `AUTH-MIGRATION-CHECKLIST-FROM-KATHLEEN.md`:
- **Brick 1** template → `{{ .Token }}` (dashboard)
- **Brick 4** Custom SMTP: `smtp.resend.com:465`, user `resend`, key, sender on `send.releveconnect.com` (dashboard)
- **Brick 5** raise rate limit (dashboard)
- **Brick 6** I run the end-to-end and report the real From-address + which inboxes (Gmail/Hotmail/iCloud) delivered.

---

## Final target DNS (what the zone looks like when done)
| Type | Host | Value | Note |
|---|---|---|---|
| A | `@` | `76.76.21.21` | Vercel — unchanged |
| CNAME | `www` | `cname.vercel-dns.com` | unchanged |
| MX | `@` | `smtp.google.com` (pri 1) | **new** — Google mailboxes |
| MX | `send.send` | `feedback-smtp.us-east-1.amazonses.com` (pri 10) | **new** — Resend return-path |
| TXT | `@` (SPF) | `v=spf1 include:_spf.google.com include:_spf.mlsend.com ~all` | **edited** — dropped efwd |
| TXT | `google._domainkey` | (Google DKIM key) | **new** |
| TXT | `resend._domainkey.send` | (Resend DKIM) | unchanged |
| TXT | `send.send` (SPF) | `v=spf1 include:amazonses.com ~all` | unchanged |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:kathleen@releveconnect.com` | now a real mailbox |
| TXT | `@` | `google-site-verification=…` / `mailerlite-domain-verification=…` | keep both |

---

## PRESERVE — do not touch (verified 2026-07-26)
Full current state is in **`DNS-BACKUP-2026-07-26.md`**. These records stay exactly as they are through the migration:

- **MailerLite** (newsletter): apex SPF `include:_spf.mlsend.com` · TXT `mailerlite-domain-verification=…` · CNAME `litesrv._domainkey → litesrv._domainkey.mlsend.com`. *(The apex SPF is being re-typed under Custom MX — the mlsend include is carried over verbatim.)*
- **Resend** (transactional send): DKIM `resend._domainkey.send` · SPF `send.send`. We only **add** the `send.send` MX; nothing existing is changed.
- **Supabase** (app auth): **no DNS records on this domain** — it runs via the app's API keys, unaffected by any mail change. Sign-in keeps working throughout (the MX change doesn't touch Supabase's SMTP).
- **Clerk** (old auth): `accounts`, `clerk`, `clk._domainkey`, `clk2._domainkey`, `clkmail` CNAMEs — **left untouched** (see obsolete note below; not removed without approval).
- **Vercel** (site): A `@` → 76.76.21.21 · CNAME `www`. Untouched.

## OBSOLETE CANDIDATES — for your approval, NOT removed
Flagged as *probably* dead, but **left in place** until you approve removal (separate cleanup task, not part of this migration):

| Record(s) | Why it looks obsolete | Evidence |
|---|---|---|
| Clerk CNAMEs (`accounts`, `clerk`, `clk._domainkey`, `clk2._domainkey`, `clkmail`) | The live app has **no Clerk code** at all (uses Supabase). | `grep` for `clerk`/`@clerk`/`CLERK_` across `src`/config = 0 hits. |
| `resend._domainkey` (apex) | Old Resend **apex-domain** DKIM; the active setup is on the `send.` subdomain. | Different key than the live `resend._domainkey.send`; app sends via `send.releveconnect.com`. |

**Action requested:** confirm before I (or you) remove either group. Until then they stay — they're harmless (different hostnames, no conflict with Google/Resend/MailerLite).

## Who does what
- **Kathleen:** Workspace signup + payment + mailbox/alias/DKIM setup (account & credential actions I can't do). DNS edits at Namecheap — you, or I drive your browser with your OK.
- **Claude Code:** this plan + exact record values, **live DNS verification at every checkpoint**, confirm Resend flips to Verified, then run/verify the auth-migration bricks and the final end-to-end.

## Risk / rollback
- **Cutover window:** short mail-routing gap when MX switches; senders retry, no loss.
- **MailerLite:** unaffected (TXT/SPF, not MX) — just re-verify the apex SPF after the edit.
- **Rollback:** if anything's wrong, revert Mail Settings to Email Forwarding + restore eforward MX to get forwarding back while you regroup (you'd lose the Resend MX until re-attempting).

*— branded, production-grade, and Resend finally works — together we rise —*
