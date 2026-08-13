# Studio → Families → "This Week" — August Build Spec (concierge)
### Kathleen, 2026-07-30. Build AT / just after studio onboarding. Scoped to competition & college teams. Admin-assisted, NOT self-serve. Brand always **Relevé** (é).

*Companion to `RELEVE-ROADMAP-COMP-COLLEGE-WEDGE-FROM-KATHLEEN.md` — read that for the why. This is the what-to-build.*

---

## UPDATE — 2026-07-30 · free pilot, studio self-serve scheduling, the hub
**Progress:** B1 (admin family join code) and B2 (admin schedule editor) are BUILT + pushed.

**Free pilot Aug 1 → Dec 31, paid January — as a real FREE TRIAL, not a bypass.** This Week gates
on family `subscription_status` (`active`/`trialing`); `/join` currently creates families as
`none` → blank calendar. Fix: joining families become `trialing` with `trial_ends_at = 2026-12-31`;
the entitlement check must respect `trial_ends_at` so trials lapse in January and the paywall turns
on by itself. **Do NOT remove the subscription architecture — January needs it.**

**Studio owns its schedule (this REVISES the "admin-only" scope below).** For This Week to be a
living HUB, the STUDIO — not only the admin — must add/update/change its own schedule in real time.
Promote the schedule editor to STUDIO-accessible (reuse `ScheduleEditor`, permission-gated to the
studio's owner/staff); keep the admin editor for assist/seeding. Kathleen is never the bottleneck.

**This Week = the studio's communication hub.** Build the engagement layer once the calendar is
live + studio-editable.

**Remaining bricks, in order (supersedes the numbering below):**
1. **Free-pilot entitlement** — trialing → Dec 31 + expiry-aware check. *(URGENT — families see a blank calendar without it.)*
2. **Studio self-serve scheduling** — the studio edits its own calendar in real time.
3. **College-team adult membership** — Manhattan College dancers affiliate WITHOUT the guardian/minor flow.
4. **Verify the full chain** end to end (family joins → child's week shows; college dancer joins → team week shows).
5. **Confirm The Climb / MailerLite** in production + one clean signup.
6. **"Got it" acknowledgment** — parent taps a calendar item/announcement → grey turns green; studio AND admin see who acknowledged. Both the trust mechanic AND the usage/outcome data that matters most.
7. **Quick RSVP** for events — same "family responds" shape as Got-it; share a data model.
*Later (not the pilot's first pass): automated reminders, polls, exclusive content.*

---

## Scope guardrails (do not exceed)
- **Comp/college teams only — NO rec-calendar import**, no rec-class scheduling.
- **Concierge/admin-assisted:** Kathleen (admin) generates the family codes and enters the schedules with each studio. **Do NOT build self-serve studio scheduling or self-serve family-invite UI yet.**
- **Two membership models:** comp studios = guardian-managed minors + parents (existing `/join` flow); Manhattan College = **adult, self-managed dancers** (needs a non-guardian path — see B3).
- **Build additively.** Do not alter the existing family `/join` logic, the This Week RLS, or The Climb consent logic — extend around them.

## Current state (verified in code)
- **This Week** (`/this-week`) reads the signed-in viewer's real week via RLS — a teacher sees classes they teach, a guardian sees their children's classes. Data = `studio_classes` (templates) → `class_sessions` (dated). Empty calendars fall back to a labeled DEMO week.
- **Family join** (`/join`, `joinThroughStudio`) works and is COPPA-safe, but it only **reads** a `studio_invites` code — **nothing in the app creates that code today.** (This is the #1 gap.)
- **Class schedule:** `studio_classes` / `class_sessions` tables exist, but **there is no UI to create classes** — so This Week has no real data to show. (This is the #2 gap.)
- **The Climb → MailerLite** is built and consent-correct. MailerLite account is **live/authenticated** (verified). Confirm the production env vars point to it (B5).

---

## Build bricks — ordered, each testable before the next

**B1 · Admin generates a family join code (per comp studio).**
In the Admin Console, per studio, create & display a `studio_invites` code + shareable link Kathleen hands to that studio for its competition families. (Concierge: admin creates it, not the studio.)
*Test:* code created → a family enters it at `/join` → child enrolled under that studio, guardian-managed.

**B2 · Admin schedule entry (comp/college kinds only).**
An admin-facing way to create `studio_classes` for a studio/team: title, **kind** (`rehearsal | competition | audition | workshop | performance | deadline`), day+time, recurring or one-off date, optional teacher, room, location. No rec classes.
*Test:* sessions expand and appear in This Week for that studio's teachers and its guardians' children.

**B3 · College-team adult membership (no guardian layer).**
A path for **adult** Manhattan College dancers to affiliate to the team **without** the guardian/minor/consent flow — a self-managed adult account linked to the team. The coach (as the team's admin/owner) is set up like a studio for scheduling.
*Test:* an adult dancer joins the team, sees the team's This Week; **no** guardianship row is created.

**B4 · Verify the full chain end to end.**
Comp path: family joins with the code → the child's rehearsals/competitions show in the guardian's This Week. College path: dancer joins → the team's schedule shows in their This Week.
*Test:* both, on a real (or admin-seeded) schedule.

**B5 · Confirm The Climb fires.**
Verify `MAILERLITE_API_KEY` + `MAILERLITE_CLIMB_GROUP_ID` are set in **production**, and run one clean consent Climb signup → confirm it lands in the MailerLite "Climb" group.
*Test:* a real signup appears in MailerLite.

---

## Explicitly NOT in scope (later phases)
Self-serve studio scheduling · self-serve family-invite · **Advisory** (white-space, needs its own capacity snapshot) · **Flex** · **Swing**.

## Acceptance (whole pilot loop)
A comp studio Kathleen onboards has a family code AND a populated This Week; a comp family joins and sees their dancer's actual week; Manhattan College's coach has a populated team week and adult dancers see it (no guardian flow); and a Climb signup lands in MailerLite. Everything concierge, nothing self-serve, no rec calendar.

*— populate the week they actually live in · together we rise · relevé —*
