# Prompt for Claude Code — Professional Identity: Slice 0 (Safety + Access), Slice 1 (My Professional Home), Slice 2 (Threaded Messages)

You are working in the **Relevé Connect** repo (Next.js + Supabase). Full context and reasoning: read **`PROFESSIONAL-IDENTITY-ARCHITECTURE.md`** (and `PRICING-AND-ROSTER-VISIBILITY-DIRECTION.md`) at the repo root first. Build the three slices **in order**. **Slice 0 is a hard gate — do not start Slice 2 until Slice 0's safety wall is in place and tested.**

## Global constraints (apply to all slices)
- **Do NOT modify the founding-studio pilot** (invite → setup → approve → publish → This Week → "Got it") or the family/studio `communications` + `affiliations` flows. Those are proven and are Priority-0.
- **Propose migrations for review**; no destructive changes; preserve existing data.
- **Reuse existing:** `Resend` (email), `memberships` (verified/paid), `shortlists` (saves), `connections` (inquiry initiation), `talent_profiles` / `roster_profiles` (professionals), `employer_profiles` (studios). Do **NOT** reuse the `communications` table for professional messages — it is the studio↔family channel and stays separate.
- **Add tests for every slice**, especially the Slice 0 safety assertions.
- Follow the repo's existing patterns (RLS-first authorization, server actions, route structure).

---

## SLICE 0 — Safety + Access Foundation *(gating; build and verify first)*

### 0a. Adult-to-adult wall (the #1 constraint)
The professional **discovery + messaging graph is adults only: professional ↔ studio/professional.** Family/dancer communication stays **completely separate** (it lives only in the `affiliations` + `communications` + This Week world).

Enforce structurally, not just in UI:
- A messaging/discovery **participant** must be an adult identity: a user with a `talent_profiles` row (professional) **or** an `employer_profiles` row (studio/employer). 
- **Students/minors** (`students`) have **no** public profile, **no** handle, **no** discoverability, and **no** message endpoint. Confirm `students.visibility` keeps them private and that **no route renders a student publicly**.
- **Families/guardians acting in family capacity are not participants** in the professional message graph — they communicate with studios only via the existing family/studio channel.
- Add **RLS policies** so any attempt to create a conversation/message with a student or a family as a participant is rejected at the database layer (defense in depth with app checks).

**Slice 0a acceptance tests (must pass):**
- Discovery/roster queries never return students or families.
- Creating a conversation/message with a `student_id` or family participant is rejected (RLS + app).
- No public route resolves to a student/minor.
- No personal email is exposed on any public profile or in any messaging surface.

### 0b. Always-reachable professional account access
A signed-in professional can **always** reach, from any page (account menu / persistent nav): **My Profile**, **Edit Profile**, **Messages**, **Notifications**. Routes: `/profile` (authed home — built in Slice 1), `/profile/edit` (exists), `/messages`, `/notifications`. Principle: *never hunt for your own URL.*

**Slice 0b acceptance:** the four links are present and correct for a signed-in professional on every page.

---

## SLICE 1 — "My Professional Home" (authed `/profile` home)

Build the signed-in home the member lands on. Layout:
- **Welcome back, [Name].**
- **Your Professional Profile** — ✓ *Relevé Verified Professional* (only if actually verified) · **View My Public Profile** (→ `/talent/<slug>` / `/<handle>`) · **Edit Profile** (→ `/profile/edit`) · **Share Profile** (copy public link / share).
- **Messages** (link + unread count) · **Notifications** (link + unread count) · **Profile Activity**.
- **Profile Activity** sources what data exists now: **saves** = `shortlists` count; **inquiries** = `connections` count; **profile views** = a simple counter (add a lightweight `profile_views` table: viewer_id nullable, profile_id, created_at — count only for now; identity-level "who viewed" is a later paid feature).
- **Your Relevé** entry points: Senior Spotlight · Professional Opportunities · The Beat · Swing *(show only when active)* · Your Offerings. Link to existing surfaces where they exist; placeholder cards otherwise.
- **Graceful empty states** — early accounts will have little activity; use warm empty copy, never a dead "0."

**Slice 1 acceptance:** signed-in professional lands on `/profile` and sees greeting, verified state, View/Edit/Share, Messages + Notifications with unread counts, Profile Activity (saves/inquiries/views), and the Your Relevé entry points (Swing hidden when inactive), with friendly empty states.

---

## SLICE 2 — Threaded Relevé Messages

Upgrade the one-shot `connections` inquiry into **genuine two-way conversations, on-platform**.

### Data model (new, propose migration)
- `conversations` — id, participant_a (user_id), participant_b (user_id), created_from_connection_id (nullable, to link/seed from existing `connections`), created_at, last_message_at. Both participants MUST be adult professional/studio identities (Slice 0 wall).
- `messages` — id, conversation_id, sender_id, body, created_at, read_at (nullable). Unread = messages to me with `read_at IS NULL`.
- `message_blocks` — blocker_id, blocked_id (blocked user cannot start/continue a conversation with blocker).
- `message_reports` — reporter_id, conversation_id/message_id, reason, created_at (surfaced to admin).

### Flow
1. A public profile shows a **"Message [Name]"** CTA (separate from transactional **Book / Request / License**).
2. Clicking it **requires sign-in** — an anonymous visitor is prompted to sign in / create an account (this keeps every message accountable and enforces adult-to-adult; anonymous DMs are not allowed). The initiating account must be an adult professional/studio identity.
3. On send → create (or reuse) the conversation + first message.
4. Recipient gets an **in-app notification** *and* an **email via Resend**: *"You have a new professional message on Relevé"* with a deep link to the thread. **No personal email is exposed** — replies happen on-platform.
5. Recipient opens `/messages`, sees the thread with **unread state + timestamps**, and replies inline.

### Required features
Unread state · timestamps · email notification on new message (Resend) · **block/report** · **no public email exposure** (all on-platform) · adult-to-adult enforcement (Slice 0) · basic **rate limiting** on initiation to deter spam.

**Slice 2 acceptance tests:**
- Full loop: signed-in adult A messages professional B from B's public profile → B gets in-app + email notification → B opens thread, unread flips to read on view, replies → A sees the reply. Timestamps correct.
- Blocking: a blocked user cannot initiate/continue; report creates an admin-visible record.
- Safety: cannot create a conversation/message with a student or family participant (RLS + app); no email address rendered anywhere in the messaging UI.
- Anonymous visitor is prompted to sign in before sending.

---

## Sequencing & done criteria
Build **Slice 0 → verify safety tests green → Slice 1 → Slice 2.** Keep the founding-studio pilot untouched and Priority-0 throughout. When done, summarize: migrations added, RLS policies added, routes/components changed, tests added, and the manual walkthrough steps for each slice.
