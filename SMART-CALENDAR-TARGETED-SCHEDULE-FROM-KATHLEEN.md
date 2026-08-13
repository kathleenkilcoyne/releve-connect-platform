# The Smart Calendar — assign once, delivered to every relevant family
### Kathleen's design, 2026-07-30. This is the studio self-serve scheduling brick — and the feature that makes Relevé essential. Brand always **Relevé** (é).

---

## The principle (Kathleen's words)
The studio enters each event **once** and assigns it to a target. Relevé automatically delivers it
to every relevant family's personal **This Week**. When the studio changes it, they change it
**once**, and every affected family sees the change, receives it, and can tap **"Got it."** Each
family's calendar is **assembled automatically** from everything assigned to their child(ren).

## One master calendar; each event assigns to exactly one target:
- **The entire studio**
- **A company / team**
- **One or more classes**
- **Selected dancers** (duet / trio)
- **One individual dancer** (private)

## Examples (Kathleen's)
- **Jazz 2 Rehearsal, Monday 6–7** → all 19 Jazz 2 families see it in their own week. Ballet 1 does **not**.
- **Sophie — Solo Private, Thursday 4–5** → only Sophie's family.
- **Duet / trio** → the director picks the 2–3 dancers → only those families receive it.
- A family with **two children** sees one merged personal week, e.g.:
  *Mon 6–8 — Ryan: Jazz 2 Rehearsal · Wed 4:30 — Sophie: Solo Private · Fri 5–8 — Company Rehearsal.*

## The studio's create flow — "What are you scheduling?" (type-driven — Kathleen's adjustment)
Even though a weekly class, a company rehearsal, a trio, and a private share the SAME underlying
structure, the studio must **not** experience them all as "classes." The create flow opens with
**"What are you scheduling?"** and a friendly type menu. The type sets the label families see AND
drives the target-picker automatically — the studio never thinks about "assignment targets" in the
abstract; it just picks what it's scheduling.

| Type the studio picks | It then asks for… | Who sees it | Stored as |
|---|---|---|---|
| **Class** | which class (pick / create a group) | that class's dancers | `studio_class` + `enrollments` |
| **Company / Team Rehearsal** | which team | the team's dancers | `studio_class` + `enrollments` |
| **Duet / Trio Rehearsal** | pick 2–3 dancers | those families | `studio_class` + `enrollments` |
| **Solo Private** | pick 1 dancer | that family | `studio_class` + `enrollments` |
| **Full Studio Event** | *(nothing — auto whole studio)* | every family | `studio_class` + `studio_wide` |
| **Parent Meeting** | whole studio, or a group | those families | `studio_class` + `studio_wide`/`enrollments` |
| *(Competition / Audition / Performance — see note)* | a team/class, or selected dancers | those families | `studio_class` + `enrollments` |

