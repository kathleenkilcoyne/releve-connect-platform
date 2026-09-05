# Manhattan Dance Team pilot — isolated branch + "Got it" fix test results (2026-09-05)

Nothing here touched production, main, or `profile/profile-ux-walkthrough`. No
migration was applied to production. No email sent. No join code generated.

## 1. Isolated implementation branch

- Branch: `pilot/manhattan-dance-team-fixes-2026-09-05`
- Base: `origin/main` @ `1617b97` (fetched fresh, confirmed current)
- Worktree: `C:\Users\kathl\releve-platform-manhattan-pilot` (separate directory,
  separate checkout — `profile/profile-ux-walkthrough` and its working tree were
  never touched)
- Local commit only, **not pushed**: `2681702`

```
2681702 Manhattan Dance Team pilot: This Week empty state, org-aware wording, welcome email sequence
1617b97 studio-live.v2 email + admin-only resend for already-live orgs (#11)   <- origin/main, unchanged
```

Contains exactly the three independently-verified fixes from the earlier
diagnostic (`01-verified-fixes-vs-origin-main.diff` in this folder), applied
cleanly to a fresh `origin/main` checkout:

1. **This Week empty state** — a signed-in org owner/admin with nothing scheduled
   gets a real "Nothing scheduled yet" state, never the fabricated demo week.
2. **Dance Team org-aware wording** — "Full Studio Event" → "Full Team Event",
   "Everyone at your studio sees this" → "Everyone on your team sees this", the
   "Got it" readout noun, and the other schedule-editor strings named in the brief.
3. **Welcome-email sequence** — the Dance Team `studio-live.v2` next steps are now
   the explicit 4-step order: open dashboard → generate Team Join Code → share
   it → build This Week.

**Verified on this branch, this checkout, just now:**
`npx vitest run` → 39 files, 461 passed, 2 skipped, 0 failed.
`npx tsc --noEmit` → clean.

The "Got it" acknowledgment fix (below) is **not** included in this commit —
its app-code diff is staged for your review but not applied anywhere, since the
production RLS migration it depends on hasn't been applied to production yet
(committing the app code without it would silently break the feature if this
branch were ever merged before the migration ships).

## 2. "Got it" fix — tested in an isolated Supabase project, never production

Supabase branching isn't available on this project's plan (`PaymentRequiredException:
Branching is supported only on the Pro plan or above`), so I created a
**separate, standalone Supabase project** instead — full isolation, $0/month,
no shared infrastructure with production:

- Dev project: `manhattan-ack-fix-devtest-2026-09-05` (ref `neywixbhrogcndsfahsc`),
  org `sonsteykhjmargdtmdxm` — the same org as production, but a completely
  separate database/project.
- Production project (`hmqqxbkhcqspqmsjxodq`) was **never written to** — every
  migration and test query below ran only against the dev project.
- Built by replaying the base schema (`supabase/setup.sql`) + all 41 migration
  files from `origin/main`'s `supabase/migrations/`, in order, plus one
  gap-fill (see §3), so the dev project's schema matches production.
- **Now paused** (no `delete_project` tool is available to me; pausing stops it
  running and billing. If you want it gone entirely, that's Settings → General
  → Delete Project in the Supabase dashboard for `neywixbhrogcndsfahsc`).

### What was proven, step by step

