# Point the domain's mail to Google Workspace — Namecheap Custom MX
### The one agreed procedure. Verified against Namecheap's official docs (not from memory).
*Kathleen · 2026-07-26 · releveconnect.com · this is a Namecheap DNS change — NOT Google Admin, NOT the app.*

---

## What's actually wrong (verified live tonight)

The domain's **MX records still point to Namecheap's forwarding servers**
(`eforward1…5.registrar-servers.com`), **not Google.** So every inbound message goes to
Namecheap forwarding, which forwards `kathleen@` to `relevewerise@gmail.com` and **bounces
`info@` / `billing@` with `550 mailbox not found`** (Namecheap forwarding has no such
mailboxes). The Google aliases are provisioned correctly on Google's side — mail just never
reaches Google, because the MX sends it to Namecheap instead. **Fix the MX and both problems
end at once.**

Neither Google Admin nor Claude Code can fix this — the MX lives in **Namecheap DNS.**

## Already done — do NOT redo these
- ✅ Google domain-ownership TXT (`google-site-verification=…`) — live.
- ✅ Google DKIM (`google._domainkey`) — live.
- ✅ Root SPF already includes `_spf.google.com` — good for sending.
- ❌ **MX — this is the only thing wrong.** Everything below fixes just this.

---

## The steps (Namecheap, ~3 minutes)

1. Log in at **namecheap.com** → **Account → Domain List** → **Manage** next to
   `releveconnect.com`.
2. Open the **Advanced DNS** tab.
3. Scroll to the **Mail Settings** section (it's a dropdown; right now it reads
   **"Email Forwarding"**).
4. Change that dropdown to **"Custom MX."**
   → This turns off Namecheap's email forwarding (the `eforward` records). **That is
   intended** — you have real Google mailboxes now, so `kathleen@` should land in Google, not
   forward away.
5. In the MX rows that appear, add **one** record:

   | Field | Value |
   |---|---|
   | **Type** | MX Record |
   | **Host** | `@` |
   | **Value / Mail server** | `smtp.google.com` |
   | **Priority** | `1` |
   | **TTL** | Automatic |

   *(`smtp.google.com` is Google's current single-record MX for accounts created after
   April 2023 — Google confirms it "has no impact on mail delivery or reliability.")*
6. **Delete any leftover `eforward…registrar-servers.com` MX rows** if they remain.
7. Make sure there is **no CNAME record on the bare `@` domain** (Namecheap notes this breaks
   mail).
8. **Save** (green checkmark on the row).

### If Namecheap won't accept the single record
Use Google's classic five instead — Host `@` for all, priorities as shown:

- `1` → `ASPMX.L.GOOGLE.COM`
- `5` → `ALT1.ASPMX.L.GOOGLE.COM`
- `5` → `ALT2.ASPMX.L.GOOGLE.COM`
- `10` → `ALT3.ASPMX.L.GOOGLE.COM`
- `10` → `ALT4.ASPMX.L.GOOGLE.COM`

---

## After saving
- Propagation is usually **~30 minutes** (can be up to a few hours).
- Then **test:** send a message to `kathleen@`, `info@`, and `billing@` — each should land in
  **Google Workspace**, and the `550` should be gone.
- Expect: `kathleen@` now arrives in the Google mailbox instead of forwarding to
  `relevewerise@gmail.com`. Make sure you can log into the Google Workspace mailbox.

## Don't lose these when editing (keep them)
- The `google-site-verification` TXT, the `google._domainkey` DKIM, the root SPF
  (`_spf.google.com` … `_spf.mlsend.com`), and DMARC. Only the **MX** changes here.
- MailerLite's `_spf.mlsend.com` include stays.
- You can drop `include:spf.efwd.registrar-servers.com` from SPF later (it was for the old
  forwarding) — optional cleanup, not urgent.

## Verification
Once you've saved it, tell Claude (Cowork) — I'll re-check the live MX and confirm the moment
it's actually pointing at Google and receiving. No guessing, no waiting on anyone.

*— one change, done once · together we rise · relevé —*