**Example (Kathleen's):** Create schedule item → **Type: Duet/Trio Rehearsal** → Select dancers:
*Sophie, Emma, Ava* → *Saturday 11–12* → **Save.** Only those three families receive it, labeled
"Trio Rehearsal."

**Storage never changes:** a single `event_type` field on `studio_classes` drives the UI and the
family-facing label; targeting is still `enrollments` (+ `studio_wide` for whole-studio). The
dancer-selection for Duet/Trio/Private is the *same* multi-select — just pre-sized and re-labeled by
the type. Build steps 3–4 below are the *plumbing*; this menu is how the studio *experiences* it.

> **Comp event types:** because the pilot is comp-focused, also include **Competition, Audition, and
> Performance** in the menu (confirmed IN) — they target a team/class or selected dancers exactly the
> same way.

---

## Studio roster & REUSABLE groups (Kathleen, 2026-07-30 — added before onboarding Tate & DreamMakers)
**The problem this fixes:** as built, every event picks *individual dancers*. "Class" and
"Company / Team Rehearsal" are labels, but under the hood the studio still hand-selects each dancer.
So scheduling Teen Company's rehearsal, then its extra rehearsal, then its competition, then a parent
meeting = re-checking the same 12 kids four times. That breaks our own "enter once" promise and is the
fastest way to make a founding studio quietly stop using it. Comp teams are STABLE units scheduled
over and over — they must be a saved thing, not re-picked every event.

**The section becomes "Studio roster"**, with two areas:
- **Groups & classes** — the studio creates/manages reusable groups (Jazz 3, Teen Company, Senior
  Contemporary, Production, Competition Team). Each group holds members; **a dancer can belong to
  several groups at once** (Ava may be in Jazz 3 *and* Teen Company *and* a trio). Show each group's
  member count. Include a **Create group** action.
- **Individual dancers** — the flat list of everyone connected via the family code, beneath the groups.

**"Who should receive this?" on an event now offers:** **entire studio · one or more groups/classes ·
selected dancers · one dancer.** Selecting **Jazz 3** delivers to every family of Jazz 3's *current*
members — no per-dancer clicking.

**How it maps to the engine (stay additive; keep the tested read path):**
- A **group** is a persistent roster: a group entity (name, employer) + its members.
- An **event remembers the GROUPS it targets** (not just the resolved dancers), plus any individually
  added dancers, plus the `studio_wide` flag.
- **`enrollments` stays the resolved roster** that This Week reads (the path we already verified) —
  it is *derived*: `enrollments(event) = distinct(members of each targeted group ∪ individually-added
  dancers)`. Recompute it whenever the event's targets change **or a targeted group's membership
  changes**. That is what makes "edit the group once → every event using it updates."
- **Multi-group / sibling de-dupe still applies:** a dancer in two targeted groups, or two siblings in
  one group, must resolve to **one** enrollment / one family-week item. `distinct` on resolve; de-dupe
  the merged family week by session id (see the THREE safeguards below).

**Boundary holds:** groups exist ONLY for schedule targeting. **No registration, tuition, costumes,
attendance, or payroll.** A group is a reusable "who gets this" — nothing more. Membership is editable
without duplicating dancer records.

---

## ⛔ Pilot boundary — do NOT build a studio-management platform
**No tuition. No costumes. No attendance. No payroll.** This is a *targeted communication calendar*,
nothing more. Keep it lean: groups, rosters, targeted events, personalized family weeks, and
edit-once-propagates. If a feature isn't about "the right people see the right event this week,"
it is out of scope for the pilot.

---

## The engine already exists — REUSE it (verified in the schema)
- **`studio_classes`** = the event/group entered once (title, kind, recurrence or one-off, times,
  teacher, room, location). *(Reuse the B2 event model.)*
- **`enrollments`** (`student_id` ↔ `class_id`) = the **roster / targeting**. Whoever is enrolled
  sees it. A class, a team, a duet, a private are ALL a `studio_class` with the right roster.
- **`class_sessions`** = the dated occurrences; the guardian's This Week already resolves a child's
  enrolled classes into their week.
- **`affiliations`** (`student` ↔ `employer`) = which studio a dancer belongs to (from the family
  code join).
- **Change-once-propagates is inherent:** edit the one `studio_class` → every enrolled family reads
  the same updated sessions. No fan-out, no copies to sync.

So the targeting, the auto-delivery, and the change-propagation are already how the data works.

---

## What to BUILD (this brick)
1. **Studio schedule area — studio-owner/staff, permission-gated (NOT admin-only).** The studio's
   own place to run its comp calendar. (Reuse the existing `ScheduleEditor` where it fits.)
2. **Studio roster — reusable groups + individual dancers** (see the "Studio roster & REUSABLE groups"
   section above). Read affiliated students from `affiliations` / `students`; let the studio create and
   manage named groups (a dancer may belong to several); show member counts; keep an Individual dancers
   list beneath.
3. **Events** — create/edit `studio_classes` (Jazz 2, Company, a private, a duet…): title,
   kind (rehearsal/competition/audition/workshop/performance/deadline), recurrence **or** one-off
   date, day/time, optional teacher/room/location.
4. **Assignment — the core.** For each event, choose who it's for:
   - **Whole studio** → the `studio_wide` boolean on `studio_classes`.
   - **One or more groups/classes** → target the saved group(s); enrollments resolve to the group's
     *current* members and recompute when the group changes.
   - **Selected dancers / one dancer** (duet/trio/private) → a quick multi-select from the roster.
   The resolved `enrollments` = distinct(union of targeted groups' members + individually-added
   dancers). Make targeting fast — pick a group in one tap, or search the roster for individuals.
5. **Per-family resolution** — extend the guardian's This Week so a child's week = **their enrolled
   classes (already works) + any `studio_wide` events at their affiliated studio**, and a family
   with multiple children sees all of it **merged into one personalized week**.
6. **Edit once → propagate** — editing an event (including moving a single occurrence, e.g. "Monday
   6→6:30 this week") reflects in every affected family's This Week. Confirm this holds end to end.

## Permissions / safety (keep intact)
- Only the studio's own owner/staff may edit that studio's schedule and roster; families are
  read-only. Do not weaken the existing RLS. A dancer is never visible outside their studio +
  guardianship. Admin (Kathleen) keeps her editor too, for assist.

## Family-safe rendering — THREE safeguards (Kathleen, before build)
These are non-negotiable for a multi-dancer family. Verified against the current engine
(`src/lib/this-week/live.ts` + `queries.ts`): each child's week is built **independently** from that
child's `enrollments`, so #2 and #3 are largely inherent — but #1 has one real trap in the NEW
studio-wide lane.

1. **No duplicate events.** When two children in ONE family are both assigned the same item, the
   family sees it **once**, never once per child.
   - *Per-child items* (a private, a duet, a class only one child is in) already can't duplicate —
     they live under the right child.
   - ⚠️ *The trap:* a **Full Studio Event** (`studio_wide`) applies to BOTH children. Because the
     engine resolves each child's week separately, a naïve studio-wide resolution would surface it
     **twice** in a two-child family. **Resolve `studio_wide` ONCE at the family level and de-dupe by
     event/session id across the merged week** — do not attach it per child. (Same care if a real
     roster ever enrolls both siblings in one shared item: de-dupe the merged family week by session
     id.)

2. **Every event shows whose it is.** In a multi-dancer family, each personalized item names the
   child it belongs to ("Ryan — Jazz 2 Rehearsal," "Sophie — Solo Private"). Whole-family items
   (Full Studio Event, Parent Meeting) are labeled **for the family**, not tagged to one child. The
   per-child week structure already carries the child — keep that label on the card.

3. **Audience changes reach ONLY the affected families.** All three must be tested explicitly:
   - **Edit** (time/place/teacher) → every currently-enrolled family updates; nobody else changes.
   - **Cancel** → the session shows as **canceled** to exactly the enrolled families (don't silently
     drop it — a comp family needs to *see* it was canceled).
   - **Change the audience** (add/remove a dancer from a duet; change a class's roster) → the removed
     family stops seeing it, the added family starts, **everyone else is untouched.** This is the
     subtle one — test add AND remove.

## Sets up the next brick
Because every affected family reads the same event, a change reaches all of them — the **"Got it"**
acknowledgment sits directly on top of this. Build Got-it AFTER this.

---

## Acceptance
- Studio owner makes "Jazz 2 Rehearsal Mon 6–7," assigns Jazz 2's dancers → only those families see
  it; Ballet 1 does not.
- Studio owner makes a private for one dancer → only that family sees it; a duet for two → only those two.
- Studio owner makes a **studio-wide** event → every family at that studio sees it.
- A two-child family sees both children's items merged in one week.
- **De-dupe:** a two-child family with a **studio-wide** event sees that event **exactly once**, not twice.
- **Labeling:** in that same family, each per-child item names the correct child on its card.
- **Cancel:** studio cancels a session → the enrolled families see it marked canceled.
- **Audience change:** studio removes a dancer from a duet → that family stops seeing it next load;
  the remaining dancer's family still sees it; unrelated families never saw it.
- Studio owner edits the rehearsal **6→6:30 once** → every affected family's This Week shows 6:30.
- **Groups:** studio makes a "Jazz 3" group of 12, schedules a Jazz 3 rehearsal by picking the group
  (not 12 clicks) → all 12 families see it. Studio adds a dancer to Jazz 3 → the new family now sees
  every Jazz 3 event; existing events update without re-entry.
- **Nowhere** is there registration, tuition, costumes, attendance, or payroll.

---

## Page copy (final — replaces the choppy instructional stack)
One calm promise up top; one short line per section. Don't repeat "enter once," "right families," or
"This Week" more than necessary.

- **Under the studio name:** *Build your studio's week in one place, and Relevé shares each schedule
  item with the families who need it.*
- **Studio roster** *(section heading, renamed from "Studio dancers")* — *View the dancers currently
  connected to your studio, organized into the groups and classes you schedule.*
- **Schedule** *(section heading)* — *Add rehearsals, private lessons, competitions, meetings, and
  other important dates. Choose the dancers or groups involved, and the event appears in each family's
  This Week.*
- Remove the old "Comp/college events only, not weekly rec classes" line from the visible page — it
  reads like an internal build restriction, not something a studio owner needs.

---

## Company Roster & Age Divisions (refinement, 2026-07-31 — Kathleen)
**Rename & restructure "Studio roster" → "Company Roster"**, two views, in this order:
1. **All Company Dancers (N)** — the MAIN roster (rename of "Individual dancers"). Every company dancer
   listed **once** (a dancer in several groups still appears a single time). Answers *"who is in the
   company?"* Each row shows the dancer's **Age Division** + **age range (reference)** + **parent-
   connection status.** Example row: **Ava L. — Junior · Age 11–13 · Parent connected.**
2. **Groups & classes** beneath — Jazz 3, Teen Company, Production, Small Group… Answers *"how are they
   organized for scheduling?"*

**Age Division — STUDIO-CONTROLLED, not derived from age.** Different competitions/studios define
divisions differently, and a dancer can age into a new division mid-season, so **never auto-set it from
age.** The studio picks it per dancer; the **age range shows separately as reference.**
- **Picklist (app-level constant, extensible — NOT a hard DB enum):** Mini · Petite · Junior · Pre-Teen
  · Teen · Senior · Open · Adult.
- **Store it on the studio-scoped `affiliations` row (student ↔ employer), NOT on the family-owned
  `students` record.** Division is the STUDIO's classification of that dancer — each studio sets its
  own, edits it mid-season, and it must never mutate COPPA-protected family data. `age_range` stays on
  `students` as read-only reference.
- Editable inline from the All Company Dancers roster (studio owner/staff only).

**"Junior Company" / "Teen Production" are GROUPS, not a second field.** The *age division*
(Junior/Teen/Senior…) is this per-dancer classification; a *named competitive team* (Junior Company,
Teen Production) is a **group** the dancer belongs to (many per dancer) — we already have groups. Don't
build a redundant third concept.

## One-time events + tidy confirmations (refinement, 2026-07-31)
- Repeats: rename **"One-off date" → "One time event."** When chosen, the date label reads **"Event
  Date"** (not "Date"). Weekly keeps "Starts on" (series start).
- Success notices ("Group saved," "Group deleted," "Entry added") **auto-dismiss after ~4s** — nothing
  sits parked between the roster and the schedule.

*— enter it once; the right families see it automatically · together we rise · relevé —*
