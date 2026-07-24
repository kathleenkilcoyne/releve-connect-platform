# Relevé Connect — Decisions & Inputs for Claude Code
*Prepared with Kathleen, July 23, 2026. Hand this to Claude Code at the start of the next session.*

**How to read this:** each item has a ✅ (decided), a 💡 (my recommendation — confirm or change), or a 🧍 (needs your explicit call). Anything you don't change, Claude Code treats as approved.

---

## 0. Positioning — already locked (confirm still true)
- ✅ **Licensing-first.** Homepage leads with the licensing catalog; The Swing and The Flex Series are **withheld from the public site** and marked "Coming."
- ✅ **Free founding launch.** Approval grants a complimentary **one-year** membership ($0). No fees at launch.

---

## 1. Decisions

### 1.1 Studio application fields — ✅ DECIDED
- **Ask:** Year founded, and **student count** in bands: **Under 50 · 50–99 · 100–199 · 200+** (clean, no gap/overlap).
- **Do NOT ask** (for now): staff count, number of rooms. No current use — add later only if a feature needs them.

### 1.2 Location — the piece that powers The Swing — ✅ DECIDED
- Exact address lives on the **profile**, not the application.
- **Store it as structured, geocoded data** (street, city, state, ZIP → lat/long), **not a free-text box** — because The Swing matches on distance ("within 25 miles"). Free-text can't be filtered; retrofitting later is a painful migration. Do this now even though Swing isn't live.
- **Multiple locations: yes — keep it simple.** One question: *"Do you have more than one location?"* If yes, let them add each. Don't overbuild it.
- **Address privacy:** show only **city/area publicly**; reveal the **exact address to a teacher once matched/accepted** for a Swing gig.

### 1.3 What the applicant form requires — ✅ DECIDED (corrected)
The application is **intentionally short and warm** — an invitation, not an interrogation. **No word minimums, and no forced "tell your story."** (Confirmed by Kathleen; the git history already removed word counts — an older status file misdescribed this.)
- **Required: at least one link to their work** (reel / video / Instagram), and **state it plainly on the form** — especially that it's needed to be considered for **licensing choreography**. This is the single input curation genuinely depends on: you can't hand-pick a roster without seeing the work.
- Everything else stays optional. Keep the warm tone.

### 1.4 Your own account — 🧍 pick one
You declined `kathleenmcareekilcoyne@gmail.com` while testing, so it can't build a profile. 💡 **My rec: flip your main account back to approved** — it's your identity on the platform. (Alternative: use `serenitypremiercare@gmail.com`, already approved.) This is what unblocks you building your profile and finally seeing the dashboard.

### 1.5 Homepage navigation — 💡 confirm
Nav currently shows only pages that exist (The Roster, For Studios, Sign in, Apply) — good. The mockup listed extras (*Teachers / Choreographers / Dancers*, *The Beat / The Climb / The Green Room*) with no pages yet. 💡 **Keep nav to real pages; add the others when their pages exist.**

### 1.6 Minors / under-18 profiles — 🧍 NEW, needs care
The guardian-managed **student** model already exists (the "Ava · Student" view — a minor's schedule under a guardian, with its own security policy). That's the *safe* version and it's beautiful for a dance-life scheduler.
- 💡 **My recommendation:** enable minors **only as guardian-managed accounts** (a parent creates and controls them), keep minor data **private** (not a public roster profile), and **do not** launch anything minor-facing until parental-consent / COPPA questions are reviewed by **Marshall Law** (your IP counsel) or a privacy attorney.
- ⚠️ This is a **legal/privacy decision, not just a product one** — under-13 triggers COPPA, and public minor profiles carry real obligations. Flagging so it goes to counsel before build.
- 🧍 Confirm: guardian-managed private scheduler now, public minor profiles parked pending legal.

### 1.7 MailerLite — ✅ hold
Stays **OFF** until there's a real opt-in checkbox + unsubscribe. It's inert only because the keys are empty; do not set them.

### 1.8 Stripe — ✅ defer
Dormant during the free launch. Regenerate a fresh test key only if you want to keep testing the $499 flow now; live keys come at cutover.

### 1.9 Recruitment funnel — social post + QR → Apply → choreography — ✅ DECIDED
The "calling all choreographers" social post and its **QR code point straight at the Apply page** — not a generic "join." Everyone recruited arrives and, as part of applying, **submits a link to their choreography** (§1.3), so recruiting a choreographer and getting their work to evaluate happen in **one motion** — no separate "send me your reel" chase later. The QR encodes the Apply URL; the post's call-to-action is **"Apply."**

---

## 2. Your ~2-minute dashboard actions (only you can do these)
Claude Code will hand you exact click-by-click steps for each.
1. 🛑 **Sign-in codes.** After Claude Code switches sign-in to a 6-digit code, **you paste that code into the Supabase → Auth email template.** This is the #1 blocker (Outlook/Hotmail users can't sign in until it's done).
2. **Vercel environment variables:** set **`ADMIN_ALERT_EMAIL`** (your inbox — *without it you're never told an application arrived*), `NEXT_PUBLIC_SITE_URL`, `EMAIL_FROM_ADDRESS`, `EMAIL_API_KEY` (Resend), and `FOUNDER_WELCOME_BOOKING_URL`.
3. **Email:** finish **Resend domain verification**; set **real SMTP** in Supabase (default sender is rate-limited and won't survive a launch).
4. **Send yourself one real test email** end-to-end (implemented ≠ delivered).
5. **DNS cutover** at your registrar — Claude Code sequences it; you flip DNS **last**.
6. **Approve clearing the test data** (3 test applications, 2 memberships, 6 accounts) — one command.

---

## 3. Build tasks for Claude Code (flow from the decisions above)
- Structured + geocoded **location** model (with multiple-locations support) — §1.2
- Studio fields: student-count bands + year founded — §1.1
- **Require + display a work link on /apply** (state it's needed for licensing consideration); keep the rest optional — §1.3
- **Point the Apply QR / social CTA at the Apply page** so recruits submit choreography on the way in — §1.9
- **6-digit sign-in codes** (the Outlook fix) — §2.1
- **Progress bar on /apply** (CLAUDE.md §4F, not yet built)
- Harden the guardian/minor flow + consent gating **only after legal sign-off** — §1.6

---

## 4. The order to actually go live
1. **Sign-in codes** (unblocks everyone)
2. **Flip your account approved** → **build your profile end-to-end** (the last unproven link — and the one that finally shows you the dashboard)
3. Structured **location** capture
4. **Applicant requirements** enforced
5. Set env vars + **verify a real email arrives**
6. **Clear test data**
7. Rehearse the full flow on the staging URL
8. **DNS cutover** to releveconnect.com (DNS flipped last; leave Brent's old site up ~1 week as rollback)

---

## 5. Hold for later — when payments turn on (not now)
- Live Stripe webhook endpoint + **Customer Portal config** (or nobody can cancel)
- **`invoice.paid` renewal handler** (currently annual renewals won't extend, and a lapsed member isn't restored on retry)
- A **renewal path for founding members** before their free year ends (~July 2027)

---

*Tonight: the new site is live at **releve-connect-platform.vercel.app** — not releveconnect.com yet (that still shows the old site). Check `/this-week` to see the calendar.*
