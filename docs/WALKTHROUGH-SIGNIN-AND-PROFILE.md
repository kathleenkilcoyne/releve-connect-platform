# Sign in, then build your profile — end to end

*Written 2026-07-23 for Kathleen. This is go-live steps 1 and 2 from HANDOFF §4.*

Your application on **kathleenmcareekilcoyne@gmail.com** is **approved**, and the
complimentary founding membership is **active** (Professional, $0, renews
2027-07-24). That was the thing blocking the profile builder. Nothing else is in
your way.

---

## Before anything: pick where you're doing this

The 6-digit code sign-in is **committed but not deployed**. It's on the branch
`signin-codes`, not on `main`, so **releve-connect-platform.vercel.app still has
the old link-based sign-in.**

|  | works today | notes |
|---|---|---|
| **Local** (`http://localhost:3000`) | ✅ codes | Points at your **real** database. Anything you save here is real and permanent. The dev server is already running. |
| **Vercel** (`releve-connect-platform.vercel.app`) | ❌ still links | Needs `signin-codes` merged and deployed first. |

**Recommended: do it locally.** Same database, same data, and you get to try the
code sign-in before it goes anywhere near a real member. Say the word and I'll
merge and deploy to Vercel afterward.

---

## Step 1 — Switch the Supabase email template (2 min, only you can do this)

**Nothing below works until this is done.** The site asks for a code; Supabase
decides what the email says. Right now it still sends a link.

Full instructions: **`docs/SETUP-SIGNIN-CODES.md`**. The short version:

Supabase dashboard → **Authentication** → **Emails** → **Magic Link** tab →
replace the body so it contains **`{{ .Token }}`** and **no `{{ .ConfirmationURL }}`** → Save.

> The one trap: don't leave the link in "just in case." The link and the code are
> the *same* one-time token, so a scanner opening the link kills the code too —
> which is the exact bug you're fixing.

---

## Step 2 — Sign in

1. Go to **http://localhost:3000/login**
2. Enter **kathleenmcareekilcoyne@gmail.com** → *Email me a sign-in code*
3. Check Gmail. Six digits, no button, no link.
4. Type them in → *Sign in*

**You will land on `/admin/applications`, not your profile.** That's correct and
deliberate — you're an admin, and the rule fixed on 7/22 says admins go to the
vetting queue instead of a members-only page. Your profile is one click away.

> Don't hammer *Send a new code*. Supabase's built-in mailer is rate-limited to a
> handful per hour (that's why HANDOFF §2.3 wants real Resend SMTP before
> launch). Each new code also kills the previous one — always use the newest email.

---

## Step 3 — Build the profile

Go to **http://localhost:3000/profile/edit**

It'll say *"Welcome to the Relevé Roster"* — this account is starting fresh. The
sections, in the order you'll meet them:

| Section | What to put there |
|---|---|
| **Photo** | Your headshot. Uploads to Supabase storage. |
| **Featured Video** | A Vimeo or YouTube URL — teaching clip, choreography, class footage, or performance. Renders inline at the top of your public page. |
| **Name** * | Required. The only required field. |
| **Profile handle** | Your shareable link, `releveconnect.com/<handle>`. **Read the warning below.** |
| **Primary role** | Teacher (matches your application). |
| Years / City / State / Country / Age range | |
| **Bio — your story** | No word minimum. §1.3 removed those. |
| Styles · Levels · Focus areas | Tick boxes. Focus areas now include Early Childhood, Adaptive Dance, Improvisation. |
| **Certifications** | Now includes State Teaching License, CPR / First Aid, Safe Sport. |
| **Credentials & training** | Degrees, certifications, companies. |
| **Photo gallery** | Multiple images. |
| **Résumé / CV** | File upload. |
| **Links** | Website · Instagram · Vimeo · YouTube |
| **Availability** | General availability chips, plus *Currently*: Teaching at / Touring with, and what you're accepting. Every chip is a Roster search filter. |
| **The Swing** | One line now — opportunities arrive when Swing launches. Nothing to fill in. |
| **Ready to Join the Relevé Roster** | The publish toggle. Leave it **off** while drafting. |

Then **Save profile**. On success a *"View my public page ↗"* link appears.

### ⚠️ The handle collision — decide before you save

`kathleen-mcaree` is **already taken** by the draft profile on your
`kathleen@releveconnect.com` account. If you type it here, the save **silently
gives you `kathleen-mcaree-2`** — no warning, no error. That's your permanent
public link, the one going in your Instagram bio.

Three ways out:

1. **Free up the slug first** — I rename or delete the old draft on the other
   account, then `kathleen-mcaree` is yours. *Say so and I'll do it.*
2. **Copy the old profile's content over** to this account, then retire the old
   one. Its bio, credentials, headshot and tags are all still there.
3. **Pick a different handle** — `kathleen-mcaree-kilcoyne`, `kathleenmcaree`.

I'd do #1. It's your name and the shorter link is the better one.

---

## Step 4 — Publish, and check it landed

1. Turn on **Ready to Join the Relevé Roster** → **Save profile**
2. Open your public page: `http://localhost:3000/<your-handle>`
3. Open **http://localhost:3000/roster** — you should be there.

To appear on the Roster, all three must be true (this is the `roster_profiles`
view): `profile_status = 'published'` · `visibility = 'public'` · the owner holds
an **active membership**. You now have the third; publishing gives you the first
two.

If you publish and *don't* show up on the Roster, that's the signal to come back
to me — it means one of the three isn't what we think.

---

## What's still open after this

- **Verified Member mark.** Your `verification_flag` is `false`. Per CLAUDE.md §3B
  it's granted at profile creation once vetting is complete (approved + paid) —
  you're both. It's an identity/standing mark, never a competence stamp. There's
  no admin control wired up for it yet; flag it and I'll add one.
- **Deploying the code sign-in** to Vercel — `signin-codes` is still a local branch.
- **The old draft profile** on `kathleen@releveconnect.com` — still there, still
  holding the `kathleen-mcaree` slug, still locked (that account has no membership).
