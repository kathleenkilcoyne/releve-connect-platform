# DNS + Email BACKUP — releveconnect.com
**Captured: 2026-07-26** · Source: Namecheap Advanced DNS panel + authoritative DNS lookups (Google 8.8.8.8)
**Purpose:** full pre-migration snapshot before the Google Workspace / Custom-MX change. If anything breaks, restore from this file.

---

## Registrar / DNS host
- **Registrar & DNS:** Namecheap (account `kathleenkilcoyne`)
- **Nameservers:** `dns1.registrar-servers.com`, `dns2.registrar-servers.com` (Namecheap BasicDNS)
- **DNSSEC:** not enabled
- **Website:** Vercel (`A @ → 76.76.21.21`)

---

## HOST RECORDS (exact, from the Namecheap panel — full values)

| # | Type | Host | Value | TTL | What it's for |
|---|------|------|-------|-----|---------------|
| 1 | A | `@` | `76.76.21.21` | Automatic | Vercel (website) |
| 2 | CNAME | `www` | `cname.vercel-dns.com.` | Automatic | Vercel (www) |
| 3 | CNAME | `accounts` | `accounts.clerk.services.` | Automatic | **Clerk** (auth — likely vestigial) |
| 4 | CNAME | `clerk` | `frontend-api.clerk.services.` | Automatic | **Clerk** |
| 5 | CNAME | `clk._domainkey` | `dkim1.z0s3vv1xpv9q.clerk.services.` | Automatic | **Clerk** DKIM |
| 6 | CNAME | `clk2._domainkey` | `dkim2.z0s3vv1xpv9q.clerk.services.` | Automatic | **Clerk** DKIM |
| 7 | CNAME | `clkmail` | `mail.z0s3vv1xpv9q.clerk.services.` | Automatic | **Clerk** mail |
| 8 | CNAME | `litesrv._domainkey` | `litesrv._domainkey.mlsend.com.` | Automatic | **MailerLite** DKIM |
| 9 | TXT | `@` | `google-site-verification=x3U78oFO_b5QYbMLxg65z2UZpAyaX64DM2JB6nmQcnI` | Automatic | Google domain verification |
| 10 | TXT | `@` | `mailerlite-domain-verification=d8c053734f6b64634187c46886d94acf7c19811a` | Automatic | MailerLite verification |
| 11 | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:kathleen@releveconnect.com` | Automatic | DMARC (monitor only) |
| 12 | TXT | `google._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjdf59HBDYnxjZytdIjlCIa186EZwMlk2kZp3BPIm0wBClS+5Hc7D40hSYpGpVn5nOAxcpM+VzsTRZ0b25kmUPkXyPNmfHJobAeGtxaIM9AQb4Rq1q1J3zZVbkcdb6/jaVtN8OPSCrAl0SWEjAw1imBqlLppOaoQzXfzpbPBfatuy8H8BXYUuYgptO0yxBZeQTMX00gAYwrNV2V+uyvNANRmVvOzg6DKPPHxt1mAYon6Q+FDMaEy3iq0XijXEO9H0laGGxh3j6v7vtEjGiG6lyqWONHwqH3VBP4sKuFUA7ptogZ9/fgP8SDxn+L9b4ulNiYOrvap+NpeQG0pWSh8n0wIDAQAB` | Automatic | **Google** email DKIM (from a prior Google setup — relevant to the Workspace migration) |
| 13 | TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCnVOIYiA/kRyHLOnsgLYkZIgUIuDbU39PlkYMTGfmNgqaEz81s8/4uT+h8UjnsPj+Y8xw3fmlUuvC09W19dTlLA7kFioy2sQjwaGpkfFyb01Khze5Qqc1KQIVzTNCdTJ9IrEQ3WRHzrhN1ueo/dKYzosKWRKpCtR8ecg34Kg6eVQIDAQAB` | Automatic | **Resend APEX** DKIM (old — from an earlier apex-domain attempt) |
| 14 | TXT | `resend._domainkey.send` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDhyGV+h4coND2UM5hHESuWCS6gOnAXjeg8KkwkdWD6qmd+Ivs2u4HAxVqS6MkZeJA7LohRt0uiIZBMmQQrBWicPR91dYAdf15q8ADDB7xvIG/1qeEn7vU7KxKoOeDFDu0OnbmOt3jz8LhIMeIr2l3Ij2T0ijuWivBOdxK3NFg64wIDAQAB` | Automatic | **Resend SEND** DKIM (current/active — for `send.releveconnect.com`) |
| 15 | TXT | `send.send` | `v=spf1 include:amazonses.com ~all` | Automatic | Resend send SPF (return-path) |

---

## MAIL SETTINGS
- **Mode:** `Email Forwarding` (this is the free forwarding that must be turned OFF for Custom MX)
- **SPF (auto-managed by Email Forwarding, shown "Locked"):**
  - TXT `@` → `v=spf1 include:_spf.google.com include:spf.efwd.registrar-servers.com include:_spf.mlsend.com ~all` (TTL 30 min)
- **MX records (implicit in Email Forwarding mode — from authoritative lookup):**
  | Host | Value | Priority |
  |------|-------|----------|
  | `@` | `eforward1.registrar-servers.com` | 10 |
  | `@` | `eforward2.registrar-servers.com` | 10 |
  | `@` | `eforward3.registrar-servers.com` | 10 |
  | `@` | `eforward4.registrar-servers.com` | 15 |
  | `@` | `eforward5.registrar-servers.com` | 20 |

---

## EMAIL FORWARDING RULES (Redirect Email)
| Alias | Forwards to |
|-------|-------------|
| `hello@releveconnect.com` | `relevewerise@gmail.com` |
| `kathleen@releveconnect.com` | `relevewerise@gmail.com` |

**⚠️ `billing@releveconnect.com` does NOT exist** — there is no forwarder for it and no catch-all, so mail to `billing@` currently bounces. (Worth creating it as a real mailbox/alias in Google Workspace.)

---

## Notes for the migration
- **Clerk records (3–7):** a full Clerk auth setup from a prior build. The live app uses **Supabase** auth, so these are almost certainly **vestigial** — safe to remove later, but preserved here. Don't remove during the email migration; do it as a separate cleanup.
- **Google DKIM (12) already exists** — a Google email setup preceded this. Good sign for the Workspace migration; Google may reuse the existing verification.
- **Two Resend DKIMs (13 apex, 14 send):** only #14 (`.send`) is active for the current `send.releveconnect.com` setup. #13 is leftover from an earlier apex attempt.
- **MailerLite** = SPF include (#SPF) + verification (#10) + DKIM CNAME (#8). Keep all three; unaffected by the MX change.
- All DKIM values above are **public keys** (published in DNS by design) — safe to store here. No secrets are in this file.

## Restore instructions (if the migration goes wrong)
1. Namecheap → Advanced DNS → Mail Settings → set back to **Email Forwarding** (restores the eforward MX + SPF automatically).
2. Namecheap → Domain tab → Redirect Email → re-add: `hello → relevewerise@gmail.com`, `kathleen → relevewerise@gmail.com`.
3. Confirm host records 1–15 above are all present (re-add any that were changed).
4. Verify with a lookup that the apex MX is `eforward1-5` and mail to `kathleen@` arrives in `relevewerise@gmail.com`.

*Screenshots captured alongside this file: Namecheap Advanced DNS host records + the Redirect Email rules.*
