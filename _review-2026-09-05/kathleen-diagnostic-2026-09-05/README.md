# Manhattan Dance Team pilot — diagnostic findings (2026-09-05)

Independent verification + fixes, built and tested against **origin/main**
(commit `1617b97`), per your instructions. Nothing here is committed, pushed,
deployed, or emailed. Nothing was applied to Supabase.

## 0. IMPORTANT — a branch problem, found independently twice

`profile/profile-ux-walkthrough` (the branch checked out in your working
directory when this review started) is **25 commits behind origin/main** and
**20 commits ahead** — it split off before the dance-team org-aware wording
work (commits `2baa17d`, `6c02a12`, `d314bd7`, `3c9c224`, `7dba6f8`, `1617b97`)
and never got it back. It's missing `src/lib/studio/org-copy.ts` entirely, and
`sendStudioLive` on that branch is still the pre-org-aware `studio-live.v1`.

Both of the two background agents I delegated parts of this to built their
first drafts against that stale branch and independently rediscovered this
same divergence. I did not trust either draft as-is. Everything in this
folder was instead re-verified and (for the wording/email fix) re-implemented
directly on a disposable worktree checked out at **origin/main**, so it's
safe to apply there. **Before anyone builds on this branch again, it needs a
rebase or merge from main** — that's a decision for you, not something I did.

## What's in this folder

- `01-verified-fixes-vs-origin-main.diff` — the full, tested diff, against
  `origin/main` (1617b97). Apply with `git apply` at the repo root on a branch
  based on main.
- `new-files/` — two new test files the diff doesn't capture (untracked):
  `src/app/this-week/page.test.ts`, `src/lib/studio/event-types.test.ts`.

Verified: `npx vitest run` → **39 files, 461 passed, 2 skipped, 0 failed**.
`npx tsc --noEmit` → clean. Both run on the full repo at `origin/main` + this diff.

## 1. Is commit 1617b97 (studio-live.v2 + admin resend) deployed?

**On main: yes.** `origin/main`'s HEAD *is* `1617b97` — it's not just merged,
it's the tip. I could not independently confirm the Vercel production alias
is serving that exact build (no Vercel CLI/API token available in this
session — `.vercel/project.json` shows project `releve-connect-platform`, org
`team_LUSoqA4J9yQMLFJQ4zcamnVA`). `releveconnect.com` responds 200 via Vercel
(`X-Vercel-Cache`, `Server: Vercel` headers present), but nothing in the
response identifies a commit SHA. Recommend a 10-second manual check: Vercel
dashboard → releve-connect-platform → Deployments → confirm the Production
alias's commit is `1617b97` (or later).

## 2. "This Week" fabricated demo data for signed-in org owners — FIXED

**Root cause** (`src/app/this-week/page.tsx`, was lines 82–87): the fallback
`if (payload.isEmpty && !payload.professional && !payload.family)` couldn't
tell "a genuinely new member, nothing to show" apart from "a studio owner or
Team Director who simply hasn't built out their calendar yet" — both fell
into the fabricated Kathleen/Ava sample week from `src/lib/this-week/data.ts`.

**Fix:** added `resolveOrgHome()` (uses the existing, already-correct
`resolveStudioForUser`) on that one empty-payload branch only. A signed-in
org owner/admin now gets a real "Nothing scheduled yet" state pointing at
`/studio/schedule`, org-aware ("team" vs "studio"). The signed-out marketing
demo is completely untouched (`!user` still returns early, before any of
this runs). New test: `src/app/this-week/page.test.ts`, 6 cases.

**Team-wide event visibility via affiliations — verified working, no bug.**
Both the guardian-family lane and the self-managed-adult (team) lane resolve
studio-wide events through `affiliations` + dedicated RLS functions
(`family_sees_studio_wide`, `self_sees_studio_wide`), independent of the
app-layer query. This is a different code path from the org-owner bug above
and does not need redesign, confirming your brief.

## 3. Dance-team schedule/dashboard wording — FIXED (the parts you named)

Fixed, all org-aware via a new `isTeam`/`memberLabel` prop threaded through
`ScheduleEditor.tsx` (shared by the admin review page and the coach's own
`/studio/schedule`) and two small `event-types.ts` overrides:

- **"Full Studio Event" → "Full Team Event"** (menu label + default event
  title), for `org_type = dance_team`.
- **"Everyone at your studio sees this" → "Everyone on your team sees this"**
  (both the type-picker hint and the studio-wide confirmation block).
- The "Got it" readout's acknowledger noun ("family"/"families") now reads
  as the team's own member label (e.g. "dancer"/"dancers") for a team.
