# ▶️ RESUME HERE — Relevé Connect build

> ## 🔀 POSITIONING CHANGE — Swing + Flex off the public site; licensing leads (2026-07-22)
>
> **Founder decision: launch lean on licensing + community.** The Swing and The Flex Series come off the front door before they are paid, working products. This is a **positioning change, not a feature deletion** — nothing behind the sign-in was removed.
>
> **Branch `feature/licensing-first-positioning` — 2 commits, NOT pushed, NOT merged. Production still shows the old homepage.**
>
> ### Removed from the public site
> - **Homepage** (`src/app/page.tsx`): the `The Swing — never scramble for a sub again.` block and its **`$50/hour`** copy (the only `$50` in the codebase); the `The Flex Series — test before you commit.` block; the two `Coming` chips that existed only for them.
> - **`/studio`**: the entire page was the sub-finder (h1 *"Never scramble for a sub again"*, bullet *"The sub-finder (The Swing)"*). Rebuilt around what a studio can actually do today — browse the Roster, set up a studio account. Kathleen chose "slim it" over "delete it" or "placeholder"; `/studio/edit` is real and working, so the CTA is not a promise.
>
> ### Licensing promoted to the primary draw
> Was one of four feature cards; now its **own full section directly beneath the hero** — first thing after the promise. Copy leads with **rights control** ("you decide how a piece may be used, by whom, and for how long"), per the ratified rights-management framing, *not* with selling a video.
> - **The `Coming` chip stays.** Licensing IS NOT BUILT — no self-serve lane, no watermarking / DRM / signed-URL protection anywhere. **No "start licensing" button was invented.**
> - **CTA is an email capture** (Kathleen's choice of the three offered). Reuses `ClimbSignup` via a new `variant="licensing"`; its consent line **names The Climb out loud**, because that is the list it joins — nobody lands on a list they didn't agree to (guardrail #5).
> - New **optional** `MAILERLITE_LICENSING_GROUP_ID`: if set, licensing signups join that group **AS WELL AS** The Climb, never instead of it. Documented in `README.md` + `.env.example`.
> - **Homepage `<meta name="description">`** re-centred on licensing.
>
> ### Deliberately NOT touched (Kathleen's explicit call: "leave both")
> The Swing opt-in in `/profile/edit` · the *"Available to substitute (The Swing)?"* question on `/apply` · `swing_availability` / `swing_styles` / `swing_levels` tables + migration · `lib/swing/availability.ts` · all This Week code (the "Available for The Swing" event card, adapters, tests) · `swing` in `reserved-slugs.ts`. **The feature is intact behind the sign-in — only off the shop window.** Restoring the homepage block is uncommenting; the honesty-rule comment in `page.tsx` records exactly what was removed and why.
>
> ### ⚠️ Owed by Kathleen — a DB row, not code
> `open_to_badges` slug **`substituting`** → label **"Substituting via The Swing"** still renders as a checkbox in the *"Open to…"* section of `/apply`. It is content, not code:
> `update open_to_badges set is_active = false where slug = 'substituting';`
> *Also flagged, not touched:* the sibling row `auditioning` → **"Auditioning via The Beat"** names another unbuilt feature.
>
> ### Guardrail upheld
> **Senior Spotlight / the $499 Signature Experience were NOT named publicly**, despite the brief saying "elevate licensing / Senior Spotlight" — the standing rule is that they are curated and invite-only and must never appear on the public homepage. The **general** licensing promise was elevated instead, and the guardrail comment was preserved in `page.tsx`. **If that rule has changed, Kathleen has to say so.**
>
> ### Verified
> `npm run build` compiles · **127/127 tests pass** · ESLint clean · both pages rendered in-browser (homepage body text contains no "Swing" / "Flex" / "$50"; `/studio` clean) · **no horizontal overflow at 375px**, licensing section starts ~718px down a 812px mobile viewport (second thing you see) · zero console errors. **No pricing or tiers added anywhere — the site stays free/waitlist.**
>
> ### ▶️ OPEN — needs Kathleen's answer (do NOT guess)
> **Is The Swing paused, or just quiet while it gets finished?** The pick-up point below (written 2026-07-13) says the next pillar is the **Swing dispatch loop (Slice B)**. Today's decision pulled The Swing off the public site. Those point in opposite directions. **The pick-up point below is left UNCHANGED and is now suspect** — do not start Slice B on the strength of it without asking. If The Swing is paused, the live candidates become The Beat and the licensing lane itself (which is the thing the homepage now leads with, and the thing that isn't built).

> ## ✅ APPLY-FLOW FIXES from Kathleen's self-test (2026-07-20)
>
> She tested on **Brent's old site** and filed 7 findings. Mapped onto the new build: **3 were already impossible here**, **1 was fixed earlier today**, **3 were real** and are now done.
>
> ### Fixed this pass
> **AUTO-SAVE + 14-day resume link** (the launch blocker). Form saves ~2.5s after you stop typing and restores exactly on return.
> - New `applications.draft_fields` (flat snapshot) is **separate from `answers`** on purpose: `answers` is the nested, reviewed artifact built at submit; rehydrating a half-finished form out of it would be lossy. `draft_fields` round-trips byte-for-byte.
> - Restore writes values back into the DOM once on mount rather than converting ~40 fields to controlled inputs. The three values that drive *rendering* (roles, primary role, story) are seeded from the draft first, so **role-branched sections exist before the rest is restored into them** — verified: the choreographer section re-rendered with its field intact.
> - **No draft is created for someone who merely opens the page** (guarded on first/last name or story being non-empty) — otherwise a visit would mint a draft and email them.
> - Resume email fires **exactly once**, stamped via `resume_email_sent_at` before sending. Verified: still one email after many autosaves.
> - Save indicator is honest — it showed `Not saved — <real DB error>` during testing rather than a false "Saved".
>
> **RE-ENTRY (her #3, in a worse form here).** The old site wasted her time with a late error; the new build handed a returning applicant a **blank form that silently OVERWROTE their submission**. Now `/apply` looks first: draft → rehydrate · already submitted → **status page, no editable form** · nothing → fresh form.
>
> **APPROVE FEEDBACK (her #5).** The new build did refresh, but the default filter is "in-review", so an approved row **silently vanished** — reads as a glitch. Now the row **stays visible** and the buttons are replaced by the outcome: *"Approved ✓ — complimentary membership through Jul 20, 2027. Welcome email sent."* It reports the **side effect**, so a silent comp-grant failure is visible immediately.
>
> **STALE $30 ADMIN COPY** (my miss from the free-launch pass): the Decline button said "refunds $30" and the header said declining "refunds the $30 automatically". There is no $30 — the admin was being told a refund happened that never did.
>
> ### Already impossible in the new build (no work needed)
> - **#1 forced secondary-role section** — only `first_name`/`last_name`/`email` are `required`; the Studio Owner section is one optional textarea.
> - **#2 studio asked a teaching question** — "Styles you teach" is in §5, gated on the Teacher role; the studio path never asks it.
> - **#4 studio-name validation glitch** — there is no Studio name field here.
> - **#6 approval email** — implemented + verified earlier today; says "you're in → build your profile", no $30.
>
> ### ⚠️ Gotcha worth remembering
> A `"use server"` file may export **only async functions**. An exported `const` there passes `tsc` AND `eslint` and only fails at runtime — caught by opening the page, not by the toolchain.
>
> ### ▶️ STILL OPEN — needs Kathleen's input (do not guess)
> 1. **What should the studio/employer path actually ask?** Today it's one free-text box. `employer_profiles` already has unused `student_count_band`, `staff_count`, `room_count`, `year_founded` — she liked those questions on the old site.
> 2. **What should the PRIMARY role require?** Right now almost nothing is required: only the 150-word story has a minimum, references are optional, and §12 "select at least one" is unenforced. Her rule ("primary role required, extra roles optional") is satisfied only because *nothing* is required — the opposite problem.

> ## ✅ EMAIL SENDER + FREE FOUNDING LAUNCH (2026-07-20)
>
> ### Email actually sends now
> `src/lib/email/send.ts` — one `sendEmail()` that POSTs to **Resend** over `fetch` (no SDK dependency; swap vendors by editing that one file). All **10** emails in `EMAILS.md` are implemented; none are stubs any more.
> - **Proven with a real HTTP call:** with a dummy key the log shows `REJECTED … HTTP 401 {"message":"API key is invalid"}` — that response can only come from Resend's servers, so the network path is real. With a valid key it sends.
> - **Never throws** (a failed email must not fail a paid webhook) — verified: the approve action returned `ok:true` and still granted the membership while the email was failing.
> - **Never goes quiet** — unconfigured, it logs the full message. (The old seam logged *less* once env vars were set.)
> - **Still needs, to actually deliver:** `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`, `ADMIN_ALERT_EMAIL`, and a **verified sending domain in Resend**.
>
> ### Free founding launch — LIVE in the code
> **Applying is free. Approval grants a complimentary membership for ONE YEAR** (founder decision: free one year).
> - `submitApplication` now puts an application straight into **`in-review`** and fires emails #1 + #2 itself (they used to fire only from the fee webhook — so going free without this would have meant **you were never told anyone applied**).
> - Approval grants a comp membership via `grantFoundingMembership()` (`src/lib/membership/founding.ts`): `price_cents: 0`, `source: 'founding_comp'`, **no Stripe ids**, `renewal_date = +12 months`.
> - **Why a comp ROW, not a "free mode" flag:** zero gating logic was touched. Turning payment on is "stop calling that function" — the Stripe path was never disabled. Every comp is a queryable, auditable row (`where source = 'founding_comp'`).
> - Tier is role-derived: studio-only → `studio_connect`; everyone else → `professional` (the tier that opens the profile builder). A studio owner who *also* teaches gets `professional`.
> - Fee code is **left in place, unreferenced**. The approved fee wording is preserved in `APPLICATION_FEE_NOTE`. Copy updated on `/apply`, the form, and `/apply/submitted`.
>
> **Verified end-to-end on the live DB** with a throwaway applicant (since deleted): submitted via the real form → row landed `in-review` → confirmation email fired with correct fee-free copy → admin-alert warned loudly that `ADMIN_ALERT_EMAIL` is unset → approved → comp membership `professional`, $0, free until **2027-07-20** → `/roster`, `/profile/edit`, `/this-week` all returned **200** for that member → re-approving returned `already_active` with **no duplicate row**.
>
> **Tests: 117 passing** (12 new in `founding.test.ts`, incl. that a comped row satisfies the real `hasAnyActiveMembership` / `hasActiveProfileTier` gates).
>
> ### ▶️ To switch payment back on later
> 1. In `ApplyForm.tsx`, restore the POST to `/api/applications/[id]/fee-checkout` and redirect to `url`.
> 2. In `apply/actions.ts`, set `state: "submitted"` and remove the two email calls (the webhook resumes them).
> 3. Stop calling `grantFoundingMembership` in the approve route.
> 4. Decide what happens to founding members at their `renewal_date` — they were promised **one free year**, so they need a real renewal path before 2027-07-20.
>
> ### ⚠️ Still open / found along the way
> - **MailerLite auto-subscribes every $499 buyer with no opt-in and no unsubscribe surface.** Inert only because the env vars are unset — **setting them turns it on.** Needs a consent decision before launch. Flagged loudly in code + `EMAILS.md`.
> - **The Stripe test key in `.env.local` is EXPIRED** (`api_key_expired`) — the rolled key from 2026-07-15. No Stripe flow works locally until it's replaced.
> - Auto-save + 14-day resume link (#3) still unbuilt — the remaining launch blocker before real applicants.

> ## ✅ COMPENSATION — teaching_engagements + teaching_earnings (2026-07-20)
>
> **Pay is now relationship-based, exactly as directed.** A class defines *schedule, location, structure* and says nothing about money. Compensation lives on the engagement between a teacher and a studio. Migration `20260720150000`, applied + registered.
>
> ### The architectural decision that avoids a later redesign: TWO tables
> - **`teaching_engagements` = the AGREEMENT.** "Kathleen teaches at Bergen Ballet for $65/hr, effective June 1." Mutable. Answers *what should this pay?*
> - **`teaching_earnings` = the FACT.** "July 20, 75 min @ $65/hr = $81.25, paid." Append-only, **rate snapshotted**. Answers *what WAS earned?*
>
> Why it matters: with only the agreement, every historical earning would be recomputed from the *current* rate — so a September raise would silently rewrite what August paid, and no payroll report, tax summary or earnings chart could ever be trusted. **Verified live:** the card shows `$81.25 Paid` (the recorded fact) even when the engagement is edited to $99/hr.
>
> **Ready for payroll / earnings / dashboards / analytics without schema change:** money is integer **cents** + currency (never floats) · `work_date` is a DATE so payroll periods and tax years group naturally · `teacher_profile_id` + `employer_id` are **denormalised onto the ledger** so dashboards group without joins and RLS evaluates cheaply · status lifecycle (`pending→approved→paid`, plus `void` for reversals) · `payout_batch_id` + `external_reference` give a future payroll run somewhere to write back · `source_kind` segments Swing subs from ongoing teaching.
>
> ### Enforced at the DATA layer, not the UI
> - **Swing = $50/hr, immovable.** `enforce_platform_rate` trigger overwrites any `platform_set` rate from `app_config.swing_hourly_rate_cents`. **Verified:** asked for $99 → stored $50; edited to $120 → still $50. The $50 is **config, not a literal** — change it without a deploy.
> - **Paid history is immutable.** `protect_paid_earnings` refuses to alter the amount/date/teacher of a `paid` line ("Void it and record a correcting line instead") — but status may still move, so **reversals remain possible**. Both verified.
> - **Substitutions must be class-scoped** (constraint). Found by testing: a Swing engagement with a null `class_id` acted as the *studio-wide default* and silently pulled every unpriced class down to the Swing rate.
> - **Rate resolution:** most specific wins (class-scoped beats studio-wide), then most recently effective. Mirrored in SQL (`resolve_teaching_rate`, for reporting) and TS (`pay.ts`, for the calendar without an RPC per session) — **keep the two in sync.**
>
> ### Privacy — verified as a role matrix, not just ownership
> | Viewer | Engagements | Earnings |
> |---|---|---|
> | The teacher (owns the pay) | ✅ 2 | ✅ 1 |
> | Studio owner (pays it) | ✅ 2 | ✅ 1 |
> | **Front desk, same studio** | **0** | **0** |
> | **Another teacher, same studio** | **0** | **0** |
> | Unrelated member | 0 | 0 |
>
> Colleagues cannot see each other's pay. The rule lives in **one** function — `can_see_studio_compensation()` — so adding a future `payroll`/`bookkeeper` role is a one-function edit, not a rewrite of four policies. In the UI, pay is fetched **only** for the member's own professional view and never for a child's week: **verified** that the same Ballet III session showing `$81.25` to the teacher shows **no money at all** on Ava's card.
>
> **Tests: 105 passing** (12 new in `pay.test.ts` — earning-beats-agreed-rate, effective dating, specificity, status mapping, and pay-never-on-a-student-card).
>
> **▶️ NEXT:** nothing is half-built here. Natural follow-ons when wanted: a job that writes `teaching_earnings` when a session completes (currently seeded by hand); a studio-side UI to record engagements; an earnings/payroll view for the teacher. Remaining smaller gaps: attachments have no column; `talent_profiles` has only `primary_role`, so the header reads "Kathleen — Teacher" not "Dancer · Teacher".

> ## ✅ "THIS WEEK" — PERSONAL EVENTS: "one calendar, every role" is now literally true (2026-07-20)
>
> **The professional week now merges TWO sources.** The studio's schedule (what she's booked to teach) and her own entries (what she takes, auditions for, owes). Verified in-browser: Monday shows Company Class 10:00 AM (personal) above Ballet III 4:30 PM (studio) — interleaved by real instant, not grouped by source.
>
> **`personal_events`** (migration `20260720140000`, applied + registered): `taking · rehearsing · auditioning · coaching · performance · personal · deadline · availability`. Owner-scoped to a `talent_profile`, carries its own `timezone` per row (a member on tour isn't in one zone).
> - **RLS is owner-only for ALL commands — deliberately narrower than anything else in the schedule layer.** No studio, teacher, or guardian read path. A personal calendar can expose an audition she hasn't told her studio about. **Verified:** another signed-in member reads **0 rows** AND their write is **rejected by RLS** ("new row violates row-level security policy"), with 0 injected rows left behind.
> - **Not in this table:** teaching/taking a studio class (that's `class_sessions` — one source of truth), and the standing Swing toggle/radius (that's the existing `swing_availability` profile setting). A dated availability *window* IS here; the card reads "within 25 miles" from the profile setting, so the radius is never duplicated.
> - A `deadline` renders with **no end time** — it's a moment, not a span.
>
> **Tests: 93 passing** (10 new in `adapters.test.ts` covering viewer-relative category, intrinsic-kind precedence, and the two-source merge order).
>
> **⚠️ SQL gotcha, cost me a wrong-hour bug:** `AT TIME ZONE` binds tighter than `+`, so `date + time at time zone 'America/New_York'` builds a `timetz` and silently stores 10:00 as 06:00. **Wrap the whole sum in parentheses.** Caught only because the seeded times were read back and checked — noted in the seed file.
>
> ### 💰 PAY — the rule, ratified by Kathleen 2026-07-20 (NOT yet built)
> - **The Swing → $50/hr, always.** A platform constant set by Relevé. Same for every teacher, every Swing engagement.
> - **Everything else → the teacher sets their own rate.**
>
> Implication for the build: rate needs a **provenance** (`platform_set` vs `teacher_set`), not just an amount, and the Swing rate must be **non-editable at the data layer**, not merely in the UI. Do **not** hardcode `$50` in components — put it in `app_config` beside `adult_transition_age` so it changes without a deploy. Recommended home: a **`teaching_engagements`** table (teacher × class × term, carrying rate + payment status) rather than a column on the class — pay is a relationship that changes per term, not a property of a class. *(Kathleen's message ended mid-sentence at "D" — confirm nothing was cut off before building this.)*
>
> **▶️ NEXT:** build the pay layer per the rule above. Remaining smaller gaps: attachments have no column; `talent_profiles` has only `primary_role` (no multi-role list), so the header reads "Kathleen — Teacher" not "Dancer · Teacher"; `subbing` has no source yet (it arrives with Swing engagements).

> ## ✅ "THIS WEEK" — SEAMS WIRED TO LIVE DATA (2026-07-20)
>
> **The calendar now reads real rows.** `/this-week` resolves the viewer from the authenticated session and serves their actual week through RLS. Verified in-browser signed in as `kathleen@releveconnect.com`. Branch: `feature/this-week-calendar-pass-one`.
>
> **What one login proves.** Kathleen is a *teacher* at Bergen Ballet and *Ava's guardian*, and the two halves of her page are served by two DIFFERENT RLS policies:
> - **Professional view** → `teaches_class` → Ballet III + Winter Showcase. **Not Jazz II** — she doesn't teach it.
> - **Child's week** → `guardian_calendar_for_class` → all three of Ava's classes, *including* Jazz II.
> - Same Ballet III row renders **TEACHING** in one view and **TAKING** in the other. Teaching-vs-taking is **viewer-relative and derived, never stored** (`adapters.ts` → `categoryFor()`).
> - **Negative test passed:** an unaffiliated signed-in user (`johndoe@gmail.com`) sees **0 rows** in students, class_sessions, studio_classes, enrollments, communications, family_accounts, guardianships — and Ava's DOB is unreachable.
>
> **New code** — `src/lib/this-week/`:
> - `week.ts` — real Mon→Sun week framing, timezone-aware, **no date library** (built on `Intl`). Replaces the pinned fake Jan-12 week.
> - `recurrence.ts` — RRULE expander. Supports `FREQ=WEEKLY · BYDAY · INTERVAL · COUNT · UNTIL` + one-offs. **Refuses loudly** (`UnsupportedRecurrenceError`) on anything else rather than rendering a plausible-but-wrong calendar.
> - `queries.ts` — Supabase reads. **All reads go through the CALLER's client**, so RLS decides visibility; the admin client appears once, only to *write* materialised sessions.
> - `adapters.ts` — rows → the display shapes the UI already used.
> - `live.ts` — builds the payload; `data.ts` is now explicitly the **sample week** (demo mode).
> - `recurrence.test.ts` — **22 tests**, incl. both DST transition weeks, year boundaries, and viewer-timezone bucketing. Full suite: **83 passing**.
>
> **Sessions are materialised, not computed.** First time a week is opened, the rule writes `class_sessions` rows (idempotent via `ON CONFLICT`) — so a studio can later move or cancel ONE occurrence without fighting the rule that made it. Verified: paging to next week materialised Ballet III + Jazz II and correctly did **not** carry the one-off showcase forward; repeated loads produced **no duplicates**.
>
> **Demo mode kept (your call).** Signed out, or signed in with an empty calendar → the pass-one sample week, labelled **"Sample week — not a real schedule."** So the feature stays showable to a studio without pretending the data is theirs.
>
> **3 migrations applied live + registered:**
> - `20260720120000` — `studio_classes.series_start/series_end` (anchors INTERVAL/COUNT; the date of a one-off) + `unique (class_id, starts_at)` on `class_sessions` (makes materialisation idempotent).
> - `studio_classes.kind` enum (`class|rehearsal|performance`) — the *intrinsic* nature only.
> - `20260720130000` — **`employer_profiles` affiliated-read policy.** Found a real gap: the table had an owner-only select policy, so a teacher couldn't read the name of the studio they teach at, and a parent couldn't read their child's studio. Calendar said "Your studio". Fixed with a `SECURITY DEFINER` helper (`is_affiliated_with_studio`) — an inline check would have recursed, since `is_studio_admin`→`owns_employer` reads that same table. **Read only; owner-only write policies untouched.**
>
> **⚠️ FIXTURE DATA IS IN THE LIVE DB** — `supabase/seed/this-week-demo.sql` (Bergen Ballet). Not in `migrations/`, so it never runs on deploy. Teardown block is at the bottom of that file. Fixed ids: studio owner `1111…`, employer `2222…`, family `3333…`, Ava `4444…`, classes `5555…/6666…/7777…`, comms `8888…0801-0804`. The studio owner is a `public.users` row with **no auth user** — deliberate, so Kathleen is only a *teacher* there and the class-scoped policy is what actually gets exercised.
>
> **▶️ NEXT — the two gaps that block the full professional week:**
> 1. **Pay has no home.** `$65/hr · paid` badges have no source column — `studio_classes`/`class_sessions` carry no rate or payment status. Deliberately rendered as *absent* rather than faked. Needs a decision: a column on the class, or a `teaching_engagements` table (teacher×class×term with rate + status)? The latter is more honest — pay is a relationship, not a property of a class.
> 2. **No home for non-class events.** Company Class (taking), The Swing availability, deadlines, auditions — the mockup's professional week — have no table. Needs a `personal_events` table (owner-scoped RLS) before "one calendar, every role" is literally true.
> 3. Smaller: `talent_profiles` has only `primary_role` (no multi-role list), so the header reads "Kathleen — Teacher" not "Dancer · Teacher". Attachments also have no column yet.
>
> **Gotcha found the hard way:** `buildLiveWeek` originally selected a `roles` column that doesn't exist; the error was swallowed by destructuring only `data`, which looked *exactly* like "this member has no profile" and silently hid the whole professional view. Errors are logged now — worth copying that habit into other seams.

> ## ✅ "THIS WEEK" CALENDAR — PASS ONE + PASS TWO SCHEMA DONE (2026-07-17)
>
> **What shipped this session:** the **"This Week"** calendar — the daily-use feature that is (1) the *passport* bringing minors + families onto the platform, (2) the studio↔family *coordination* tool, and (3) the family-subscription *revenue* on-ramp. Built in two passes, both on branch **`feature/this-week-calendar-pass-one`** (pushed to `origin`; **PR is open**; **NOT yet merged to `main`**). Commits: **`68dcb2a`** (Pass One UI) + **`3206e23`** (Pass Two migration).
>
> **Pass One — static UI (committed, verified in-browser at `/this-week`):**
> - A real, reusable, **typed** prototype of TWO views: the professional *"one calendar, every role"* week (Kathleen — Dancer · Teacher) AND a family-only parent/student *child's week* (Ava, managed by Kathleen). A preview-only view switch toggles them (production derives the viewer from auth).
> - Rebuilt in **BLACK · CREAM · GOLD** (the mockups' berry was a placeholder — deliberately absent). Colour appears **only** on category tags/dots + the card's left edge. Serif headings. Verified: cream bg, gold accents, no berry; filter chips + week-nav work; a11y (text on every chip, colour never the only signal).
> - Code lives in **`src/components/this-week/`** (FilterBar, WeekNav, DayGroup, EventCard, AttachmentChip, PayBadge, DashboardRollup, ChildWeek, ViewSwitch, comms seams ChangeAlert/AnnouncementCard/MessageBubble/NoteChip) and **`src/lib/this-week/`** (types.ts, categories.ts, data.ts). Feature-scoped design tokens in `src/components/this-week/tokens.css` (scoped to `.this-week-scope` — existing pages untouched).
> - **The single data seam:** `getThisWeek(viewer)` · `getCommunications(viewer)` · `hasFamilyAccess(account)` — all return hardcoded mock now. Pass Two is a **data swap behind these, not a rewrite**.
>
> **Pass Two — family-layer schema (APPLIED to the live DB + RLS-verified):**
> - Migration **`supabase/migrations/20260717214525_family_layer_and_studio_schedule.sql`** is applied to project `hmqqxbkhcqspqmsjxodq` and **registered** in Supabase migration history. Compile-checked via `BEGIN/ROLLBACK` first, then applied. **9 RLS-protected tables** — family_accounts · students · guardianships · studio_staff · affiliations · studio_classes · class_sessions · enrollments · communications — plus `app_config`.
> - **Safety model enforced in RLS (Kathleen's refinements, all in):** a minor is **never public** (students is separate from talent_profiles, no anon policy, `visibility` pinned to `family_only`, DOB unreachable by studios). **Teacher access is CLASS-SCOPED** — only students in classes they're assigned to teach; studio-wide sight requires an explicit `studio_staff` **admin** role. **Guardian permissions are GRANULAR** (`billing / calendar / messages / medical_forms / pickup_authorization`, gated per surface). **Adulthood age is config** (`adult_transition_age = 18`, via `public.adult_transition_age()`), never hardcoded.
> - **Proven live** (seeded + torn down in one call — nothing persists): a non-guardian sees **0** student rows; the guardian sees their child + DOB; the owner sees the family account. Security advisors: my helpers match the existing `owns_*` pattern (no new risk class). `account_type` unchanged; **auth / The Beat / Senior Spotlight / all existing tables untouched.**
>
> **▶️ NEXT (Pass Two, part 2 — code wiring; the UI does NOT change):**
> 1. Repoint the three seams (`getThisWeek` / `getCommunications` / `hasFamilyAccess` in `src/lib/this-week/data.ts`) at **Supabase queries** against the new tables — "the same week, filtered to the viewer."
> 2. Build a **recurrence expander** that writes `class_sessions` rows from `studio_classes.recurrence` (RRULE) — that's what a week query reads.
> 3. Wire the viewer to the authenticated session (drop the preview toggle).
>
> **Notes / gotchas:** Supabase org is on the **Free plan → no dev branches** (apply via rollback compile-check then live; see memory). PR had to be opened via the **browser** (no `gh` CLI here). Nothing is half-finished — DB is consistent, branch pushed, `main` untouched.

> ## ✅ BRICK 4 — DONE & VERIFIED (2026-07-15)
>
> **The $499 Signature Experience money flow is complete, tested end-to-end in Stripe TEST mode, and committed** (`1751e13` on `main`). Full run confirmed live: onboarding flipped `payouts_enabled`→true (`acct_1TtVV3HFRJ6ZwRKb`); a `4242` payment set the purchase `paid` + `access_granted_at` with the exact **20/80 split** ($99.80 fee / $399.20 transfer); **`on_behalf_of`** verified on the real charge (artist bears the card fee); the `processed_stripe_events` migration is applied live and a **re-delivered event deduped with no double-grant**.
>
> **Pushed to GitHub** ✅ — commits `1751e13` (code + migration) and `f4803b3` (RESUME note) are on `origin/main` (`kathleenkilcoyne/releve-connect-platform`).
>
> **Loose ends (none blocking — Brick 4 is shipped):**
> - **Webhook secret in `.env.local` — intentionally SKIPPED (optional).** During the test we put the Stripe CLI's throwaway `whsec_…` into `STRIPE_WEBHOOK_SIGNING_SECRET`; it's still there and that's harmless — `.env.local` is local-only and the site isn't live, so local webhooks only work via the CLI anyway. We checked the Stripe Dashboard (Workbench → Webhooks) and found **no active production webhook endpoint**, so there was nothing to "restore." **At deploy time:** create a real webhook endpoint and set its `whsec_…` in the HOST env vars (Netlify), not this file.
> - **Rolled Stripe key:** `STRIPE_SECRET_KEY` in `.env.local` is now the new rolled `sk_test_…` key (the old one was set to expire ~24h after the 2026-07-15 roll). Any **deployed** env vars still holding the old key must be updated on the host.
> - **Task queued:** `api/connect/onboard` has **no auth check** (takes `profileId` from the body) — add Supabase-Auth verification so a caller can only onboard their own profile; confirm buyer-side auth on checkout.
> - **Test fixtures still in the live DB** (safe to leave or delete): test artist `2ec75e64…` (Connect acct + a paid `experience_purchases` row + a bundled Access membership + buyer `johndoe@gmail.com`) and the published test work `f6ae50aa…` ("Split-Path Test Experience").
>
> *(The detailed how-we-did-it walkthrough from the 2026-07-15 session is preserved in the box below.)*
>
> ## ▶️ (reference) the 2026-07-15 plan — finishing **Brick 4** (the $499 Signature Experience money flow)
>
> **HOW KATHLEEN WANTS TO WORK THIS (agreed 2026-07-14):**
> - Give her the **PowerShell `Invoke-RestMethod`** version of every command (she's on Windows PowerShell — plain `curl` quoting trips up).
> - **One step at a time. Wait for her to confirm each step works before giving the next.** Do not dump the whole sequence.
>
> **What's already DONE (don't rebuild any of this):**
> - Brick 4 = the $499 Signature Experience via **Stripe Connect**. It is **already implemented** — NOT as Deno Edge Functions and NOT with Clerk (that framing in the original "Brick 4" prompt describes Brent's old stack). In THIS app it's **Next.js API routes + Supabase Auth**:
>   - `src/app/api/connect/onboard/route.ts` — Express onboarding (Flow A)
>   - `src/app/api/experiences/[workId]/checkout/route.ts` — destination-charge checkout, 80/20 split (Flow B)
>   - `src/app/api/webhooks/stripe/route.ts` — signature-verified fulfillment (Flow C)
> - **Two spec gaps were closed on 2026-07-14 (code committed? NO — still UNCOMMITTED in the working tree):**
>   1. **`on_behalf_of`** added to the checkout split path → the artist is merchant of record, so Stripe's card fee comes out of the artist's 80% ("you keep 80% minus card processing"). Founder no-split path untouched.
>   2. **`processed_stripe_events`** dedupe table — migration `supabase/migrations/20260714000000_processed_stripe_events.sql`, **APPLIED to the live DB and verified** (table exists, RLS on, session index present). Webhook now dedupes by Stripe event id (gate on entry + record-after-success), layered on the existing per-row status guards.
>   - `npx tsc --noEmit` → clean; `eslint` on both routes → clean. **Not yet `git commit`ed — commit after the test passes.**
>
> **Test fixtures already created in the live DB (use these):**
> - **Test artist (non-founder):** profile `2ec75e64-4980-4d9a-8df9-abfee39b550d` ("Kathleen McAree"). Currently **no Connect account, `payouts_enabled=false`** → onboarding it is **step 1** of the test.
> - **Test work:** `f6ae50aa-d9e1-4090-9d65-0611612af71b` ("Split-Path Test Experience"), $499, published, owned by that non-founder artist → its checkout takes the **real split path**. Buy page: `http://localhost:3000/experiences/f6ae50aa-d9e1-4090-9d65-0611612af71b`.
> - ⚠️ **Do NOT test the split with the founder's work.** `FOUNDER_PROFILE_ID = b782d686-928a-45a2-887d-9192191e37d1` — its work uses the no-split 100%-to-founder path and would NOT exercise `on_behalf_of`.
>
> **Webhook secret — the one setup gotcha (why we stopped here):**
> - `.env.local` already has a `STRIPE_WEBHOOK_SIGNING_SECRET` (~len 70 = a **Dashboard endpoint** secret) but `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, which Stripe's servers can't reach. For the LOCAL test we need the **Stripe CLI** (NOT installed yet) to forward events to localhost with a matching signature.
> - Setup order tomorrow: (1) `winget install --id Stripe.StripeCli` + `stripe login` (test mode); (2) `stripe listen --forward-to localhost:3000/api/webhooks/stripe` → copy the `whsec_…` it prints; (3) **back up the current secret value first**, then put the CLI's `whsec_…` into `.env.local`; (4) restart `npm run dev`; keep `stripe listen` running the whole test. **Restore the original secret after the test.**
>
> **The test sequence (one step at a time tomorrow):**
> 1. Install + start Stripe CLI (`stripe listen`), swap secret, restart dev.
> 2. **Onboard** artist `2ec75e64…` — POST `/api/connect/onboard` `{profileId}` (Invoke-RestMethod) → open returned URL → finish Stripe Express **test** onboarding (SSN `000-00-0000`, routing `110000000`, acct `000123456789`) → `account.updated` should flip `payouts_enabled=true`.
> 3. **Buy** work `f6ae50aa…` → pay `4242 4242 4242 4242` (any future exp / CVC / ZIP) → `checkout.session.completed` sets the purchase `paid` + `access_granted_at`.
> 4. **Verify in Stripe test dashboard:** application fee = 20% ($99.80), transfer = 80% ($399.20) to the connected account, card fee on the **connected account** (the `on_behalf_of` effect).
> 5. **Re-deliver** the event (`stripe events resend <evt_id>`) → webhook returns `deduped`, nothing double-grants, one row in `processed_stripe_events`.
> - After a green test: **commit** the 3 changed files + the migration, then **restore** the production webhook secret in `.env.local`.
>
> **DB checks (Claude runs these live via Supabase MCP, project `hmqqxbkhcqspqmsjxodq`):** `payouts_enabled` on `2ec75e64…`; the `experience_purchases` row (status/`access_granted_at`/fee+transfer cents); `processed_stripe_events` after resend.
>
> **Deferred to AFTER the test (tracked as a task):** `api/connect/onboard` takes `profileId` from the request body with **no auth check** — add Supabase-Auth verification so a caller can only onboard their own profile; also confirm the buyer-side auth on the checkout route. (Kept open on purpose so tomorrow's onboarding step can POST directly.)

> ## ▶️ START HERE — good morning, 2026-07-14
>
> **Everything through 2026-07-13 is built, verified on the live database, committed, and pushed to GitHub** (latest commit `2512e61`). Nothing is broken and nothing is half-finished — it's a clean place to pick up.
>
> **Where things stand, in plain terms:**
> - **The Swing** has its *teacher* side (opt-in availability) and *real studio accounts* (§7 studio profiles).
> - **The Beat** now has its **entire hiring-side database** — the job categories, the postings, partner packages, the payments ledger, and the security rules. This is the *plumbing*; there are **no screens and no payment flow yet**.
>
> **Pick ONE brick to lay next** (any is a fine starting point):
> 1. **The Beat — Stripe checkout** *(the money step)*: let someone pay to post a job ($49, or $29 for members) and let college/university partners buy their annual packages, reusing the Stripe setup you already have for memberships. → turns the Beat schema into **revenue**.
> 2. **The Beat — post & browse screens** *(the visible step)*: the actual pages to create a job posting and to browse/filter the board. → turns the schema into **something you can see and click**.
> 3. **The Swing — dispatch loop**: a studio posts an open sub slot → matched teachers are notified → the studio picks who covers it. → **connects teachers and studios** for real.
>
> **Still parked for your decision (no rush):** §D — do the *self-marketing / service* lanes (coaching, photography, creative & production services, accompanists) live **inside The Beat** or in a **separate vetted directory**? Nothing on that side gets built until you decide. Details are in `docs/The_Beat_Build_Plan_2026-07-12.md` (see "Additions — 2026-07-13", section D).
>
> **To reopen the project:** open the folder `C:\Users\kathl\releve-platform`. The full running detail is everything below this box.

*Updated 2026-07-13. **Steps 3 and 4 are complete. Step 5 (The Swing): Slice A (teacher "Available for Swing") AND real studio accounts + the light §7 studio profile are DONE and committed.** Studios now sign up via **light onboarding** — no $30 fee, no approval queue (founder decision 2026-07-13; they are the buyer side, not vetted talent). **Next up: the dispatch loop (Slice B)** — studio posts a slot → match → notify → teacher claims → studio picks → locks → auto-completes → unlocks reviews (Slice C). **Do NOT use the admin-posts stopgap** (violates the §17 no-founder-middleman guardrail). Map pins are stored-address-now / geocode-later (founder decision 2026-07-13). **The Beat — hiring-side schema is now built + verified live (2026-07-13):** admin-managed two-level taxonomy, postings (multi-subcategory, 30-day expiry, portfolio media), partner packages, a transactions ledger, and RLS. Self-marketing/service lanes stay gated behind §D.*

> **📣 Session note (2026-07-11, Kathleen + Cowork):** The repo is now **backed up to a private GitHub repo — `kathleenkilcoyne/releve-connect-platform`** (branch `main`, all 11 commits pushed). See the **Backup** section below. Tomorrow's agreed to-do list is at the bottom under **🗓️ TOMORROW**.
>
> **📣 Roadmap note (2026-07-12):** After Step 3 (Profiles), the next major pillar is **The Beat** (pay-to-post job/audition marketplace — the College/University partner-package revenue). Full corrected build plan (Supabase Auth, NOT Clerk; reconciled pricing) is in **`docs/The_Beat_Build_Plan_2026-07-12.md`**. Founder decision: The Beat is sequenced **ahead of** Swing/Reviews/Marketplace. Do not build it until Profiles ship.

> **📣 Session note (2026-07-13, Kathleen + Cowork):** Built the **studio side of The Swing** — real `employer` accounts + the light §7 studio profile (see the new DONE section). Studio sign-up is **light onboarding** (no fee, no approval). Map pins: store the address now, geocode later. **Kathleen's plan from here:** finish The Swing, then **organize The Beat** so every filter/section of the Audition Page carries **jobs** too (the College/University revenue piece).

---

## 📍 EXACT PICK-UP POINT FOR NEXT SESSION

> ⚠️ **STALE AS OF 2026-07-22 — read the positioning-change note at the top of this file first.**
> Everything below was written 2026-07-13, when the plan was "finish The Swing, then organize The Beat." On 2026-07-22 The Swing was pulled off the public site (launch lean on licensing + community). **Whether that pauses the Swing dispatch loop is an OPEN QUESTION Kathleen has not answered.** Do not start Slice B on the strength of this section — ask first. The rest of it (The Beat, the deferred items, the forward dependency) is still accurate.

**Two live tracks after 2026-07-13:**

- **The Beat** — the hiring-side schema shipped + verified live (see the DONE section below). **Next Beat step:** the Stripe checkout — per-post ($49 / $29 member) + partner-package purchase + studio-included debit — reusing the existing membership webhook pattern; member-vs-non-member price is a lookup against `memberships.tier` (Professional `professional` / Creator `professional_full`). Then the post/browse UI. **Still gated — do NOT build:** the self-marketing / service lanes (§D — inside The Beat vs a separate vetted directory) and their trust model (§E.5).
- **The Swing** — the dispatch loop (Slice B, below) is still the other open pillar.

**Step 5 Slice A (teacher availability) AND real studio accounts + the light §7 studio profile are DONE (see the two DONE sections below).** Next up: **the dispatch loop (Slice B)** — the studio side of The Swing that finally connects teachers ↔ studios. Re-read spec §10–§11 + the §17 guardrails first; ask on anything TBD.

**Concretely, the next slice — the dispatch loop (§10, Slice B):**
- A studio **posts an open sub slot directly** — date, time, location, style, level needed, pay, optional required cert. (New table, e.g. `swing_slots`, owned by the employer; studios now exist to own it.)
- System **matches** only teachers who (a) have Swing on, (b) match style + level + geography, (c) hold the required cert if specified. *(Geography stays coarse — city/state — until the studio map pins are geocoded; the `lat`/`lng` columns already exist, empty.)*
- Matched teachers **notified** (in-app + email seam now; SMS later) → teacher **taps to claim** → **studio picks from responders** (not first-come, §17) → slot **locks** → after the date, **auto-completes** → unlocks the two-way review (Slice C).

### The remaining Step-5 slice (after the dispatch loop)
- **Slice C — The trust engine:** two-way, **double-blind, 7-day-reveal** reviews unlocked on completion, rolled into the profile star rating (lights up the hero's earned-proof slot + the Roster availability filter). *Reminder:* the existing `reviews` table hangs off `connection_id`; a completed Swing gig isn't a connection, so reviews get reworked to hang off a completed swing claim (migration needed).

### Sub-decisions already framed (revisit when building)
- **Levels = the 5 ratified rungs.**
- **Swing $20/use billing** (studio-paid; 3 at Connect / included at Growth / unlimited at Accelerator): *recommend defer* — build the matching + review loop first, wire billing as a later slice.
- **Dispatch alerts:** *in-app + email seam now, SMS later* (no SMS provider set up; sub calls are time-sensitive so SMS matters eventually).

*(Alternative pillar still on the table if Kathleen redirects: **The Beat**, per the 2026-07-12 roadmap note — plan in `docs/The_Beat_Build_Plan_2026-07-12.md`. Kathleen's 2026-07-13 intent: finish the studio side of The Swing, then **organize The Beat** so all Audition-Page filters/sections carry **jobs** too — the College/University revenue piece.)*

**Still deferred (revisit when the data exists):** true **map-pin radius** search (the `lat`/`lng` columns exist but are empty — needs a geocoding provider wired); the **availability** filter in the Roster; **studios in the Roster** (studio profiles now exist — the Roster query can be extended to include them next); the **messaging rail** beyond the lean intro request.

**One forward dependency to know:** the Step-3 profile hero's **earned-proof slot** (completed-Swing count + star rating) stays hidden until Slice B + C ship real data.

---

## ✅ What's DONE and committed (The Beat — hiring-side schema, 2026-07-13)

The Beat's HIRING motion — "post a role, someone applies" (build spec §9; plan + Additions in `docs/The_Beat_Build_Plan_2026-07-12.md`). **Schema + RLS only — no UI, no Stripe flow** (Stripe columns are placeholder/null; pricing resolves at checkout later against `memberships`). The **self-marketing / service motion** (coaching, photography, creative & production services, accompanists) is **gated behind §D** and deliberately NOT built — the gated service families are not even seeded.

- **DB migration** `20260713120000_beat_hiring_schema.sql` (**applied live + mirrored into `schema.sql` §15**): two-level **admin-managed taxonomy** `beat_categories` → `beat_subcategories`; a small **stable** `beat_engagement_type` enum (audition / employment / freelance_gig / other) — the §B "opportunity_type split", with subject-matter in the taxonomy; **`beat_postings`** (`expires_at` default **+30 days**, `portfolio_links` jsonb media, `posting_type`, `status`); **`beat_posting_subcategories`** (a post carries **multiple** subcategories, §E.6); **`beat_partner_packages`** (annual credit bundles; `credits_remaining` generated); **`beat_transactions`** ledger (amounts in cents; Stripe ids null). `owns_beat_posting()` helper.
- **Seeded HIRING families only** (4 categories / 23 subcategories): Teaching & Classes, Choreography, Auditions & Company (Film/TV · Cruise · Theme Park live here as **subcategories** — setting deferred, §E.1), Studio Admin & Support. The gated **service** families are intentionally NOT seeded.
- **RLS:** active postings **world-readable** (job seekers browse); a poster manages only their **own** rows incl. drafts; partner packages + transactions **private**; taxonomy public-read.
- **Naming** (deviates from the plan's Clerk-era `employer_id`, aligned to repo conventions): `poster_user_id` / `holder_user_id` / `payer_user_id` → `users(user_id)` — neutral because a poster may be a studio **or** an individual.
- **Verified against the live DB:** full round-trip (posting + 2 subcategories + partner package + transaction); **RLS proven by simulating roles** — anon sees only the active posting (not the draft), the poster sees both, a different user sees only the active; generated `credits_remaining` = 35 (40−5); `expires_at` = 30 days; `portfolio_links` is a json array; enum/check constraints reject bad engagement/status/negative-credits. Seed deleted after (cascade confirmed); taxonomy intact. Typecheck/lint N/A (no app code this slice).

---

## ✅ What's DONE and committed (Step 5 — real studio accounts + the light §7 studio profile)

The studio side's foundation — the shared blocker for the dispatch loop, The Beat, studios-in-the-Roster, and map-pin radius. **Light onboarding** (founder decision 2026-07-13): studios are the buyer side, not vetted talent — **no $30 fee, no approval queue.** They sign in (magic link) and fill a §7 profile; the `employer` account is created on first save.

- **DB migration** `20260713000000_studio_profile_and_accounts.sql` (**applied live + mirrored into `schema.sql` §4**): fleshed out `employer_profiles` to §7 — website, **full address**, **map pin `lat`/`lng` (NULLABLE — geocode-later)** + `geocoded_at`, `year_founded`, `student_count_band` (Under 100 / 100–299 / 300+), `staff_count`, `room_count`, the **accessibility block** (`nearest_transit`, `car_required`, `parking` onsite/street/none, `directions_note`), and `culture_note`. New **`studio_concentrations`** vocab (Competition · Technique/Recreational · Conservatory/Pre-Professional — deliberately separate from choreographer `focus_areas`). Three join tables — **`employer_styles` / `employer_concentrations` / `employer_certifications`** (styles + certs reuse the existing vocab) with **own-row RLS** via `owns_employer()`. Check constraints on the bands/counts/year/parking.
- **Studio sign-up + editor:** `/studio` (public "For Studios" front door) → `/studio/edit` (the profile form). Not signed in → `/login?next=/studio/edit` (the magic link brings them back — `login/page.tsx` now carries an internal `next`; `auth/callback` honors it behind an open-redirect guard). On first save, `saveStudioProfile` (`src/app/studio/edit/actions.ts`) creates the `users` row as **`account_type='employer'`** + the `employer_profiles` row + the joins. Editing an address clears any stored map pin so the later geocode backfill re-pins. Homepage gained a **"For studios →"** link.
- **Pure, tested logic** (`src/lib/studio/profile.ts`): `buildEmployerProfileRow` + `parseYearFounded` / `parseCount` / `parseEnum` / `parseTriBool` / `addressChanged`. Out-of-vocab values are dropped (not fatal); only the studio name is required.
- **Tests:** **61 green** (`npm test`) — added the 13-test studio suite. **Verified against the live DB:** a full studio save round-trips exactly (all §7 fields + 3 styles + 2 concentrations + 1 cert; `lat`/`lng`/`geocoded_at` correctly NULL), all four check constraints reject bad data (negative staff, bad parking, bad band, year 1700) with the row left intact, and the join-table RLS is own-row-only (`authenticated`, no anon) with `studio_concentrations` public-read; seed deleted after (cascade confirmed). Typecheck + lint clean. *(Signed-in click-through needs a real magic-link session — same limitation as every prior slice — but the DB round-trip + RLS shape are proven and the pages compile clean.)*

---

## ✅ What's DONE and committed (Step 5, Slice A — The Swing: teacher availability)

The member-controlled opt-in foundation for The Swing (spec §10; the §17 consent guardrail). **Teacher-side only** — no studio side, slots, matching, dispatch, billing, or reviews (those are the next slices). Defaults confirmed with Kathleen: **miles + free-text home base now; no public "Available for Swing" badge this slice.**

- **DB migration** `20260712030000_swing_availability.sql` (**applied live + mirrored into `schema.sql` §14**): `swing_availability` (1:1 with a profile — `is_available` **defaults FALSE**, `home_location`, `travel_radius_miles` (check ≥ 0), `notes`) + `swing_styles` / `swing_levels` joins (what they'll *sub*, chosen independently from their teaching set; reuse `styles` + the 5 `levels`). **Own-row RLS** on all three (`owns_talent_profile`); an index on opted-in teachers for the future dispatch loop.
- **Profile editor** gained a **"The Swing"** section (`ProfileEditor.tsx`): an **Available for Swing** toggle — **OFF by default**, flippable anytime — that reveals styles-to-sub, levels-to-sub (5 rungs), home base, travel radius (miles), and notes. Fields stay mounted (hidden when off) so **turning off preserves your choices**. `page.tsx` loads the row; `saveProfile` upserts `swing_availability` + replaces the swing joins.
- **Pure, tested logic** (`src/lib/swing/availability.ts`): `parseSwingRadius` (clamps/floors/rejects) + `buildSwingAvailabilityRow` (normalization). The editor is already gated to active Professional members, so only they see the toggle.
- **Tests:** 48 green (`npm test`) — added the swing suite. **Verified against the live DB:** a "Swing ON" save round-trips exactly (availability + styles + levels), **toggle OFF preserves** home/radius/styles/levels (only the flag flips), and the check constraint rejects a negative radius; seed deleted after. The gated editor compiles (logged-out → login) with zero server errors; typecheck + lint clean. *(The signed-in toggle click-through needs a real session — same limitation as prior steps — but the DB round-trip and RLS shape are proven.)*

---

## ✅ What's DONE and committed (Step 4, slice 2 — the Roster: hiring actions)

The "connect" half of discovery (CLAUDE.md 4C + Open Decision 2). Founder decisions confirmed: **any active member** may save + request an intro (not their own profile — since there are no studio accounts yet); and **Accept keeps contact private** (status only, no reveal).

- **Recorded in the existing `connections` table** — no new table. `connection_type` already has `save` / `message-request`; RLS already lets the sender read/write their rows and the recipient talent read + update status. Migration `20260712020000` only adds a **unique index** (from_user, to_profile, type) so a save is idempotent + upsertable, plus a `from_user_id` index.
- **On a public `/[handle]` profile** (`ConnectActions.tsx`, shown only to signed-in active members who aren't the owner): **Save** (bookmark toggle) + **Request an intro** (a lean note; no contact revealed). Server actions in `src/lib/connections/actions.ts`, gated by `hasAnyActiveMembership` + `canConnect`.
- **`/roster/saved`** — the member's saved professionals. **`/profile/requests`** — the talent's incoming intro requests (requester **name + note only**, never contact) with **Accept** (→ responded) / **Decline** (→ closed). Nav links added on the Roster and the profile editor.
- **Email #8 "New intro request"** wired as a Resend seam (logs until the key is set) and updated in `EMAILS.md` — one transactional email to the talent on an explicit user action; no contact in it (clean-email discipline, guardrail #5).
- **Pure, tested logic** (`src/lib/connections/messages.ts`): intro-message validation + the `canConnect` gate.
- **Tests:** 41 green (`npm test`) — added the connections suite. **Verified** the full round-trip against the **live DB**: save idempotency (2 inserts → 1 row), the incoming-requests query (name + note), the saved-list query, and Accept → `responded`; then deleted the seed. Logged-out gates (`/profile/requests`, `/roster/saved` → login) and the logged-out profile render (no actions shown) confirmed in-browser. Typecheck + lint clean. *(The signed-in click-through of Save/Request/Accept needs a real session, same limitation as prior steps — but the DB round-trip + RLS shape are proven and the pages compile clean.)*

---

## ✅ What's DONE and committed (Step 4, slice 1 — the Roster: search & browse)

Built to build spec §8 + §13. Founder decisions confirmed up front: the Roster is **gated to any active membership** (§5 — browsing is a paid benefit); this slice is **search & browse only** (hiring actions are the next slice); **location = region/state now** (true radius later); and **structured cert tags were added now** so the §8 cert filter is real.

- **`/roster`** (`src/app/roster/page.tsx`) — gated by `hasAnyActiveMembership()` (logged-out → `/login?from=roster`; no active membership → `/subscribe?from=roster`). Category **tabs** by role (Teachers / Choreographers / Performers — role is a category, kept OUT of the filter bar per §8). Clean **filter bar**: style · teaching level · certification · region · state · full-text (name+bio). Honorifics show on cards as recognition but are **never filters** (§13). Result cards link to `/[handle]`; paginated (24/page); plain GET form, no client JS.
- **DB migration** `20260712010000_roster_certifications_and_view.sql` (**applied live + mirrored into `schema.sql`**): new `certifications` vocab (7 tags — ABT NTC, RAD, Cecchetti, Vaganova/Balanchine, PBT, Acrobatic Arts, Other) + `profile_certifications` join (own-row RLS) + the **`roster_profiles` view** (published+public only; pre-aggregates style/level/cert slugs as arrays for one-overlap-per-facet; `owner_active` flag so lapsed members drop out of discovery; **SELECT revoked from anon/authenticated** — server-only read).
- **Cert tags wired into the profile editor** — new "Certifications" multi-select (self-reported / searchable, not endorsed, §13); saved via `profile_certifications`.
- **Search-filter logic** is a pure, tested module (`src/lib/roster/filters.ts`): `parseRosterParams` + `profileMatchesFilters` (ANY-within-facet, AND-across-facets, region/state/text, active-owner gate).
- **Tests:** 33 green (`npm test`) — added the Roster filter suite + the `hasAnyActiveMembership` gate.
- **Verified:** ran **10 filter scenarios against the live DB** with seeded profiles (role, style, cert, level, region, state, full-text, AND-across-facets, and the active-membership gate dropping a lapsed owner) — all returned the exact expected sets; then deleted the seed. Logged-out gate → login confirmed. Typecheck + lint clean. *(A real schema mismatch was caught and fixed during this: `regions` uses `label`/`slug`, not `name`.)* The **signed-in Roster UI** couldn't be driven here (needs a real magic-link session), same limitation as the Step-3 editor — but the query is proven correct against live data and the page compiles with no errors.

---

## ✅ What's DONE and committed (Step 3 — the visual-first Professional profile)

Built to build spec §6 + the §17 guardrails. Decisions confirmed with Kathleen: **Verified Member is granted immediately at profile creation once vetting is complete** — i.e. approved (documentation-authenticity check passed) **and** paid; **no waiting period** (founder decision 2026-07-12, supersedes the old §13 ~60-day rule). The public URL is **root `/[handle]`** with a reserved-word guard; and the hero's **earned proof (Swing count + rating) is hidden until real Swing/review data exists**.

- **Gate (§17):** `/profile/edit` is now gated behind an **active Professional / Professional·Full membership**. Helper `hasActiveProfileTier()` in `src/lib/membership/access.ts` (the check that used to live inline in `/subscribe`, now shared + unit-tested). Non-members are sent to `/subscribe?from=profile`.
- **DB migration** `20260712000000_professional_profile_visual.sql` (**applied to live Supabase + in `supabase/migrations/` + mirrored into `schema.sql`**): adds `talent_profiles.honorifics`, `teaching_reel_url`, `gallery_urls`; creates public Storage buckets **`gallery`** + **`resumes`** (mirroring `headshots`).
- **Visual-first profile** (`src/app/[handle]/page.tsx`): above-the-fold hero = autoplay-muted **vertical Teaching Reel** (Vimeo/YouTube → `src/lib/profile/reel.ts`) + headshot + name/roles/location + **Verified Member** mark + **honorifics** (rendered separately, §13). Text credentials, gallery grid, résumé link, and social links live **below** the hero.
- **Native media** in the editor (`ProfileEditor.tsx` + `actions.ts`): existing headshot, new **8-image gallery** (grid, add/remove, capped at 8), **résumé/CV PDF** upload (replace/remove), **Teaching Reel** URL.
- **Approval decision transfer:** on **first** profile creation, `saveProfile` copies `applications.honorifics` + `approved_tier` (→ `choreographer_tier`) onto the profile and, once the applicant is approved (vetting complete) + paid (the gate), **grants Verified Member immediately** (`verification_flag = true`, `certified_eligible_at` = grant time). No waiting period. Honorifics/verification are **server-stamped only, never form-editable**.
- **Shareable public URL** `releveconnect.com/[handle]` at the site root, with a reserved-slug guard (`src/lib/reserved-slugs.ts`); the old `/talent/[slug]` now **redirects** there so existing links keep working.
- **Teaching levels** = the 5 seeded rungs, multi-select; **no age-group filter**.
- **Tests (CLAUDE.md #6):** stood up **vitest** (`npm test`). 17 tests green — the membership gate, the reserved-slug guard, and the reel parser. *(Roster search-filter tests come with Step 4 when that search exists.)*
- **Verified working:** public profile renders at root `/[handle]` (hero + honorifics + Verified mark + gallery + résumé, earned-proof hidden); `/talent/<slug>` redirects; logged-out `/profile/edit` → `/login`. Typecheck + lint clean on all Step-3 files. *(Pre-existing lint errors in `src/app/page.tsx` — 2 `<a>`-vs-`<Link>` — are NOT from this slice; left untouched.)*

---

## ✅ What's DONE and committed (Step 2 — commit `af16a6f`)

The full spine: **Gate → $30 fee → admin review → approve → subscribe → active.**
- **Docs reconciled** to the two ratified `/docs` specs (tier names, Charter cohorts, scope, $30 fee, marketplace earned-ladder, "Verified Member" rename).
- **DB:** `consumer` added to `account_type`; `applications` review columns + `application_fee_payments` table. **Both migrations applied to live Supabase + in `supabase/migrations/`.**
- **`/apply`** — full 13-section role-branched intake (consents + 150-word min).
- **$30 application fee** — one-way Stripe charge; waived for Founding-25; webhook → `in-review` + emails #1/#2.
- **`/admin/applications`** — queue + Approve / Approve-at-tier / Honorifics / Request-info / **Decline (auto-refunds the $30)**.
- **`/subscribe`** — approved-gated, **auto-renewing annual**, **$30 credited** via one-time coupon, **one-click cancel** (billing portal), renewal reminder; webhook activates membership + handles subscription lifecycle.
- **Stripe test Prices** created for all 6 tiers; IDs in `.env.local`.
- Emails wired as **Resend seams** (log until the API key is set); registered in `EMAILS.md`.

---

## 🔧 To make Step 2 fully LIVE-testable (Kathleen's to-dos, not blocking Step 3)

- **Stripe dashboard (test mode):** (a) enable the **Customer Portal** (Settings → Billing) so one-click cancel works; (b) set the **`invoice.upcoming`** lead time to **~14 days** so the renewal reminder lands 2 weeks out.
- **Resend:** set `EMAIL_API_KEY` + `EMAIL_FROM_ADDRESS` + `ADMIN_ALERT_EMAIL` in `.env.local`, then implement the actual sends in `src/lib/notifications.ts` (all TODO seams).
- **Full spine test recipe** (with `stripe listen` running): sign in → `/apply` → submit → $30 checkout (card `4242…`) → `/admin/applications` → Approve → `/subscribe` → activate Professional (the $30 coupon applies) → active.

---

## ⏳ Assets still owed by Kathleen (for the $499 flow + go-live — see also parallel work)
- Real **Signature Work Vimeo URLs**, her **real founder `talent_profile` id** (swap `FOUNDER_PROFILE_ID`), booking-link URLs, **Resend API key**.

## 🧭 Known follow-ups / open TBDs (do not guess — ask)
- **TBD:** the Established marketplace sales threshold; the Legacy/Vanguard co-production splits.
- **Founding-25 invite mechanism** (how `is_founding_25` gets set → fee waived) — not yet built.
- **Auto-save + 14-day resume link** on `/apply` — **required before the intake opens to real applicants** (a long essay form with no save loses people).
- **$499-flow cleanups** (left untouched deliberately): buyers filed as `account_type:'talent'` and free bundle tier `'access'` → should become `'consumer'` / `live_pass` now that those exist.
- `reviewed_by` is null (token admin has no user id); `forfeited` fee state isn't auto-set (needs a later sweep for approved-but-never-subscribed).

## 🗄️ Backup — ✅ DONE (2026-07-11)
- **This repo is now backed up to a private GitHub repo:** `https://github.com/kathleenkilcoyne/releve-connect-platform` (owner: kathleenkilcoyne). The default branch was renamed **`master` → `main`**, `origin` is set, and all 11 commits through `6ab286b` are pushed. Auth is via Git Credential Manager on Windows (browser sign-in).
- **Going forward, saving work is just `git push`** — no more setup. Push after each milestone.
- Note: Brent's original, near-empty repo `kathleenkilcoyne/releve-phase-1` is left untouched for history — the live build lives in **releve-connect-platform**.
- *(One-time snag during first push: an interrupted paste left stale `.git/index.lock` + `.git/config.lock` and a corrupted `.git/config`; repaired by clearing the locks and rewriting a clean config with the `origin` remote. Fully resolved — noted here only so the history is transparent.)*

## 🗓️ TOMORROW — agreed to-do list (2026-07-12)
*Captured with Kathleen at end of 2026-07-11 session. Confirm order at start; ask on anything TBD.*

1. **Decision locked — MailerLite stays.** MailerLite is the **campaign / marketing engine** (newsletters, the College/University advertising pitch, and a dancewear-advertiser campaign — Bloch, Capezio, Sansha, Gaynor Minden, La Duca). **Resend** stays the **transactional** engine inside the platform. Do **not** merge the two.
2. **Wire MailerLite into the platform (turn the dormant seam on).** In `src/lib/notifications.ts` the `addBuyerToClimb()` + `fireMailerLiteTag()` functions are built but no-op until env is set. Add `MAILERLITE_API_KEY` + `MAILERLITE_CLIMB_GROUP_ID` to `.env.local`. **The live "The Climb" group id is `190391571162596878`** (14 subscribers, confirmed 2026-07-11). Then map lifecycle tags (approved / declined / active) → their groups.
3. **Step 3 — visual-first Professional profile** (the documented pick-up point above). Only start after re-reading build spec §6 + §17.
4. **Make Step 2 live-testable** (config, not code): set the Resend `EMAIL_API_KEY` and implement the sends; enable the Stripe Customer Portal + set the `invoice.upcoming` lead time (~14 days).

*Reference for context: MailerLite account `relevewerise@gmail.com`; "The Climb — Issue 01" sent 2026-07-06 to 14, delivered 100%.*

---

*— together we rise · nous nous levons · relevé —*
