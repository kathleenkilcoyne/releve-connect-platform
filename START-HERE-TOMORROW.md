# ☀️ START HERE TOMORROW — Kathleen

*Left for you the night of July 20, 2026, after launch day. Read top to bottom — it's short.*

---

## Where we got to (this is big)

**Your site is LIVE and working on the internet** at:

### 👉 https://releve-connect-platform.vercel.app

That's a real, working site — I loaded it myself and confirmed: the homepage renders, the database is connected, the login flow works, zero errors. It is **not** your public address yet (releveconnect.com still shows Brent's old site — untouched and safe). This is the staging address where we test before flipping the switch.

**What's done:**
- ✅ All the code merged and pushed to GitHub
- ✅ Deployed to Vercel (auto-redeploys every time code changes)
- ✅ Environment settings loaded in
- ✅ Supabase configured to allow logins from the new address
- ✅ **Database cleaned** — every test account and fixture removed. Only your real admin account (`kathleen@releveconnect.com`) remains. Fresh and clean for real applicants.
- ✅ `/subscribe` page rewritten for the free launch (no prices, no "$30", no broken "manage card" button for founding members)
- ✅ Resend email — DNS records added; domain was **"pending"** verification (that finishes on its own — check it in the morning)

---

## The plan for today — in order

### 1. Check two things that were "verifying" overnight
- **Resend:** open resend.com → Domains → `releveconnect.com`. It should now say **Verified** (green). If so, your emails can send.
- **Test the live site yourself:** go to https://releve-connect-platform.vercel.app and click around — homepage, The Climb, Apply. Try signing in (Apply → enter your email → check your inbox for the one-tap link).

### 2. Do a real end-to-end test run (do this WITH Claude)
Ask Claude to walk you through: **apply as if you were a stranger**, then **approve yourself from the admin console**, and confirm you get the acceptance email and can build a profile. This is the last proof before going public. Claude can watch each step.

### 3. THEN flip your real domain (the go-live — ~10 minutes, do WITH Claude)
This is the moment releveconnect.com becomes the new site. It's the one step that's hard to undo quickly, so we do it deliberately and together:
- In Vercel: add `releveconnect.com` as a custom domain → it gives you 2 DNS records
- In Namecheap: **first lower the DNS "TTL" to ~5 min, wait, then** add those records (Claude will guide)
- Update two settings to the real domain (the Vercel site-URL, and Supabase's allowed URLs)
- Verify, then Brent's old site is retired

---

## Small things still on my list (not blockers — Claude will handle)
- MailerLite keys for "The Climb" signup (optional — the signup works, it just needs the keys to actually add people; do this only after you decide on the opt-in wording you're happy with)
- The `NEXT_PUBLIC_SITE_URL` setting still says "localhost" — Claude will set it to your real domain during the cutover (step 3), so it's intentionally left for then
- ⚠️ **Do NOT turn on MailerLite auto-subscribe** — there's a separate hidden feature that adds every buyer to a list with no opt-in. It stays OFF. Claude knows.

---

## Things ONLY you can decide (Claude won't guess)
- **Studio application questions:** the studio path currently asks one open-ended box. If studios are important to your first wave, we should add proper questions (student count, staff count, year founded) before you invite them. 10-minute build once you say what to ask.
- **Founding members were promised "free for one year"** — that clock starts when each person is accepted. Nothing to do now, just know it's tracked.

---

## The honest one-liner
You built and shipped a working platform today. It's live, it's clean, and your real site is safe. Tomorrow is: confirm email verified → test it end-to-end → point your domain. You're basically there.

Rest well. — Claude 🤍

*(Full technical detail is in `GO-LIVE-CHECKLIST.md` and `RESUME-HERE.md` if you or Claude need it.)*