- "What families will see (title)", "Just these families", "share your
  family join code first", the delete-confirmation dialog, and "Whole
  studio" → "Whole team" all now branch the same way.
- Two smaller, independently-found leaks fixed: `src/lib/this-week/live.ts`
  and `src/components/this-week/FamilyWeekView.tsx` both fell back to the
  literal string "your studio" for a self-managed team member when no org
  name had resolved yet (edge case, but real) — now "your team" when
  `selfManaged`.

New test: `src/lib/studio/event-types.test.ts`. I deliberately did **not**
rename "Parent Meeting" or touch every other event type's wording — you
didn't ask for that, and guessing at it would be inventing product
behavior your CLAUDE.md tells me to stop and ask about instead. Flag if you
want a broader pass.

## 4. Dance Team welcome/live email — FIXED

`sendStudioLive` (`src/lib/notifications.ts`, `studio-live.v2`, EMAILS.md #14)
already existed and was already org-aware (that's what 1617b97 shipped) — but
its Dance Team "next steps" were an unordered 3-line list ("Invite your
dancers" / "Build This Week" / "Open your team dashboard" — dashboard
*last*, even though it's where the other two actually happen), and never
named the Team Join Code tool.

Rewrote it as the exact 4-step sequence you asked for:
1. Open your team dashboard
2. Generate your Team Join Code
3. Share the code or link with your dancers
4. Build This Week

Studio-side copy is untouched (no self-serve invite tool exists there today,
per the existing code comment — flagged in the code, not assumed). Updated
the existing test (`src/lib/notifications.test.ts`) to assert the four steps
appear in order.

## 5. "Got it" acknowledgment bug — INVESTIGATED, migration proposed, NOT applied

A coworker's diagnostic proposal already exists at
`_review-2026-09-05/ack-proposal/` (`PROPOSAL.md`, `ROLLBACK.md`, the app-code
diff, and one migration file). I independently re-verified every factual claim
in it — against the live Supabase project (`hmqqxbkhcqspqmsjxodq`), not just
the source tree:

- **Confirmed against the live database**, not just migration files on disk:
  `is_self_student`, `self_calendar_for_class`, `self_sees_studio_wide`,
  `family_sees_studio_wide`, `is_guardian_of`, `guardian_calendar_for_class`
  all exist and are byte-identical to their migration source. The live
  `event_ack_insert`/`event_ack_select`/`event_ack_delete_own` policies and
  the three indexes match exactly what the proposal describes — no drift.
- **Two of the proposal's own file-path citations are wrong** (it cites
  `20260808140000_event_acknowledgements.sql` and
  `20260801010000_self_managed_member_read.sql` — neither exists; the real,
  applied files are `20260808171854_event_acknowledgements.sql` and
  `20260731125427_self_managed_member_read.sql`). The *content* it quotes
  from them is correct; only the filenames are wrong. Minor, but worth
  knowing before anyone goes looking for those files.
- **Independently re-ran its test claims** in an isolated git worktree at
  origin/main (not trusting its own reported numbers): baseline 24 tests
  pass; with its diffs applied, 466 pass (37 files) and `tsc --noEmit` is
  clean; reverting just the app-code fix (keeping its new tests) produces
  exactly 11 failures — the tests genuinely detect the bug, not rubber-stamped.
- **Production data check:** `public.students` currently has **1 row total**,
  and it is not `transferred_to_user_id`-set (i.e., not a team member) — so
  this bug has **zero real users affected today**. Manhattan's roster is
  empty because its Team Join Code hasn't been generated yet, consistent
  with your instruction not to generate it yet. This is a pre-emptive fix,
  not a live incident.
- The migration itself is a single additive `drop policy + create policy` on
  `event_ack_insert`, reproduces the two existing (guardian) disjuncts
  verbatim, and adds one new disjunct keyed to `is_self_student(...)` — the
  same predicate the existing, already-deployed self-read policies use. No
  table, column, index, or function change. Blast radius: the ack lane only.

**I did not apply the migration** (per your instruction) — it's sitting at
`_review-2026-09-05/ack-proposal/migration/20260905120000_self_managed_member_ack.sql`,
with rollback at `_review-2026-09-05/ack-proposal/ROLLBACK.md`, ready for your
review. Recommend applying it via `apply_migration` once you're ready — it's
low-risk and additive, and I'd suggest doing it *before* generating
Manhattan's join code so the first real team member's "Got it" tap works the
first time.

## Not done (as instructed)

- No migration applied.
- No join code generated for Manhattan.
- No email sent to Madeline or anyone else.
- Nothing deployed; nothing committed; nothing pushed.
- The stale-branch/main divergence itself was not fixed (that's a branch
  decision for you — rebase, merge, or abandon the stale branch).
