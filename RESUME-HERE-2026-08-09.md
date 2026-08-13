# ▶ Start Here / Resume Here — 2026-08-09 (end of day)

*A plain-English handoff so tomorrow starts in five minutes, not fifty. Written for Kathleen + Claude Code.*

---

## 30-second status
Everything built today is **live on production** (releveconnect.com) and **manually tested green**. Three things shipped, in order:
1. **Family-join fix** — admin "families joined" count + studio roster now read from `affiliations` (one source of truth). ✅ tested
2. **"Got it" acknowledgement** — family taps a This Week event → grey→green ✓; studio sees "M of N acknowledged." Targeted + studio-wide. ✅ tested both sides
3. **Professional Identity — Slice 0** (safety wall + always-reachable nav). ✅ deployed, wall verified against real users

**Nothing is broken or half-deployed.** The founding-studio pilot is untouched and still Priority-0.

---

## The one decision waiting on you
**Slice 2 (Messages) has one baked-in rule: sending a message requires the sender to sign in first** (no anonymous DMs — for accountability + child safety). It's in `PROFESSIONAL-HOME-AND-MESSAGES-CLAUDE-CODE-PROMPT.md`. Keep it, or tweak before Slice 2 is built. **Default = keep as-is.**

---

## What to do next (pick up here)
**Slice 1 — "My Professional Home"** at `/profile` (currently a placeholder). Full greeting + Verified status + View/Edit/Share + Messages/Notifications unread counts + Profile Activity (saves = `shortlists`, inquiries = `connections`, views = new lightweight `profile_views` counter). Then **Slice 2 — threaded Messages** (builds on the Slice 0 wall).

> To resume, tell Claude Code: **"Continue the professional build — do Slice 1."**
> Reading order for full context: `PROFESSIONAL-IDENTITY-ARCHITECTURE.md` → `PRICING-AND-ROSTER-VISIBILITY-DIRECTION.md` → `PROFESSIONAL-HOME-AND-MESSAGES-CLAUDE-CODE-PROMPT.md`.

---

## What Slice 0 actually put in place (so we don't re-litigate it)
**0a — the adult-to-adult safety wall (the load-bearing part):**
- New DB functions `is_professional_actor(user)` / `both_professional_actors(a,b)` — a discovery/messaging participant must be a **professional** (`talent_profiles`) or **studio** (`employer_profiles`). Students/minors + family guardians are **never** participants.
- Verified live: pilot family guardian → `false`, professional → `true`, studio → `true`.
- Slice 2's `conversations`/`messages` tables will **enforce** with `both_professional_actors(...)` — the wall lands in the data model, not just UI.
- Public handles hardened: `students / family / dancers / messages / notifications` etc. can never be claimed.

**0b — always-reachable nav:** slim server-gated bar (My Profile · Edit Profile · Messages · Notifications), shown **only to professionals** → never appears on the family/studio pilot surfaces.

**Placeholders (intentional — Slice 1/2 flesh these out):** `/profile`, `/messages`, `/notifications` are gated "coming soon" stubs today.

---

## Still open (small, not blocking)
- **Founding-rate copy** — the last backlog item. Update `/studios/join`, the studio invitation email, and the admin "complimentary membership" note to read: **"Founding Studios join free through December 31, 2026 — then our standard studio membership."** (See `PRICING-AND-ROSTER-VISIBILITY-DIRECTION.md` §5; real price number is TBD from Kathleen.) Quick, low-risk copy change whenever.
- **Studio approval/welcome email** — ✅ RESOLVED. A you're-live email (`studio-live.v1`, subject "{Studio} is live on Relevé") already fires on **Publish**. No new email needed unless you want one on **Approve** too (optional).

---

## Facts worth having on hand
- **Prod:** Vercel project `releve-connect-platform` → releveconnect.com. Supabase project `hmqqxbkhcqspqmsjxodq`.
- **Deploy pattern that's been working:** apply the Supabase migration **first** (verify it), **then** push `main` → Vercel auto-deploys → confirm ● Ready + aliased to releveconnect.com.
- **Latest commit:** `5e54115` (Slice 0). Earlier today: `33d9d13` (Got it), `f8e3eb2` (family-join fix).
- **Preserved pilot test records — do NOT delete:** studio `696d53cc-604b-42a2-a5c0-e4d81442e206` · family `b650402a-f6a9-4d00-b5ff-2dc0800f216c` · dancer "test" `aeca1e93-42c7-410f-b369-1879c44b62c6` · affiliation `8750e2bb-b6bf-4fa2-b84f-c6d38b5e1620` · event "Test Solo Private" `fe2281be-ae2e-4243-9e86-b984c5676d57`. The Test Studio is currently **unpublished** (private) — Kathleen unpublished it after testing.
- **Guardrails still in force:** no-tax-on-labor; profile is the product; studios ≠ talent; child-safety wall (adults-only discovery/messaging); clean email discipline (every automated email is in `EMAILS.md`).

---

*together we rise · relevé*
