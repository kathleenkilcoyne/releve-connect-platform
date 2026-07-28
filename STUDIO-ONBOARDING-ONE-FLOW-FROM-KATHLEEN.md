# One Studio Onboarding Experience — invite-only, brick by brick
### Kathleen's decision, 2026-07-28. This SUPERSEDES the two-form studio setup.
*Read this whole file before writing code. It changes the studio flow end to end. The brand is always **Relevé** (accented é).*

---

## The decision (why we're doing this)

We had **two** studio forms and it was confusing: a short public "interest" form at
`/studios`, and a separate full profile builder at `/studio/edit`. One person, two forms,
two doors — wrong.

Collapse to **ONE** studio onboarding experience. **Invite-only.** Relevé's founding studios
are hand-picked and invited by name — they never "express interest," so there is no public
form. A studio is invited, follows a secure link, signs in as the invited email, and lands
directly in the complete studio setup. One door.

**Hard rules (Kathleen's words):**
1. Collapse into one studio onboarding experience, but **preserve the invite-only gate.**
2. **Do NOT make the full studio profile builder publicly accessible.**
3. Keep `/studios` as the **public founding-studio information page** (pitch only, no form).
4. **Remove** the current short interest form.
5. Invited studios receive a **secure invitation link**, sign in using the **invited email
   address**, then land directly in complete studio setup.
6. Each invitation **creates or connects to one private studio profile.**
7. The studio must be able to **save and return later.**
8. Clear statuses: **invited → in progress → submitted → approved → live.**
9. **Nothing may appear publicly until Kathleen approves it.**
10. The single studio setup includes the existing studio-profile fields **plus website,
    Instagram, TikTok, Facebook, and a YouTube/Vimeo promotional video link.**

---

## ⚠️ Naming collision — read first

A `studio_invites` table already exists (migration `20260724120000_studio_invites_and_interest.sql`)
and is used by `src/app/join/actions.ts`. **That is the FAMILY-join invite** — the code a studio
gives its guardians to enroll their kids. It is NOT this. Do not reuse or overload it.

This new thing — Kathleen inviting a **studio owner** to onboard — needs its **own** table.
Name it distinctly, e.g. **`founding_studio_invites`**. Keep the two concepts completely separate.

Also: the same migration created the public **interest** capture (the short form). Removing the
form means that capture path is retired — leave the historical table if data exists, but stop
writing to it and remove it from the UI.

---

## What changes, by piece

### 1. `/studios` → public information page only
`src/app/studios/page.tsx` keeps its pitch copy ("Become a Founding Studio", the three
bullets). **Remove `<StudioInterestForm />` entirely** and delete/retire
`src/app/studios/StudioInterestForm.tsx` and the `submitStudioInterest` action.

Because it's invite-only, the page ends not with a form but with a single quiet line:
> *Interested in a future Founding Studio cohort?* **Contact Relevé Connect.**

Requirements for this line:
- The words **"Contact Relevé Connect"** are a `mailto:` link and **nothing else** — a link, **not
  a form.** Do not build or re-introduce any form here.
- The link goes **only** to the confirmed-working Relevé inbox: **`mailto:info@releveconnect.com`**.
  (info@ is verified live in Google Workspace — do not point it anywhere else, no new address.)
- The current pilot stays **invite-only.** This line is only a way to note interest in a *future*
  cohort; it grants no access and starts no onboarding.

### 2. `founding_studio_invites` — the invitation (new table + migration)
One row per invited studio. Columns:
- `invite_id` (uuid, pk)
- `email` (text, not null) — the **invited studio owner's** email. The invite is bound to it.
- `token` (text, unique, not null) — the secure random token in the link. Long, unguessable.
- `employer_id` (uuid, fk → `employer_profiles`) — the ONE private studio profile this invite
  creates or connects to (see rule 6).
- `status` (text) — mirrors the profile lifecycle for admin convenience, but the profile's
  `status` (below) is the source of truth for publication.
- `expires_at` (timestamptz, nullable) — optional link expiry.
- `redeemed_at` (timestamptz, nullable), `redeemed_by` (uuid → auth.users, nullable).
- `created_by` (uuid → auth.users), `created_at` (timestamptz default now()).

On invite creation: create a **new empty `employer_profiles` row** (status `invited`) and link
it, OR connect to an existing one if Kathleen is re-inviting for a studio already in the system.
One invite ↔ one studio profile.

### 3. The status lifecycle (on `employer_profiles`)
Add a `status` column to **`employer_profiles`** with exactly these values:

| status | meaning | who sets it |
|---|---|---|
| `invited` | Invite created, profile exists but untouched | system, on invite creation |
| `in_progress` | Studio has signed in and saved at least once (draft) | system, on first save |
| `submitted` | Studio finished and submitted for review | studio, "Submit for review" button |
| `approved` | Kathleen reviewed and accepted the content | **Kathleen only** (admin) |
| `live` | Publicly visible | **Kathleen only** (admin) — the publish step |

`invited` → `in_progress` → `submitted` happen through the studio's own actions. **`approved`
and `live` are Kathleen's alone.** Approval and going live are two explicit admin steps
(approve accepts the content; publish flips it `live`) so nothing is auto-published — this is
what enforces rule 9. Default `status` for any studio profile created outside this flow: keep
non-public (never default to `live`).

### 4. The secure link + sign-in binding (rule 5)
The invitation email contains: `https://releveconnect.com/studio/setup?token=<token>`.

Flow when clicked:
1. `/studio/setup` reads the token, looks up the `founding_studio_invites` row.
2. If the visitor is **not signed in**, send them to `/login?next=/studio/setup?token=…`.
   They sign in with **Email OTP** (the existing 8-digit code flow) using the **invited email**.
3. Back at `/studio/setup`, verify the **authenticated user's email === the invite's email.**
   - Match → bind `redeemed_by`/`redeemed_at`, ensure the user's `employer_profiles` link is the
     invite's `employer_id`, and render the setup form.
   - **Mismatch → refuse.** A different email may not claim this invite. Show a clear message.
4. Invalid/expired/redeemed-by-someone-else token → a clean "this invitation isn't valid" page,
   never the form.

This is the gate. The full builder is **never** reachable without a valid invite bound to the
signed-in email. `/studio/edit` (the old public-ish route) must be closed to anyone who isn't an
already-bound studio owner — same guard.

### 5. Save and return later (rule 7)
The setup form saves a draft (`in_progress`) — reuse the existing employer_profiles save in
`src/app/studio/edit/actions.ts` / `src/lib/studio/profile.ts`. The studio can leave and come
back: signing in again with the invited email lands them back on their own profile, pre-filled,
right where they left off. Location (city + state) stays the only hard requirement to save a
draft; everything else fills over time. A separate **"Submit for review"** action flips
`in_progress` → `submitted` and notifies Kathleen.

### 6. The single setup form — fields
Everything the current `/studio/edit` `StudioEditor` already has (studio name, artistic
director, "what's it like to teach here", what makes you unique, tagline, full address,
students/staff/rooms, transit/parking/directions, year founded, "anything else"),
**PLUS** these new fields:
- **Website** (already present — keep)
- **Instagram** (handle or URL)
- **TikTok** (handle or URL)
- **Facebook** (URL)
- **Promotional video** — a single **YouTube/Vimeo** link (URL field, not a file upload)

Add columns to `employer_profiles`: `instagram`, `tiktok`, `facebook`, `promo_video_url`
(all nullable text). Wire them through `EmployerFields`, `buildEmployerProfileRow`
(`src/lib/studio/profile.ts`), and the save action so they persist and pre-fill on return.
All optional — a studio with no TikTok leaves it blank.

### 7. Public studio profile — gated on `live`
Wherever a studio profile renders publicly (the public studio page), it must query **only**
profiles with `status = 'live'`. Enforce at the data layer (RLS policy + the query), not just
the UI. `invited`/`in_progress`/`submitted`/`approved` profiles are **invisible to the public.**
When live, render the socials as icon links and the promo video as an embedded/linked player.

### 8. Admin — Kathleen's controls
Mirror the existing `/admin/applications` pattern. Kathleen needs to:
- **Create an invitation:** enter a studio's email → generates the `founding_studio_invites`
  row + token, creates the linked empty `employer_profiles` (status `invited`), and **sends the
  invitation email** via the existing Resend `sendEmail()` pipeline.
- **See every studio and its status** in one list.
- **Review a `submitted` profile** and **Approve** (`submitted` → `approved`).
- **Publish** (`approved` → `live`) — the only action that makes a studio public.
- (Nice to have: resend invite, revoke invite, un-publish back from `live`.)

### 9. Emails (via Resend, the live pipeline)
- **Invitation email** to the studio: warm, branded, the secure link. Register it in `EMAILS.md`
  and send through `src/lib/email/send.ts`.
- **Submission alert** to Kathleen when a studio hits `submitted`.
- (Optional) a **"you're live"** note to the studio when Kathleen publishes.

---

## Acceptance checks (confirm each — "confirmed, not probably")
1. `/studios` shows the pitch and **no form**; the old interest form/action are gone.
2. Visiting `/studio/setup` or `/studio/edit` **without** a valid invite bound to your signed-in
   email does **not** render the builder.
3. A valid invite link → OTP sign-in as the invited email → lands directly in setup, pre-filled
   if returning. A **different** email cannot claim the invite.
4. Save works and survives sign-out/sign-in (status `in_progress`). "Submit for review" sets
   `submitted` and emails Kathleen.
5. The setup form shows and saves **website, Instagram, TikTok, Facebook, and the YouTube/Vimeo
   video link**, and they pre-fill on return.
6. A studio is **invisible** on the public site until Kathleen moves it to `live`; approving is
   distinct from publishing; nothing auto-publishes.
7. The new `founding_studio_invites` table is separate from the existing family `studio_invites`
   — no overloading.

Report back: the migration name(s), the routes added/changed, and the commit hash.

*— one door, invite-only, nothing public until Kathleen says so · together we rise · relevé —*
