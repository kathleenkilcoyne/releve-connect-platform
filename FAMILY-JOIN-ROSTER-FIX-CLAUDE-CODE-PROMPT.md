# Prompt for Claude Code — Fix: family joins not showing in admin count / studio roster

You are working in the **Relevé Connect platform** repo (Next.js + Supabase). A production QA pass found a confirmed, high-priority blocker. A full diagnosis with record-level evidence is in **`BLOCKER-FAMILY-JOIN-ROSTER.md`** at the repo root — **read it first.**

## The bug
When a family joins a studio via a **family join code**, everything is saved correctly (family, dancer, guardian consent, **and** an `affiliations` row linking dancer → studio), and the family's **"This Week"** view correctly shows the studio. But the **admin "Manage Studio"** page shows **"0 families joined"** and the studio **roster / schedule-targeting** shows **"no dancers on your roster yet."**

## Root cause (confirmed by DB trace — in the diagnosis file)
The family-join **write is correct.** The dancer→studio link lives in **`affiliations`** (`subject_kind='student'`, `role='student'`, `status='active'`, `employer_id=<studio>`) — the source of truth the family app already reads. The **admin family-count and studio roster/schedule-targeting reads query the wrong tables** (`enrollments` / `studio_class_dancers` / `studio_group_members`), which are **empty across the entire database**, so they return 0.

## Task — safest fix, READ-SIDE ONLY
Repoint the admin **"families joined"** count and the studio **roster / schedule-targeting** dancer list to read affiliated students from **`affiliations`**, so there is **one source of truth** shared with the family "This Week" view.

Canonical reads to match:
```sql
-- Roster / schedule-targeting dancer list for a studio
SELECT s.student_id, s.display_name, s.age_range, s.family_id
FROM affiliations a
JOIN students s ON s.student_id = a.subject_id
WHERE a.subject_kind = 'student'
  AND a.status = 'active'
  AND a.employer_id = $studioId
ORDER BY s.display_name;

-- "Families joined" count
SELECT count(DISTINCT s.family_id)
FROM affiliations a
JOIN students s ON s.student_id = a.subject_id
WHERE a.subject_kind = 'student'
  AND a.status = 'active'
  AND a.employer_id = $studioId;
```
Locate the current queries (search the admin studio-management route/page and the roster/schedule-targeting data layer — they likely reference `enrollments`, `studio_class_dancers`, or `studio_group_members`) and repoint them to `affiliations`. Confirm the family "This Week" view already reads `affiliations`; if so, extract/reuse a shared query helper so the three reads can't drift again.

## Constraints
- **Do NOT modify the family-join write path** — it is correct.
- **Do NOT delete or mutate existing data.** Preserve these test records (needed for retest):
  - `employer_profiles` `696d53cc-604b-42a2-a5c0-e4d81442e206`
  - `studio_invites` `RELE-4Z4W` (`9641bae8-d3a2-4155-b710-d6ea90d2cc39`)
  - `family_accounts` `b650402a-f6a9-4d00-b5ff-2dc0800f216c`
  - `students` `aeca1e93-42c7-410f-b369-1879c44b62c6` (+ its `guardianships` row)
  - `affiliations` `8750e2bb-b6bf-4fa2-b84f-c6d38b5e1620`
- **No schema migration should be needed.** If you believe one is, stop and explain before changing anything.
- Add or adjust a **test** asserting that a student affiliated to a studio (`affiliations`, active) appears in both the admin family/dancer count and the roster targeting list.

## Acceptance criteria
- With the preserved records untouched, the admin **Manage Studio** page for `employer_profiles 696d53cc…` shows **1 family joined** and **1 dancer ("test")**, and "test" is selectable in the schedule/roster targeting.
- The family **"This Week"** view is unchanged.
- Admin count, roster targeting, and family This Week all resolve dancer↔studio from the **same source** (`affiliations`).

## Out of scope — log as follow-ups, do NOT fix here
- Studio **approval/welcome email** does not send on Approve — build an automated "approved / you're live" studio email later.
- `/studios/join` **"founding rate"** copy → should read **free through December 31, 2026**.

When finished, summarize: files changed, the exact query change, the test added, and the **manual retest steps** (reload Manage Studio for the studio above and confirm 1 family / 1 dancer with no new data created).
