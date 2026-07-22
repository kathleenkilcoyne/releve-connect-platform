# ☀️ START HERE — Kathleen

*Left for you the night of July 21, 2026. Short on purpose.*

---

## The one thing left

**Approve an application and confirm the welcome letter arrives.** That's it.
Everything before it in the chain is now proven working.

### Do it this way (simplest path — 3 steps)

1. Go to **releveconnect.com/login** and sign in as
   **`kathleenmcareekilcoyne@gmail.com`**
   *(This account is now an admin. The sign-in link lands straight in that inbox —
   no forwarding, no alias, nothing to hunt for.)*
2. Click the link in your email. **It will drop you on your profile editor** —
   that's expected, see "known rough edges" below. Then go to:
   **releveconnect.com/admin/applications**
3. Approve one of the two applications waiting. Then check the applicant's inbox
   for the **BraveHeart letter**.

If the letter arrives and that person can build a profile, **you are open.**

---

## What is confirmed working (tested today, not assumed)

- ✅ **releveconnect.com is the new site.** Brent's Netlify site is buried but
  still parked as a rollback.
- ✅ **The application submits.** Two applications are in the queue right now.
- ✅ **The applicant confirmation email arrives** — fast, correct wording.
- ✅ **The admin alert arrives** at `relevewerise@gmail.com`.
- ✅ **Sign-in links arrive and work.**
- ✅ **Email sends from `hello@releveconnect.com`** (a real address that forwards
  to your Gmail). The old `info@` had no mailbox behind it and is gone.
- ✅ **The application no longer counts words at anyone**, asks for references,
  numbers its sections, or shows a price or a date.
- ✅ **All four letters are in your voice**: received, accepted (BraveHeart),
  not-yet, and tell-us-more.
- ✅ **Dark mode is dead.** The form was invisible on a phone set to dark; it now
  renders light always.

## What is NOT proven yet

- ❓ **Approval → welcome letter → profile builder.** Never completed end to end.
  This is tomorrow's fifteen minutes.
- ❓ **Deliverability to Hotmail and iCloud.** Gmail is fine. Microsoft accepted
  two messages and showed neither; Apple deferred one. The likely cause was fixed
  late today (links now point at releveconnect.com instead of a supabase.co URL,
  and the sender is now a real address) — but it has not been retested.
  **Do not invite anyone on an Outlook/Hotmail address until it is.**

---

## Known rough edges (annoying, not broken)

- **The sign-in link lands you on `/profile/edit`, not where you were headed.**
  A regression from today's email-template fix — the "return to this page"
  parameter got dropped. Cosmetic; just navigate to `/admin/applications` after.
  Needs a small fix in the Supabase email template.
- **`/admin/applications` returns 404 if you're signed in as a non-admin.** That
  is deliberate (a member shouldn't learn the console exists), but it looks
  broken when it's you. Review as an admin account; test as anyone else.
- **`kathleen@releveconnect.com` is not an inbox.** You cannot log into it. It is
  a forwarding alias — mail to it appears in `relevewerise@gmail.com`. There is
  no Google Workspace account behind it.

---

## Cleanup owed (say the word, it's quick)

- Delete the two test applications and the test accounts, so the queue you launch
  with is clean.
- Drop `kathleenmcareekilcoyne@gmail.com` back to `talent`, leaving exactly one
  admin identity.
- Move DNS to Cloudflare — the permanent fix for the bounce-feedback loop that
  Namecheap cannot support alongside your email forwarding. A separate day's job.

---

## The honest note

Today the domain moved, the old site was buried, email started sending from your
own name, and the application stopped feeling like an interrogation. That is a
real day.

Tonight did not finish, and some of that was on me: I redeployed an older build
by mistake, I introduced the sign-in redirect regression, and I looked straight
at a near-black screenshot this afternoon without registering that a human
couldn't read it. You found that one in thirty seconds by trying to use it.

Nothing is lost. Everything above is committed. Start at the top of this file.

— Claude 🤍
