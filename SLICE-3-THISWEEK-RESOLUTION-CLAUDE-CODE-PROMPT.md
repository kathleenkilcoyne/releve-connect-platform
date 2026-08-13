# Claude Code prompt — Smart Calendar, Slice 3: Per-family resolution + This Week

> Paste everything below the line into Claude Code, working in the Relevé Connect repo.
> Brand is **always Relevé** (accented é) in any user-facing string.

---

You are working in the **Relevé Connect** codebase (Next.js App Router + Supabase, TypeScript, Vitest). This is **Slice 3** of the Smart Calendar brick: the **per-family resolution layer** that turns everything the studio schedules into each family's personalized **This Week**.

Slices 1–2 are already merged. The studio can already create groups, set age divisions, create events (`studio_classes`), and assign them (whole studio / groups / selected dancers) — those resolve into `enrollments`. **Do not rebuild any of that.** Your job is the *reading* half: what each family sees, merged and de-duped, and proven to update when the studio changes one thing once.

## How to work this — Analyze → Change → Adjust → Test (do this in order, gate on tests)

Work in **small, test-gated increments. Do NOT build it all and test at the end.** After every increment: run the tests, confirm green, adjust if anything broke, then move to the next. Report at each gate.

- **Phase A — ANALYZE (no edits).** Do Step 0 below: read the listed files + schema, then report in a short note how the current This Week path resolves a child's week today, whether it assumes a guardian→child shape anywhere, and whether `studio_wide` already exists. **Stop and wait for my confirmation before changing anything.**
- **Phase B — `studio_wide`, family-level (change → test).** Add the studio-wide lane, resolved ONCE at the family level and de-duped by session id (never per child). Add/extend unit tests. Suite green before moving on.
- **Phase C — multi-child merge + de-dupe (change → test).** Merge multiple children into one week; prove the two-child + studio-wide case shows the event exactly once and each per-child item names its child. Green.
- **Phase D — self-managed adult / per-self (change → test).** Implement the guardian-less college-team path (own enrollments + team `studio_wide`; no guardian layer; no sibling merge; studio-wide de-dupe still holds). Green.
- **Phase E — the three safeguards, end to end (test).** Prove edit, cancel, and audience-change (add AND remove) each reach only affected families. Green.
- **Phase F — full acceptance + build.** Run the full acceptance list, the whole suite, and the production build. Report pass count + a short trace of each safeguard. **Commit, do NOT push.**

Slice 3 is done only when this whole sequence works end to end. We then repeat the same Analyze→Change→Adjust→Test flow for the Swing brick.

---

## Step 0 — Orient before writing any code (mandatory)

Read these files first and tell me, in a short note, how the current This Week read path works before you change it. **Do not edit anything in this step.**

Family/This-Week read path (the code you will extend):
- `src/lib/this-week/live.ts`  ← the live data path the design notes call out
- `src/lib/this-week/queries.ts`
- `src/lib/this-week/data.ts`
- `src/lib/this-week/adapters.ts`
- `src/lib/this-week/week.ts`
- `src/lib/this-week/types.ts`
- `src/lib/this-week/recurrence.ts`
- `src/components/this-week/childweek.tsx`
- `src/components/this-week/thisweekscreen.tsx`
- `src/components/this-week/dashboardrollup.tsx`
- `src/components/this-week/weekview.tsx`
- `src/components/this-week/eventcard.tsx`
- `src/app/this-week/page.tsx`

Studio-side data you'll be reading (produced by slices 1–2 — read to understand the shape, don't change):
- `src/lib/studio/schedule.ts`, `src/lib/studio/groups.ts`, `src/lib/studio/team-enrollments.ts`, `src/lib/studio/event-types.ts`, `src/lib/studio/divisions.ts`, `src/lib/studio/schedule-data.ts`

Schema: confirm the real columns from the migrations (`supabase/migrations/*`) and/or `list_tables`. Specifically verify:
- `studio_classes` — is there a **`studio_wide` boolean** and an `event_type`/`kind` field? (Design says both exist.)
- `enrollments` (`student_id` ↔ `class_id`) — the resolved roster This Week reads.
- `class_sessions` — dated occurrences, incl. how a **canceled** occurrence and a **single moved** occurrence are represented.
- `affiliations` (`student` ↔ `employer`) — which studio a dancer belongs to; division stored here.
- If `studio_wide` does **not** exist yet, add one **additive, backward-compatible** migration following the repo's existing migration naming convention — nothing destructive.

**Design specs already in the repo — read these for intent (they are the behavioral source of truth):**
- `STUDIO-FAMILIES-THISWEEK-AUGUST-SPEC-FROM-KATHLEEN.md`
- `SMART-CALENDAR-TARGETED-SCHEDULE-FROM-KATHLEEN.md`

Where this prompt and those specs differ on *behavior*, the specs win — surface the difference and ask before diverging. (Swing is out of scope for Slice 3 — ignore any Swing docs for now.)

## The goal (Slice 3, precisely)

