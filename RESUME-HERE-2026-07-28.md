# Resume Here — 2026-07-28

*Start tomorrow from this file. Supersedes RESUME-HERE-2026-07-27.md (kept as history).*

---

## 🔴 THE one open decision: push the studio-onboarding commit

Everything below is **built, tested, and verified** — the only thing left is to **deploy it**.

- **Commit `ce7d366`** ("Studios: one invite-only onboarding flow") is **committed but NOT pushed.**
  `git status` = `main...origin/main [ahead 1]`.
- **To go live:** `git push origin main` (Vercel auto-deploys).
- ⚠️ **The database migration is ALREADY live on production Supabase** (applied 2026-07-28).
  It's additive + backward-compatible, so the *currently deployed* (old) app is unaffected —
  but the new code isn't public until you push. No rush, no breakage either way.

**When ready:**
```bash
git push origin main
```
Then hard-refresh and (optionally) walk the studio flow live.

---

## ✅ Done & verified this session (2026-07-27 → 28)

### Studio onboarding — ONE invite-only flow (commit `ce7d366`, NOT pushed)
Governing spec: **`STUDIO-ONBOARDING-ONE-FLOW-FROM-KATHLEEN.md`** (now in the repo).

- **Migration `20260728000000_founding_studio_onboarding.sql`** (applied live):
  new **`founding_studio_invites`** table (separate from the family `studio_invites`);
  `employer_profiles.status` lifecycle **invited → in_progress → submitted → approved → live**;
  social fields **instagram/tiktok/facebook/promo_video_url**; `owner_user_id` nullable;
  **public read RLS only when `status='live'`**.
- **Routes:** `/studios` is now pitch-only (form removed) + `mailto:info@releveconnect.com`;
  **`/studio/setup`** = the one invite-gated builder (token → OTP as the invited email → bind →
  pre-filled form + "Submit for review"); **`/studio/edit`** redirects into it;
  **`/admin/studios`** (invite / approve / publish / unpublish / resend);
  `POST /api/admin/studio-invites`; `PATCH /api/admin/studios/[id]`.
- **Retired:** `StudioInterestForm.tsx`, `submitStudioInterest`; EMAILS.md #11 (interest) →
  new #12 invitation, #13 submitted alert, #14 live.
- **Verified so far (before the pause):** 134/134 tests + prod build green; the invite GATE
  (unauthenticated can't reach the builder; valid token is preserved through `/login?next=`;
  invalid token → clean notice, never the form; `/studio/edit` → `/studio/setup`); public RLS
  (anon sees ONLY `status='live'`; `founding_studio_invites` fully sealed); the status
  check-constraint rejects out-of-lifecycle values; and a simulated save persisted all four
  social fields and stayed anon-invisible at `in_progress`.
- **Not yet run:** a full OTP click-through as the invited email (bind → save → submit →
  approve → publish in the browser). The code path is build- + unit-verified and the binding
  upserts the `users` row *before* setting `owner_user_id` (FK → `public.users`), but the live
  human sign-in walk is the remaining confirmation.
- **Test data still in the DB (needs cleanup):** `ZZ Test Live Studio` (employer_profiles,
  status=live), an invited `ZZ Test Studio`, and its `founding_studio_invites` row. NOT real
  data; remove before/after deploy. `studio_interest` and all real data are untouched.

### Already live on releveconnect.com (pushed earlier this session)
- **Mission statement** — Kathleen's verbatim north star leads the `#mission` section
  (commit `99ed26c`). Verified live.
- **`#mission` anchor** — reliably lands on the section on direct load / "Meet Relevé" click
  (re-assert loop; commit `3d2e4f2`). Verified live in a fresh session.
- **Brand logo + favicon set** wired into nav, hero, footer, and the browser tab
  (commit `95c5205`). Verified live; all assets 200.
- **Homepage copy** — roster line tightened; duplicate ecosystem strip made `sr-only`
  (commit `60d98a2`). Verified live.
- **Profile owner-only bar** — "This Week" + "Edit Profile", server-gated (commit `9305263`).
- **Email/auth migration COMPLETE** — Custom SMTP (Resend), 8-digit code templates, delivery
  proven at Gmail + Hotmail + iCloud (commit `5071d86`).

---

## 🧭 Git state (as of this file)

- `main` is **ahead 1** of `origin/main` → the unpushed studio commit `ce7d366`.
- **Uncommitted:** `AUTH-MIGRATION-CHECKLIST-FROM-KATHLEEN.md` (the Reset-password dormancy note).
- **Untracked docs** (intentionally not committed): `APPLY-AND-STUDIO-FIXES…`,
  `AUTH-ONBOARDING-3-ECOSYSTEMS…`, `DNS-BACKUP-2026-07-26.md`, `NAMECHEAP-MX-TO-GOOGLE…`,
  `Releve_Connect_Business_Model_Strategy.md`, `docs/The_Financial_Floor…`.

---

## Possible next threads (not started)
- A **public studio page** — the RLS already gates public reads on `status='live'`, but no
  public studio profile route exists yet. When built, it renders socials as icon links + the
  promo video, and queries only `live` studios.
- The **Reset password** Supabase template is still a link (dormant — no recovery flow exists);
  documented in `AUTH-MIGRATION-CHECKLIST`. Leave until a real recovery flow is built.

*— together we rise · relevé —*