| # | Check | Method | Result |
|---|---|---|---|
| 1 | A self-managed adult joins a team | Created an `affiliations` row (`subject_kind='student'`, `status='active'`) + a `students` row with `family_id=null`, `transferred_to_user_id=<their account>` — exactly what `/team-join` writes | ✅ |
| 2 | They see a team-wide event | Queried `studio_classes`/`class_sessions` as that user (`set local role authenticated; set local request.jwt.claim.sub = '<uuid>'`) | ✅ both return the row |
| 3 | "Got it" tap, **before** the fix | Attempted the exact insert shape the fix would write | ❌ refused — `42501: new row violates row-level security policy` — **the bug, reproduced exactly as diagnosed** |
| 4 | Denominator, before the fix | Counted families (0) vs. uncounted self-managed members (2) for the team | Confirms "0 of 0" / "no recipients yet" for a real 2-dancer team |
| 5 | Applied the proposed migration | `20260905120000_self_managed_member_ack.sql`, verbatim, to the dev project only | ✅ applied clean |
| 6 | "Got it" tap, **after** the fix | Same insert, same user | ✅ succeeds, row recorded (`student_id=<own>`, `family_id=null`) |
| 7 | Acknowledger reads their own ack back | Selected as that user | ✅ visible |
| 8 | Repeat tap is idempotent | Same insert again | `23505` duplicate key — exactly what the app's `isDuplicate()` treats as success, not a second row |
| 9 | An unrelated team member can't see or forge it | Selected / inserted as Dancer Two, targeting Dancer One's `student_id` | ✅ sees 0 rows; insert refused (`42501`) |
| 10 | An outsider (not on the team) is fully blocked | Selected the session as an unaffiliated user | ✅ 0 rows |
| 11 | Coach's numerator/denominator, after the fix | `total_families (0) + total_self_managed (2)`, `acked_self_managed (1)` | **"1 of 2 acknowledged"** — correct, real membership count |
| 12 | **Regression: studio/family lane unchanged** | Built a parallel studio + guardian + child fixture; guardian acknowledges a Full Studio Event the old way (`student_id=null, family_id=set`) | ✅ succeeds; readout is **"1 of 1 families acknowledged"**, `total_self_managed=0` — byte-identical to pre-fix behavior for a pure studio |
| 13 | Guardian can't exploit the new disjunct | Guardian attempts `student_id=<own child>, family_id=null` (the self-managed shape) | ✅ refused — `is_self_student` requires `transferred_to_user_id = auth.uid()`, which the guardian doesn't have |
| 14 | Targeted (non-studio-wide) self-managed ack | Enrolled a self-managed member in a targeted rehearsal, acknowledged it | ✅ succeeds, same shape |

All 14 checks passed exactly as the proposal predicted. `get_advisors` (security)
on the dev project after all of this showed only the same `rls_enabled_no_policy`
INFO-level findings that already exist by design in production (e.g.
`founding_professional_grants`, `partner_interest` — deliberately admin/service-role
-only tables) — nothing new introduced by the fix.

### Rollback

Unchanged from the proposal, re-verified applicable: `_review-2026-09-05/ack-proposal/ROLLBACK.md`.
One statement — restores the `event_ack_insert` policy to its exact pre-fix
text (byte-identical to what's live in production today). No table, column,
index, or function is touched by either the fix or its rollback.

## 3. A gap found while rebuilding the schema (worth fixing separately)

`origin/main`'s `supabase/migrations/` folder is **missing a file** that exists
both in production and in your `profile/profile-ux-walkthrough` branch:
`studio_classes.kind` (the `studio_class_kind` enum + column) is never created
anywhere in `origin/main`'s migration history — only extended
(`20260730000000_studio_class_kind_comp_college.sql` adds four enum values to a
type that, on `origin/main`, was never created). I confirmed the column and
enum both exist live in production (`studio_class_kind`: class, rehearsal,
performance, competition, audition, workshop, deadline) and that the stale
branch has a reconstructed file documenting it
(`20260720122804_studio_classes_kind.sql`, itself marked "reconstructed from
live production state, 2026-08-17 — this file did not exist in Git").

This means **`origin/main`'s migration folder cannot, by itself, rebuild
production's schema from scratch** — it's missing this one file. I pulled the
stale branch's reconstructed version in to unblock my own schema rebuild (dev
project only); `origin/main` itself is untouched. This is a separate, smaller
gap from the migration-filename-timestamp mismatches noted in the earlier
report — this one is an actually-missing file, not just a rename. Worth
copying that reconstructed file into `origin/main`'s migrations folder at some
point so main can stand alone again — flagging, not fixing, since you didn't
ask for that in this task.

## Not done (as instructed)

- Nothing applied to production (`hmqqxbkhcqspqmsjxodq`) — every migration and
  test query ran only against the disposable dev project.
- No merge, no push, no PR, no deploy.
- No email sent to Madeline; no join code generated for Manhattan.
- The ack fix's app-code diff (8 source + 3 test files) is **not** committed
  anywhere — it's the same diff already staged at
  `_review-2026-09-05/ack-proposal/01-app-code.diff`, now with full DB-level
  proof behind it, ready for your review and for a future commit once you're
  ready to pair it with the migration.
