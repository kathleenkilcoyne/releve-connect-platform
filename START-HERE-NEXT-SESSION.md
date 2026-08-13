# START HERE — Next Session (Relevé Connect / Cowork)

*For Kathleen + Claude. Last session: 2026-08-08. Goal for next session: **verify the professional-identity build (Slices 0–2), then start Slice 3 (Notifications center + preferences).***

## Where we are (one breath)
The **founding-studio pilot is proven end-to-end** (invite → setup → approve → publish → This Week → "Got it"), the one blocker we found is **fixed and verified live**, and we've teed up the **professional-identity build** (Slices 0–2) for Claude Code. Test studio/family/dancer records are **preserved** (unpublished, private).

## ✅ Done
- Full onboarding dress rehearsal passed → `DRESS-REHEARSAL-TEST-REPORT-2026-08-08.md`.
- Blocker (family joins not showing in admin/roster) diagnosed + **fixed** (reads now source from `affiliations`) + retested (1 family / 1 dancer, "Got it" loop, Publish/Unpublish).
- Pricing/identity model decided → `PRICING-AND-ROSTER-VISIBILITY-DIRECTION.md` (free public identity layer; monetize the capture side).
- Full architecture written → `PROFESSIONAL-IDENTITY-ARCHITECTURE.md`.
- Build prompt for Slices 0–2 written → `PROFESSIONAL-HOME-AND-MESSAGES-CLAUDE-CODE-PROMPT.md`.

## 🔧 In flight (check status first tomorrow)
- **Claude Code building Slices 0–2** (Safety+Access → My Professional Home → Threaded Messages). It was told to **stop after Slice 0** for review.
- **Founding-rate copy** (free through Dec 31, 2026) — per `PRICING-AND-ROSTER-VISIBILITY-DIRECTION.md`.

## 👉 Tomorrow — do these in order
1. **Check the Slice 0–2 build.** In Claude Code, ask for its summary. **Review Slice 0's safety wall** before anything builds on it: confirm discovery/messaging is adult↔adult only and families/dancers are fully walled off (tests green).
2. **Retest the professional home** once Slice 1 lands: sign in → land on `/profile` → View / Edit / Share / Messages / Notifications / Profile Activity all reachable.
3. **Start Slice 3 — Notifications center + preferences.** Ask Claude (Cowork) to generate `SLICE-3-NOTIFICATIONS-CLAUDE-CODE-PROMPT.md` (scope below), then hand it to Claude Code.

## Slice 3 scope (so we can write the prompt fast)
A unified **professional notification system** (net-new; keep separate from the family/studio `communications` table):
- **Types:** 💬 Messages · 👁 Profile (views) · ⭐ Interest (saved = `shortlists`) · 🎓 Teaching (inquiry = `connections`) · ⚡ Swing · 🎭 The Beat (match) · ✨ Senior Spotlight.
- **Notification center** (`/notifications`) with **unread state** + timestamps + deep links.
- **Preferences center:** per-type × per-channel. Channels = **in-app + email now; push deferred.**
- Wire the signals that already have data (Messages from Slice 2, saves from `shortlists`, inquiries from `connections`) to generate notifications; email via **Resend**.
- Safety: notifications never reference or reach minors/families.

## ⏳ Open decisions to make (name them tomorrow)
- **"Who viewed you"** privacy: aggregate count free, viewer identity premium? *(recommended)*
- **Message initiation:** sign-in required (currently baked in) vs a lighter path?
- **Push notifications:** defer? *(recommended — email + in-app first)*
- **Pro paid-tier timing:** after network density; studios monetize first.
- **Founding-studio rate number** to insert in the copy.

## 🗂 Repo file map (the chain, in reading order)
1. `PROFESSIONAL-IDENTITY-ARCHITECTURE.md` — the full architecture + honest pushback.
2. `PRICING-AND-ROSTER-VISIBILITY-DIRECTION.md` — free identity / paid capture + founding-rate copy.
3. `PROFESSIONAL-HOME-AND-MESSAGES-CLAUDE-CODE-PROMPT.md` — Slices 0–2 build prompt.
4. `BLOCKER-FAMILY-JOIN-ROSTER.md` + `FAMILY-JOIN-ROSTER-FIX-CLAUDE-CODE-PROMPT.md` — the fixed blocker (done; keep for reference).
5. `DRESS-REHEARSAL-TEST-REPORT-2026-08-08.md` — full test record.
6. `FAMILY-ENGAGEMENT-IDEAS-FROM-KATHLEEN.md` — backlog (RSVP, reminders, entry-tied notes, etc.).

## 🧪 Preserved test records (delete when done retesting)
- studio `employer_profiles` `696d53cc-604b-42a2-a5c0-e4d81442e206` (approved, unpublished)
- join code `RELE-4Z4W` · family `b650402a-f6a9-4d00-b5ff-2dc0800f216c` · dancer `aeca1e93-42c7-410f-b369-1879c44b62c6` · affiliation `8750e2bb-b6bf-4fa2-b84f-c6d38b5e1620`
- test emails → `kathleen+teststudio@releveconnect.com`

## 📣 Other threads (not code)
- Web analytics **live** (Vercel Web Analytics deployed) — watch traffic when you post.
- **Studio outreach:** tracker + 20-studio list + one-pager + 3 social cards all ready; Issue 2 sent to real subscribers; social launch aimed at Fri (announce + invite ~5 founding studios).