Extend the guardian's This Week so a **child's week = (a) their enrolled classes [already works] + (b) any `studio_wide` events at the child's affiliated studio.** A guardian with **multiple children sees ONE merged personalized week** containing all of it. Editing an event once must propagate to every affected family.

**Also in scope: the self-managed adult (college team) path.** For an adult member with **no guardian layer** (the Manhattan College team), the same resolution applies **per-self**: their week = their own enrollments + their team's `studio_wide` events. No guardian, no sibling merge — but `studio_wide` de-dupe by session id still holds. This path is in Slice 3 because the college team is the seed of the Swing roster and must live in This Week.

## Hard constraints — stay additive, keep the tested path

1. **Do not change the verified enrollment read path.** `studio_wide` is a **new lane layered on top** of the existing per-child enrollment resolution, not a rewrite of it.
2. **The `studio_wide` trap — this is the one real bug risk.** The engine resolves each child's week independently. A naïve studio-wide resolution would surface a Full Studio Event **twice** in a two-child family. **Resolve `studio_wide` ONCE at the family level and de-dupe by event/session id across the merged week.** Never attach a studio-wide item per child. Apply the same session-id de-dupe if a real roster ever enrolls two siblings in one shared item.
3. **Keep the "whose is it" label.** Per-child items (a private, a duet, a class only one child is in) stay under the correct child and name that child on the card ("Ryan — Jazz 2 Rehearsal"). Whole-family items (Full Studio Event, Parent Meeting) are labeled **for the family**, not tagged to a single child.
4. **Do not weaken RLS.** Families are read-only. A dancer is never visible outside their studio + guardianship. Admin (Kathleen) keeps her editor.
5. **Pilot boundary — out of scope, do not add:** tuition, costumes, attendance, payroll, or rec-calendar anything. This is a targeted communication calendar only.
6. **Edit-once propagates** must hold end to end, including a **single moved occurrence** (e.g. "Monday 6→6:30 this week") and a **canceled** occurrence.

## The three family-safe safeguards (must be enforced AND tested)

1. **No duplicate events** — two children assigned the same item → family sees it **once**; the `studio_wide` two-child case is the specific trap above.
2. **Every event shows whose it is** — per-child items name the child; whole-family items are labeled for the family.
3. **Audience changes reach ONLY affected families** — test all three:
   - **Edit** (time/place/teacher) → every currently-enrolled family updates; nobody else changes.
   - **Cancel** → the session shows as **canceled** to exactly the enrolled families (surface it as canceled — do not silently drop it).
   - **Change the audience** (add/remove a dancer from a duet; change a class roster) → removed family stops seeing it, added family starts, **everyone else untouched.** Test **add AND remove.**

## Acceptance criteria (mirror these as tests where practical)

- Studio-wide event → **every** family at that studio sees it in This Week.
- **De-dupe:** a two-child family with a studio-wide event sees it **exactly once**, not twice.
- **Labeling:** in that same family, each per-child item names the correct child on its card; the studio-wide item is labeled for the family.
- **Cancel:** studio cancels a session → enrolled families see it marked canceled.
- **Audience change:** remove a dancer from a duet → that family stops seeing it next load; the remaining dancer's family still sees it; unrelated families never saw it.
- **Edit-once:** studio edits a rehearsal 6→6:30 once → every affected family's This Week shows 6:30.
- A two-child family sees both children's items merged into one week.
- **Nowhere** is registration, tuition, costumes, attendance, or payroll introduced.

## Verification (required before you report done)

- Add/extend unit tests for: the studio-wide family-level merge, the **two-child studio-wide de-dupe by session id**, per-child vs whole-family labeling, and audience add/remove isolation. Co-locate with the existing `src/lib/this-week/*.test.ts` files and follow their patterns.
- Run the **full test suite** and the **production build**; both must be green. Report the pass count.
- Give me a short written trace of each of the three safeguards proven against the code path (not just "tests pass").

## Workflow / deploy discipline

- Additive migrations only; nothing destructive; match the existing migration naming.
- **Commit** with a clear message when green, but **do NOT `git push`** — Kathleen controls deploys (Vercel auto-deploys on push). Leave `main` ahead of origin and tell me the commit hash.
- Any user-facing string uses **Relevé** with the accented é.

## The two membership models (both in scope — do not assume one)

The pilot runs **two membership models on one calendar**, and Slice 3 must serve both:
- **Comp studios** — minor dancers under guardians (the guardian/multi-child case above).
- **Manhattan College team** — **adult, self-managed dancers, no guardian/minor layer.** Resolution is **per-self** (own enrollments + team `studio_wide`).

**In Step 0, report how the current read path treats a self-managed adult with no guardian** (does it assume a guardian→child shape anywhere?). Then implement the per-self path so an adult college dancer sees their own week correctly, without forcing a guardian layer that doesn't exist for them. This is a requirement of Slice 3, not a deferred option — the college team must live in This Week because it seeds the Swing roster.
