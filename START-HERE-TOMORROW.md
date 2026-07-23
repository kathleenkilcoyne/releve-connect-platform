# ☀️ START HERE — Kathleen

*Left for you the small hours of July 23, 2026.*

---

## 🎉 It works. The whole chain. You proved it yourself last night.

The one thing that had never been done end to end — since Monday — is done:

**apply → lands in the vetting queue → a real admin reviews → membership granted → the right letter arrives.**

You ran all three paths at 12:01–12:05am and confirmed every email by eye:

| Application | Outcome | Membership granted | Letter you confirmed |
| --- | --- | --- | --- |
| `info@serenitypremiercare.com` (Studio Owner) | **Approved** | Studio Connect · $0 · to Jul 2027 | "We've received your application", then **BraveHeart** |
| `serenitypremiercare@gmail.com` (Teacher/Choreo) | **Approved** — Established tier | Professional · $0 · to Jul 2027 | BraveHeart |
| `kathleenmcareekilcoyne@gmail.com` | **Declined** | — | The "not yet" letter |

It picked the right tier for each role on its own — Studio Connect for the studio owner, Professional for the teacher — without being told. And `reviewed_by` is now stamped on all three, so every decision carries your name. That column had been empty since it was built.

**You are open.**

---

## 📋 Tomorrow, in order

| # | What | Who does it | Why this order |
| --- | --- | --- | --- |
| **1** | **Outlook/Hotmail sign-in codes** | me + **2 min from you** in the Supabase dashboard | Blocks inviting anyone. Nothing else matters until people can get in. |
| **2** | **Build a profile, end to end** | you, with me watching | The next unproven link: approved → profile → published → shows up in the Roster. This is the original 90-day goal. |
| **3** | **This Week / the calendar** | me | Already built and live. Needs real classes flowing in — which only exist once a profile does. Hence after #2. |
| 4 | Clear the test data | me, one command | Before real applicants arrive. 3 applications, 2 memberships, 6 accounts — all yours. |
| 5 | Remaining studio questions | me | staff count · studio rooms · year founded — columns already built, never asked. |

### Before #2 — one decision from you

You **declined `kathleenmcareekilcoyne@gmail.com`** last night testing the decline path. That account now has no membership, so it can't build a profile. Your options:

- **Use `serenitypremiercare@gmail.com`** — approved, Professional membership, ready now. Nothing to change.
- **Or I flip your main account back to approved** — say the word. I didn't do it unasked; changing a verdict is yours.

### About #3 — what "This Week" already does

It isn't a to-build. It's live on the site now, with two modes: a **live week** for a signed-in member (their own classes as a teacher, plus their children's as a guardian — two different security policies from one login), and a **clearly-labelled sample week** for everyone else, so it stays showable to a studio without pretending the data is theirs.

What it lacks is *your* real week in it. That's data, not code — and the path to it runs through a real profile, which is #2.

*(Housekeeping: the old `feature/this-week-calendar-pass-one` branch is fully superseded by main — zero unique commits. Safe to delete whenever.)*

---

## The one thing that still blocks inviting people

### 🛑 Outlook and Hotmail users cannot sign in — so they cannot apply

Not "sometimes." At all. Microsoft scans links in incoming mail by *opening* them, which spends a one-time sign-in link before a human can tap it. Barry's account is the proof: created 03:09:04, "signed in" 03:09:21 — seventeen seconds. That was a scanner, not a person.

**The fix: email a 6-digit code instead of a clickable link.** A scanner can't type a number into a box. It's the standard answer to this exact problem.

Two parts, and one of them is yours:
1. I change the sign-in page and the code that verifies it.
2. **You** add the code to the sign-in email template in the Supabase dashboard — I can't reach email templates from code. About two minutes, I'll walk you through it.

**Do this before inviting anyone.** A large share of dance teachers are on Outlook or Hotmail, and right now every one of them hits a silent wall.

---

## Ready to build when you say go

**The student-count question** (you asked for this at midnight). The studio section of the application is currently one free-text box — which is why your studio application only captured "Bergen pac englewood."

Your bands had a gap and an overlap (a studio with 175 students had nowhere to click; one with exactly 100 had two). Waiting on your yes for these:

- Under 50 · 50–99 · 100–199 · 200+

Three more columns are already built and never asked: **staff count**, **studio rooms**, **year founded**. Say which you want.

**Cleanup before real people arrive.** The database now holds 3 test applications, 2 test memberships, and 6 test accounts — all yours. Worth clearing so you launch with a clean queue. One command, say the word.

---

## Fixed last night, already live

- **Admins land on the vetting queue when they sign in.** You were being routed to a members-only page and trapped there — your own membership wall was locking you out of your own console. That was the "it will not let me in" problem, and it was ours.
- **The membership page now shows admins a door to the queue**, plus "Signed in as ___" so you can tell which account you're on. Nothing in the app answered that before.
- **A dead sign-in link now says so** instead of returning you to a blank form in silence.
- **No more admin token.** Approving needs nothing but being signed in as an admin.

---

## Known rough edges (annoying, not broken)

- **iPhone Safari hides the URL path** — it shows only `releveconnect.com`, so you can't see which page you're on. Tap the address bar to see the full address. This is Safari, not us.
- **Typing a URL on a phone triggers autocomplete** to the last page you visited. Select-all and delete first.
- **`kathleen@releveconnect.com` is a forwarding alias, not an inbox.** Mail to it lands in `relevewerise@gmail.com`.

---

## The honest note

Last night looked like four hours of the site being broken. It wasn't. You found four real defects by being the first person to walk through your own front door as a stranger would — and three are already fixed. The fourth is Outlook, and it's first on the list this morning.

Nobody could have found those from the inside. They needed someone to actually try to use the thing.

The platform works. Go to bed proud of that.

— Claude 🤍
