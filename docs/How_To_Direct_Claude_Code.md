# How to Direct Claude Code — Founder's Playbook
*Created 2026-07-12 (Kathleen + Cowork). You are the **product owner**, not the engineer. You direct Claude Code by pointing at the plan, approving, and verifying by watching — never by reading code.*

---

## The 5-beat rhythm (run this every session)

1. **Point, don't explain.** Open Claude Code and say:
   > *"Read RESUME-HERE.md and the spec it points to, then tell me your plan before you write any code."*
   It reads its own notes and proposes; you approve. This one habit prevents most drift.

2. **One slice per session.** Give it a single vertical goal, not a wishlist. "Gate the profile editor behind membership" is a session. "Build the profile system" is not.

3. **State the guardrails every time.** Two phrases do the heavy lifting:
   > *"Ask me about anything not specified — don't guess."*
   > *"Follow the guardrails in CLAUDE.md."*

4. **Verify by seeing, not reading.**
   > *"Show me it working — run it and walk me through what changed in plain English."*
   Watching the profile publish and appear in search beats reading a diff.

5. **Save at the end — always.**
   > *"Commit this, push to GitHub, and update RESUME-HERE.md with the new pick-up point."*
   (GitHub is now set up — `kathleenkilcoyne/releve-connect-platform`. Backups are a one-line `git push`.)

---

## Red flags — when to slow it down
- It starts changing **pricing, tier names, or auth** → **stop.** Those are ratified (Supabase Auth, the 6 tiers, "Creator" for $199).
- It **assumes** a TBD instead of asking → tell it to ask.
- It builds **more than the one slice** → rein it back to scope.
- It wants to **skip tests** on the intake emails or search → no; those are the two flows that can't break (CLAUDE.md Guardrail #6).

---

## Copy-paste prompt library

### ▶️ NEXT SESSION — Step 3: the visual-first Professional profile
> We're starting **Step 3 — the visual-first Professional profile.** Before writing any code:
> 1. Read `RESUME-HERE.md` and `docs/Releve_Connect_Member_Platform_Build_Spec_2026-07-11.md` **§6 and §17**.
> 2. Tell me your plan for this session and confirm scope with me **before** coding.
>
> **Scope — do only this slice:**
> - **Gate `/profile/edit`** behind an **active Professional membership** (`memberships.membership_status='active'` on a `professional` or `professional_full` tier; helper in `src/lib/membership/`). It's currently open to any signed-in user — close that gate first.
> - **Visual-first profile (§6):** above-the-fold hero = autoplay-muted **vertical Teaching Reel** + headshot + name/roles/location + earned proof (completed-Swing count + rating); text credentials **below** the hero.
> - **Native media via Supabase Storage:** headshot (exists), an **8-image photo gallery grid**, résumé/CV **PDF upload**, **Teaching Reel** (Vimeo/YouTube).
> - **Shareable public URL** `releveconnect.com/[handle]`, public visibility gated to Professional tier.
> - **Carry the approval decision onto the profile:** transfer `applications.honorifics` + `approved_tier` + the **Verified Member** mark onto the `talent_profile` at creation.
> - **Teaching levels = the 5 seeded rungs**, multi-select; **no age-group filter.**
>
> **Rules:**
> - Ask me about anything not specified — **don't guess** (especially TBDs).
> - Follow the guardrails in `CLAUDE.md` (no-tax-on-labor, clean email discipline, tests on intake emails + search).
> - **Do NOT touch pricing, tier names, or auth** — ratified.
> - When done: **show me it working** (run it, plain-English walkthrough), then **commit, push to GitHub, and update `RESUME-HERE.md`.**

### 🥁 AFTER Profiles ship — The Beat schema
> Read `docs/The_Beat_Build_Plan_2026-07-12.md` and build **exactly** the schema/RLS prompt in it. **Supabase Auth, not Clerk.** Ask me the doc's **open questions** before writing migrations. Schema + RLS only — no Stripe flow, no UI.

### 🧩 Template — any future session
> Read `RESUME-HERE.md` and the spec it points to. The slice for today is **[ONE goal]**. Confirm your plan before coding. Ask on anything unspecified. Follow `CLAUDE.md` guardrails. When done, show me it working, then commit + push + update `RESUME-HERE.md`.

---

*— together we rise · nous nous levons · relevé —*
