# Sign-in codes — the one dashboard step only Kathleen can do

*Written 2026-07-23. Pairs with HANDOFF-FROM-KATHLEEN.md §2.1.*

## What changed and why

Sign-in used to email a one-tap **link**. Outlook, Hotmail, and most corporate
mail scanners automatically open ("pre-fetch") every link in a message to check
it for malware. The link is single-use, so the scanner **spends it before the
human ever taps it**. Those people could never sign in, and nothing on screen
explained why.

The site now asks for a **6-digit code** instead. A scanner can't "click" a
number, so the code survives the trip.

**The code build is done.** But Supabase decides what the email actually says,
and that lives in your dashboard, not in the code. Until you do the five clicks
below, the site will ask for a code and the email will still contain a link.

---

## Do this (about 2 minutes)

1. Go to **https://supabase.com/dashboard** and open the **releve-platform**
   project (`hmqqxbkhcqspqmsjxodq`).
2. In the left sidebar: **Authentication** → **Emails** (older dashboards call
   it *Email Templates*).
3. Pick the **Magic Link** template tab. *(Yes, it's still called that — it's
   the template used for all passwordless email sign-in, code included.)*
4. **Delete everything in the message body** and paste this in its place:

   ```html
   <h2>Your Relevé sign-in code</h2>
   <p>Enter this code on the sign-in page:</p>
   <p style="font-size:32px;letter-spacing:8px;font-weight:600;margin:24px 0;">{{ .Token }}</p>
   <p>The code is good for one hour and can only be used once. If you didn't ask to sign in, you can ignore this email.</p>
   <p style="color:#888;font-size:13px;">— together we rise · Relevé Connect</p>
   ```

   Set the **Subject** to: `Your Relevé sign-in code`

5. Click **Save**.

### The one thing that must be true

The body must contain **`{{ .Token }}`** and **no `{{ .ConfirmationURL }}`**.

If you leave the link in alongside the code, the scanners keep pre-fetching it —
and because the link and the code are the *same* one-time token, a scanner
opening the link **kills the code too**. That would put you right back where you
started. Code only.

---

## Then test it (1 minute)

1. Go to the site → **Sign in**.
2. Enter your email → **Email me a sign-in code**.
3. Check your inbox. You should see six digits, no button, no link.
4. Type them in → you're in.

If the email still shows a link, the template didn't save — redo step 4.

---

## What the site does now

- `/login` asks for email, then for the 6 digits, then verifies them.
- A wrong or stale code says so plainly, and offers **Send a new code**.
- **Send a new code** invalidates the previous one — always use the newest email.
- Codes expire after **one hour** (`otp_expiry` in `supabase/config.toml`).
- After a code is accepted, `/auth/after-signin` decides where you land:
  **admins → `/admin/applications`**, everyone else → `/profile/edit`.
- Old **links** still work if one is already sitting in someone's inbox —
  `/auth/callback` and `/auth/confirm` were left in place on purpose.

## Rate limit worth knowing about

Supabase's built-in email sender is rate-limited and is **not** meant for
launch traffic. That's HANDOFF §2.3 — real SMTP (Resend) in
**Authentication → Emails → SMTP Settings**. Do it before you invite anyone,
or the codes simply stop being delivered partway through a launch day.
