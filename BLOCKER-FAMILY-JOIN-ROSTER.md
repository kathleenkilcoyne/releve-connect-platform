# BLOCKER #1 — Family joins via code succeed, but admin "families joined" and studio roster show 0

*Prepared for Claude Code · 2026-08-08 · Production (Supabase project `hmqqxbkhcqspqmsjxodq`) · Diagnosis only — no code or data changed. Test records preserved for retest.*

## Symptom
A family completed the `/join` flow with a valid studio join code. The family app worked end-to-end (authenticated, guardian consent accepted, dancer created, landed on **This Week** correctly showing "Releve' Pilot Test Studio"). But on the admin **Manage Studio** page the studio shows **"0 families joined"** and the schedule/roster form says **"no dancers on your roster yet."**

## Repro
1. Admin invites a studio → studio completes setup → admin **Approves** (not Published).
2. Admin generates a **family join code** (`RELE-4Z4W`, `kind=family`).
3. In a separate browser, a family opens `/join`, enters the code, consents, creates dancer "test" → lands on This Week showing the studio. ✅ (family side works)
4. Admin reloads Manage Studio → **0 families / 0 dancers**. ❌

## Root cause (confirmed by DB trace)
**The write path is correct. The read path is wrong.** The family-join correctly links the dancer to the studio in the **`affiliations`** table (the source of truth the family app reads). The admin family-count and studio roster/schedule-targeting queries do **not** read `affiliations` — they read the enrollment/class/group tables (`enrollments`, `studio_class_dancers`, `studio_group_members`), which are **empty across the entire database**. So the correct link exists but the admin/roster screens never look at it.

## The 7 questions, answered with evidence
| # | Question | Answer |
|---|---|---|
| 1 | Family record saved? | **Yes** — `family_accounts.family_id = b650402a-f6a9-4d00-b5ff-2dc0800f216c` (owner_user_id `4d420d9f-9428-4f60-9096-b5a0a4327453`, `subscription_status=trialing`, created 15:07:04). |
| 2 | Dancer/child record saved? | **Yes** — `students.student_id = aeca1e93-42c7-410f-b369-1879c44b62c6`, `display_name='test'`, `family_id=b650402a…`. Consent saved: 1 row in `guardianships` for this student. |
| 3 | What studio ID is the dancer linked to? | **`696d53cc-604b-42a2-a5c0-e4d81442e206`**, via `affiliations.affiliation_id = 8750e2bb-b6bf-4fa2-b84f-c6d38b5e1620` (`subject_kind=student`, `subject_id=aeca1e93…`, `role=student`, `status=active`). |
| 4 | Same ID as Releve' Pilot Test Studio? | **Yes — exact match.** `employer_profiles.employer_id = 696d53cc…` = the affiliation's `employer_id`. The join code `RELE-4Z4W` (`studio_invites.employer_id`) also points to the same studio, and its `use_count` incremented to 1. |
| 5 | Why does the admin family count return 0? | The count query is **not** sourced from `affiliations`. It reads a link source that the join flow does not populate (`enrollments` / `studio_class_dancers` / `studio_group_members`), all of which are empty. |
| 6 | Why does the roster/calendar targeting query return 0 dancers? | Same cause — the roster/"assign to schedule" read also pulls dancers from the empty enrollment/class/group tables instead of `affiliations`. |
| 7 | Join write, link table, or read query? | **The read query.** The join write is complete and the link row in `affiliations` is correct and active. The admin/roster **reads** target the wrong table(s). |

## Supporting facts
- `enrollments` total rows: **0** · `studio_class_dancers`: **0** · `studio_group_members`: **0** (whole DB).
- `studio_classes` for this studio: **0** · `studio_groups` for this studio: **0** (studio has no schedule yet).
- Canonical read from the source of truth returns the right numbers:
  ```sql
  SELECT count(DISTINCT s.family_id) AS families, count(*) AS dancers
  FROM affiliations a
  JOIN students s ON s.student_id = a.subject_id
  WHERE a.subject_kind='student' AND a.status='active'
    AND a.employer_id = '696d53cc-604b-42a2-a5c0-e4d81442e206';
  -- → families = 1, dancers = 1  (dancer "test")
  ```

## Safest fix (recommended)
**Align the admin/roster reads to `affiliations` — the same source the family app already uses.** This is a read-only query change: it does not alter the write path, creates no migration, and touches no existing data. The preserved test records will immediately appear once the reads are corrected.

- **Studio roster / schedule-targeting dancer list:**
  ```sql
  SELECT s.student_id, s.display_name, s.age_range, s.family_id
  FROM affiliations a
  JOIN students s ON s.student_id = a.subject_id
  WHERE a.subject_kind = 'student'
    AND a.status = 'active'
    AND a.employer_id = $studioId
  ORDER BY s.display_name;
  ```
- **Admin "families joined" count:** `count(DISTINCT s.family_id)` over the same join.
- Confirm the family **This Week** view also reads `affiliations` (it works, so it almost certainly does) so there is **one source of truth** for "dancer belongs to studio."

### Why not "fix the write instead"
An alternative theory is that the join *should* also create an enrollment or a default studio-wide class/group membership, and the admin read is "correct." Rejected because: (a) `affiliations` is already the working link the family app reads; (b) **no** studio anywhere has any class/group/enrollment rows, so those tables aren't the live mechanism; (c) changing the write to auto-create classes/groups adds new write behavior + migration risk. Correcting the read is lower-risk and immediately consistent with the family side.

*If enrollments/classes are a planned future feature, the roster read can later be a UNION of `affiliations` (studio-wide members) + class-based enrollment — but the immediate, safe fix is to read `affiliations`.*

## Preserve for retest (do NOT delete)
- Studio `employer_profiles` `696d53cc-604b-42a2-a5c0-e4d81442e206`
- Join code `studio_invites` `RELE-4Z4W` (`9641bae8-d3a2-4155-b710-d6ea90d2cc39`)
- Family `family_accounts` `b650402a-f6a9-4d00-b5ff-2dc0800f216c`
- Dancer `students` `aeca1e93-42c7-410f-b369-1879c44b62c6` (+ its `guardianships` row)
- Affiliation `affiliations` `8750e2bb-b6bf-4fa2-b84f-c6d38b5e1620`

**Retest after fix:** reload admin Manage Studio for the studio above → expect **1 family / 1 dancer ("test")** and the dancer selectable in the schedule/roster targeting — with no new data created.

---

## Also log while here (separate items, not this blocker)
- **Studio approval/welcome email — real gap to build.** No email is sent to a studio at Approve (confirmed: only invitation + sign-in-code emails ever reach the studio). Add an automated "approved / you're live" email before wider rollout. Not blocking (owner emails personally during the hand-onboarding pilot).
- **"Founding rate" copy** on `/studios/join` → update to reflect **free through Dec 31, 2026** (note for later, not a bug).
- **Not bugs (Claude testing artifacts, ignore):** (a) the invitation setup link looked "invalid" only because the token's leading `19` was lost when the link was pulled via the email API — the real emailed link works; (b) "Generate family join code" appeared to no-op only because an automated click didn't fire — it works when clicked manually (produced `RELE-4Z4W`).
