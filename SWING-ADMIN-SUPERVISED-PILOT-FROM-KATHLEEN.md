# The Swing — Admin-Supervised Pilot (the blueprint)
### Kathleen's design, captured 2026-07-29. DO NOT BUILD YET — build only AFTER the five studios are live.
*This is the concierge / human-in-the-loop version of The Swing. Kathleen is the matching engine for v1; the data she generates by hand is what an automated dispatch loop gets built from later. The brand is always **Relevé** (accented é).*

---

## Guardrails (read first)
1. **Do not build until the five founding studios are live and active.** A two-sided feature launched before the demand side is real fails. The studios ARE the demand.
2. **Admin-supervised only.** No auto-dispatch, no public exposure, no self-serve. Every match passes through Kathleen's Admin Console. All of it is admin-gated.
3. **Invite-only teacher pool.** Five hand-picked core teachers + up to five backups — chosen *with* the founding studios ("who would you trust to sub?"). Not a Facebook open call.
4. **Do not disturb existing Swing data.** The `swing_availability`, `swing_styles`, `swing_levels` rows are untouched; build additively.
5. **Build in ordered, testable slices** (below). Ship one, test it, then the next — the discipline the studio onboarding taught.

---

## Current state (what exists today — verified in code)
**Built — Slice A, teacher data model:**
- `swing_availability` (1:1 with a talent profile): `is_available` (boolean, **defaults FALSE** — member-controlled, never ambient), `home_location` (text), `travel_radius_miles` (int, capped 500), `notes`, timestamps. Indexed for fast lookup of opted-in teachers.
- `swing_styles` / `swing_levels`: the styles + levels a teacher will **sub** (independent of what they teach).
- Lib: `src/lib/swing/availability.ts` (`SWING_MAX_RADIUS_MILES = 500`, `parseSwingRadius`, `buildSwingAvailabilityRow`).

**Dormant — the teacher opt-in UI was removed (2026-07-22):**
- The profile editor's Swing section now just reads "You will receive opportunities when Swing launches." The toggle + home base + radius + sub-styles/levels controls are gone from the UI (data model kept). The apply form still asks a plain "Available to substitute? Yes/No."
- **Implication:** the pilot must RE-SURFACE a way for the cohort teachers to set their Swing availability (toggle + sub styles/levels + home base + radius) — or let the admin set it for them.

**Not built at all:** studio gap submission, dispatch/matching, teacher alerts, the "Interested & available" response, an admin view of opted-in teachers, the status lifecycle, confirmations, reviews, billing.

---

## The pilot flow (Kathleen's design)
1. An **approved studio submits a teaching gap** (date, time, duration, style, level/age, location, decision deadline, optional pay/notes).
2. The gap lands in **Kathleen's Admin Console** as a request with status **Seeking coverage**.
3. The system **surfaces potentially matching teachers** whose Swing toggle is ON and whose style/location broadly matches — **core teachers first**.
4. **Kathleen chooses which teachers receive the alert** (she is the matcher).
5. Alerted teachers respond **"Interested & available"** — one click, no login friction (a secure token link, like the studio invite). *Interested ≠ covered.*
6. **If no one responds within a defined window,** the alert expands to **approved backup teachers + a slightly wider travel radius.** Kathleen can also personally contact appropriate teachers from the Console. The studio may keep looking through its own contacts in parallel.
7. **Kathleen personally selects and confirms ONE teacher.** Only now does status move to **Covered**.
8. **Studio and teacher receive final confirmation emails.**
9. **After the class, Kathleen records whether it occurred** (the seed of reliability data + future reviews).
10. **If no one is confirmed by the studio's deadline,** the request becomes **Unfilled** and the studio is told **immediately and honestly**. The studio can also click **"I found my own coverage"** to close it themselves.

**The studio must never be left wondering whether someone is coming.**

---

## Status lifecycle (the spine)
`seeking_coverage` → `covered` (Kathleen confirms one teacher) — OR — `unfilled` (deadline passed / no confirmation) — OR — `closed_self` (studio clicked "I found my own coverage").
Only Kathleen's explicit confirmation moves a request to `covered`. A teacher's "Interested" never changes the status.

---

## Pilot protections (non-negotiable)
- **No charge unless a teacher is confirmed.** (Swing is the paid studio product; during the pilot, nothing bills until `covered`.)
- A teacher clicking **Interested** does **not** mean the class is covered — status stays `seeking_coverage` until Kathleen confirms.
- The studio always receives a clear **Covered** or **Unfilled** message — never silence.
- The studio can **self-close** with "I found my own coverage."
- **One unsuccessful request must not hurt** the studio's standing or the teacher pool.
- **Repeated unfilled requests are DATA** — they reveal exactly which locations, times, styles, and age levels lack teachers (travel distance? short notice? weekday gaps? pay? style? too-small a pool?). In the pilot, an unfilled class is valuable information, not a failure.

---

## Build slices (ordered, each testable before the next)
**Slice B1 — Teacher opt-in, re-surfaced (cohort only).** Bring back a teacher-facing Swing control (toggle + sub styles/levels + home base + radius) for the hand-picked pilot teachers, writing to the existing `swing_availability` tables. Test: a cohort teacher can turn availability on/off and set preferences.

**Slice B2 — Studio gap submission.** An approved/live studio submits a gap (a form + a `swing_requests` table with the fields above and the status lifecycle). Test: a studio submits; the request appears in the Admin Console as `seeking_coverage`; Kathleen is notified (email).

**Slice B3 — Admin dispatch console.** In the Admin Console, a view per gap that lists opted-in teachers broadly matching style/location (core first, backups flagged), lets Kathleen select who to alert, and sends the opportunity email with a secure one-click "Interested & available" link. Test: Kathleen selects teachers; they get the email; their response shows in the console.

**Slice B4 — Confirm + close the loop.** Kathleen confirms one teacher → status `covered`, confirmation emails to studio + teacher. Deadline passes with no confirm → `unfilled` + honest studio email. Studio "I found my own coverage" → `closed_self`. Post-class, Kathleen marks whether it occurred. Test: every path closes cleanly; the studio is never left hanging.

**Slice C (later) — automation seeds.** Once Kathleen has run enough manual matches, use that data to add tiered auto-alerting, reviews/reliability, and the billing layer. Do NOT build C during the pilot.

---

## Acceptance (whole pilot)
A founding studio submits a real gap → it reaches Kathleen as `seeking_coverage` → she alerts chosen teachers → a teacher clicks "Interested & available" → she confirms one → both sides get confirmation → she records it happened. And the unfilled path: deadline passes → studio gets an honest "Unfilled" note → nobody's standing is harmed. Everything admin-gated; nothing public.

*— the human is the algorithm first · together we rise · relevé —*
