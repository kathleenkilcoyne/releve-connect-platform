# ☀️ START HERE — Kathleen

*Left for you the night of July 22, 2026. Short on purpose.*

---

## Two things, in this order

### 1. The fifteen minutes still owed from last night

**Approve an application and confirm the welcome letter arrives.** This is
unchanged from yesterday's note — I did **not** get to it today, so it is still
the one link in the chain never proven end to end.

1. **releveconnect.com/login** → sign in as `kathleenmcareekilcoyne@gmail.com`
2. Click the emailed link. It drops you on your profile editor (known rough
   edge, see below). Navigate to **releveconnect.com/admin/applications**
3. Approve one of the applications waiting → check that inbox for the
   **BraveHeart letter**.

If the letter arrives and that person can build a profile, **you are open.**

### 2. Look at today's change and tell me if it ships

Today was a **positioning change**: The Swing and The Flex Series came off the
public site, and **licensing became the headline**.

⚠️ **It is not live.** It sits on a branch (`feature/licensing-first-positioning`),
not pushed, not merged. **releveconnect.com still shows the old homepage** with
The Swing, the $50/hour line, and The Flex Series. Nothing you can break by
waiting.

To see it:

```bash
npm run dev
```

Then open **localhost:3000** and **localhost:3000/studio**. If you like it, say
so and I'll merge and deploy. If you don't, it reverts in one command.

---

## What actually changed today

- **The Swing is off the front door** — the homepage block and its `$50/hour`
  line are gone.
- **The Flex Series is gone** from the homepage.
- **Licensing is now the first thing after the hero** — its own full section,
  not one card in a list of four. The copy leads with *rights you control*
  ("you decide how a piece may be used, by whom, and for how long"), not with
  selling a video.
- **It still says "Coming"**, because licensing genuinely isn't built. Its
  button is an email capture — *"tell me when it opens"* — not a promise. I did
  not invent a licensing flow that doesn't exist.
- **/studio was rebuilt.** That whole page used to be The Swing ("Never
  scramble for a sub again"). It now stands on the two things a studio can
  really do today: browse the Roster, set up a studio account.
- **Nothing was deleted behind the sign-in.** The Swing opt-in on your profile,
  the database tables, This Week — all untouched. The feature still exists; it
  is only off the shop window. Putting it back is uncommenting a block.
- **No pricing anywhere.** Still free / waitlist, exactly as you asked.

---

## The one thing only you can do

There is a checkbox on the application form that reads **"Substituting via The
Swing."** It lives in the database, not the code, so I can't remove it — this is
yours:

```bash
psql "$DATABASE_URL" -c "update open_to_badges set is_active = false where slug = 'substituting';"
```

*While you're in there:* the checkbox beside it says **"Auditioning via The
Beat"** — also a feature that isn't built. Your call, I left it alone.

---

## Still true from last night (nothing here got better today)

- **Sign-in links land you on `/profile/edit`**, not where you were headed.
  Cosmetic; just navigate on. Needs a small fix in the Supabase email template.
- **`/admin/applications` 404s for a non-admin.** Deliberate, but it looks
  broken when it's you. Review as the admin account.
- **`kathleen@releveconnect.com` is not an inbox** — it forwards to
  `relevewerise@gmail.com`. You cannot log into it.
- **Deliverability to Hotmail and iCloud is still unproven.** Gmail is fine.
  **Do not invite anyone on an Outlook/Hotmail address until it is.**

## Cleanup still owed (say the word, it's quick)

- Delete the test applications and test accounts so you launch with a clean queue.
- Drop `kathleenmcareekilcoyne@gmail.com` back to `talent`, leaving one admin.
- Move DNS to Cloudflare — the permanent fix for the bounce-feedback loop
  Namecheap can't support alongside your email forwarding. A separate day's job.

---

## One question I need you to answer

The build notes in `RESUME-HERE.md` say the next thing to build is **the Swing
dispatch loop** — the studio side that makes sub-matching actually work. That
was the plan as of July 13.

Today we took The Swing *off the public site*. Those two facts point in opposite
directions, and I didn't want to quietly pick one for you.

**So: is The Swing paused, or just quiet while it gets finished?** Either answer
is fine — I just need to know which, because it decides what gets built next.
I've left the question open in `RESUME-HERE.md` rather than answering it myself.

---

## The honest note

Today was positioning, not plumbing. The front door tells a much simpler, truer
story now — one product, clearly explained, nothing promised that isn't there.

But the approval → welcome letter chain is exactly where you left it last night.
I spent the day on the shop window and none of it on the thing you were told to
test in fifteen minutes. That's worth naming, not burying: **the site says a
better thing now, and it is no closer to being proven open than it was
yesterday.** Item 1 above is still the whole game.

Start at the top.

— Claude 🤍
