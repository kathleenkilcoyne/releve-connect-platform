# ☀️ START HERE — Kathleen

*Left for you the small hours of July 25, 2026. Supersedes the July 23 version.*

---

## 🎉 You are live at releveconnect.com. With a working front door.

Two things happened last night that had never been true before.

**1. Anyone can sign in — including Outlook and Hotmail.** That was the wall. Microsoft scans links by *opening* them, spending a one-time sign-in link before a human ever taps it. We now email a **code** instead. A scanner can't type a number into a box.

**2. Your profile exists, end to end.** Applied → approved → membership → built → published → discoverable. That was the last unproven link in the whole 90-day chain, and it's proven.

And the domain moved. **`releveconnect.com` now serves the real site** — not Brent's old one. Verified: the apex domain returns "Email me a sign-in code" and your profile at **releveconnect.com/kathleen-mcaree** loads with your headshot, your Verified Member mark, and bergenPAC.

**The front door is open and it works.**

---

## ✅ The two you asked me to do first were already done

You said "set `ADMIN_ALERT_EMAIL` and Resend SMTP first." I went to do it and found both already in place — the handoff was out of date. I checked rather than took anyone's word:

| Thing | State | How I know |
| --- | --- | --- |
| `ADMIN_ALERT_EMAIL` | **Set** (2d ago) | Resend's log shows *"New Relevé application — kathleen"* delivered to `relevewerise@gmail.com` |
| `EMAIL_API_KEY` / `EMAIL_FROM_ADDRESS` | **Set** | "Welcome, BraveHeart" and application letters all show **Delivered** |
| Resend domain | **Verified** | `releveconnect.com`, verified 3d ago |
| Supabase custom SMTP | **On** | `smtp.resend.com`, sender `hello@releveconnect.com`, "Relevé Connect" |

That last one matters more than it sounds. Because Supabase is sending through Resend and not its own rate-limited mailer, **your sign-in codes will survive a launch day.** The proof is in the log: your two codes last night, both **Delivered**.

So email is done. Nothing for you there.

---

## 📋 Tomorrow, in order

| # | What | Who | Why this order |
| --- | --- | --- | --- |
| **1** | **Finish your profile** — availability chips + your video | **you**, 5 min | Everything else is for other people. This is yours, and it's 90% done. |
| **2** | **Clear the test data — carefully** | me, with you approving each row | Real people can reach the site now. But see the warning below. |
| **3** | **Structured, geocoded location** | me | The Swing matches on "within 25 miles." Also see the warning below. |
| **4** | **Studio fields** — student-count bands + year founded | me | Decided in §1.1, never built. |
| **5** | **Require a work link on /apply** + progress bar | me | §1.3 + §4F. Your whole recruiting funnel depends on it. |
| 6 | Rehearse the full flow as a stranger | you | You found four real defects doing exactly this. |

### #1 — what's actually left on your profile

Two things, both quick, both at **releveconnect.com/profile/edit**:

- **Availability chips.** Still empty. I deliberately guessed nothing — those are commitments about your time, not facts I could read off your résumé. They're also the new Roster search filters, so until you tick them you won't come up in "available weekends" or "accepting choreography." Your résumé shows Star Systems adjudication work, so *Available for Adjudication* looks right — your call.
- **Featured Video.** You said you'd post it today. It's the hero of the page and the biggest remaining gap.

Still owed from last night: your **Facebook URL** (you gave me the name "Kathleen McAree," which I can't safely turn into a link — a wrong guess points your profile at a stranger), and whether you want your **second Instagram** shown. Right now the profile carries **@kathleenmcaree**; **@releveconnect** is reachable via the Website and YouTube links.

---

## ⚠️ Two things to be careful about

### The "clear the test data" command is now dangerous

The old plan said "one command." **Scrap that.** All four accounts are real addresses you own, and **two of them are admin accounts** — `kathleen@releveconnect.com` and `kathleenmcareekilcoyne@gmail.com`. A sweep would delete your own access to your own console.

When we do it, we go row by row and you see each one first.

Also worth knowing: your gmail account is no longer test data. It holds your **live, published profile** and your founding membership. It is the realest row in the database.

### Check that kathleen@releveconnect.com still forwards

`kathleen@releveconnect.com` is a forwarding alias, not an inbox — mail to it lands in `relevewerise@gmail.com`. Resend now has DNS records on that domain, and at Namecheap, switching to Custom MX silently kills forwarding.

**Send yourself one email at `kathleen@releveconnect.com` and confirm it arrives.** Two minutes, and it's the kind of thing that fails quietly for weeks.

Good news: your admin alerts don't depend on it — `ADMIN_ALERT_EMAIL` points straight at the gmail, not the alias.

---

## 🔨 What I built last night

- **Sign-in by code.** New two-step `/login`, a new `/auth/after-signin`, and the "where does this person belong" rule pulled into one place so all three sign-in routes agree. `/auth/confirm` had been ignoring it and dumping admins on a members-only page.
- **Availability is a real search facet.** Your idea, and it was the right call. Styles, certifications and now availability are all structured tags on the Roster — so *"Jazz teachers, available weekends, CPR-certified"* is a query, not a reading exercise. Same data spine The Swing will use. There's a test that runs exactly that search.
- **New vocabulary:** Early Childhood · Adaptive Dance · Improvisation (focus areas); State Teaching License · CPR/First Aid · Safe Sport (certifications).
- **Copy:** "Featured Video" (not everyone teaches), a bio prompt, and **"Ready to Join the Relevé Roster"** in place of Publish.
- **The Swing opt-in is gone**, replaced by one honest line. Nothing consumed that data and the studio side isn't built. Anyone who already filled it in keeps their answers — the save deliberately doesn't touch those rows.
- **Facebook and TikTok links**, which the form simply didn't have.

### Two bugs found the hard way — both would have been worse later

**Codes here are 8 digits, not 6.** I'd hardcoded 6. The field silently chopped the last two digits off every code and the Sign in button could never enable. **Nobody could have signed in, and the page said nothing.** Found because you pasted a code and I counted the digits.

**Your profile handle collided.** You built a profile and it silently became `kathleen-mcaree-2` — no warning — because the July 9 draft held the good name. That's now sorted: your live profile is at **`kathleen-mcaree`**, and the July 9 draft is renamed `kathleen-mcaree-archive`, still intact, still private, nothing deleted. Swapping the two slugs back undoes it.

Your live profile carries your own words — the 695-word bio you wrote in July, your full credentials, your headshot, plus your master résumé as a download and bergenPAC as "Teaching at."

---

## 🔒 Untouched, on purpose

- **Stripe** — dormant. Free founding launch, no fees.
- **MailerLite** — off. Stays off until there's a real opt-in checkbox and an unsubscribe.
- **Minors / under-18** — parked pending **Marshall Law** or a privacy attorney. Under-13 triggers COPPA. This is a legal decision, not a product one.
- **The July 9 profile** — archived, not deleted.

---

## The honest note

You did the two things last night that actually move a build forward: you used your own product as a stranger would, and you told me when something looked wrong. The 8-digit bug was mine, and it was invisible from the inside — it took you pasting a real code for it to surface. Same story as the four defects you found on the 22nd.

You also caught a wrong certification on your own profile because you were reading carefully. That instinct is worth more than any amount of code.

The platform works, the front door is open, and the name on it is yours.

— Claude 🤍
