# Relevé — Professional Identity, Connection & Activity Architecture

*Direction for Claude Code. 2026-08-08. Synthesizes the "four principles" thread + our Cowork decisions, mapped to the ACTUAL Supabase schema (project `hmqqxbkhcqspqmsjxodq`). Grounded, not aspirational: most substrate already exists — evolve deliberately, don't rip anything apart. **Read the "Honest pushback" section (§9) — some of it is load-bearing, especially child-safety.***

---

## 0. Scope guardrail (read first)
This is the **professional / supply side**. The **founding-studio pilot** (studios + families + This Week + Got It) is a *different surface* and is **already proven working**. Do **not** derail the pilot to build this. The pilot stays Priority-0; this ships in slices behind it (see §7).

## 1. The four locked principles
1. **Public professional identity** — your Relevé page represents you publicly.
2. **Private professional connection** — messages/inquiries happen safely inside Relevé.
3. **Professional activity** — views, saves, inquiries, opportunities, products create meaningful notifications.
4. **Paid professional utility** — Relevé charges for tools that help pros *do more*, never for the privilege of existing.

---

## 2. The layers — specific, and mapped to what exists

### A. Public Identity Layer — FREE
The vetted professional gets, free: **public profile** (`/<handle>` = `/talent/<slug>`), **Relevé Verified Professional** badge, **public inclusion/discoverability** (indexable), a **shareable URL**, and the **ability to receive** legitimate professional messages.
- **Exists:** `talent_profiles`, `roster_profiles`, `/talent/[slug]` + `/[handle]` routes, `verification_flag` / `profile_status` / `visibility`.
- **Rules:** Verified is **earned** via the vetting queue (`applications`), never automatic. Enforce handle uniqueness + reserved words + anti-impersonation. Unpublish → 404 (pattern already proven on studios).

### B. Private Connection Layer — the conversation layer
Separate two intents on the profile:
- **Message** (relational) — "ask Geoff a question," "discuss a residency," "ask about a piece."
- **Book / Request / License** (transactional) — a structured request object.
Message is a **genuine two-way, threaded conversation inside Relevé** — not a one-shot lead form.
- **Exists:** `connections` (`from_user_id`, `to_profile_id`, `type`, single `message`, `status`) — good for the **initiation/request**, but it is **one message, not a thread**.
- **Net-new:** a `conversations` + `messages` model (or a `messages` child of `connections`) for real back-and-forth, all **on-platform** (no exposed personal contact).
- **Safety gates (non-negotiable — see §9):** only **verified/known parties** may initiate; report/block; rate limits; and the messaging graph is **adult professional ↔ studio ONLY**. It must be **impossible to message a minor/dancer/family** through this layer. Family notices stay in the separate `communications` table (studio↔family), walled off.

### C. Professional Activity Layer — signals → notifications
Signals and where they live:
- **Profile views** → *net-new* `profile_views` (viewer, viewee, ts).
- **Saves / Interest** ("a studio saved your profile") → **`shortlists`** (exists).
- **Inquiries** → **`connections`** (exists).
- **Opportunities / matches** → **`beat_postings`**, **`swing_*`** (exist).
- **Reviews / reliability** → **`reviews`** (exists).
Unified **professional notification system (net-new)** — types: 💬 Messages · 👁 Profile (views) · ⭐ Interest (saved) · 🎓 Teaching (inquiry) · ⚡ Swing · 🎭 The Beat (match) · ✨ Senior Spotlight (choreography inquiry).
- **Channels:** in-app + email **now**; push **later** (defer — needs web-push/app infra).
- **Member controls** which signals notify, and on which channel (a preferences center).
- **Note:** the studio/family side already has `communications` (with `read_at`) for This Week — keep the professional notification system **separate** from it.

### D. Paid Utility Layer — monetize "do more," not "exist"
- **Free forever:** identity, Verified, discoverability, inbound messaging.
- **Paid tools:** advanced profile analytics · **who** viewed/saved you · enhanced discovery placement · opportunity matching · Swing access · Senior Spotlight licensing tools · teaching/choreography marketplace tools (The Beat) · scheduling · payments · business tools · advanced messaging/inquiry management · portfolio upgrades · work/product analytics · professional development resources.
- **Exists:** `memberships` (tier / price_cents / term / Stripe / status / source), `beat_*`, `swing_*`.
- **Sequencing (see §9):** near-term revenue is the **studio hub** (founding studios → paid after Dec 31, 2026). Professional paid tiers come **after** the network has enough activity that the tools are worth paying for.

---

## 3. The "My Profile" home (daily reason to return)
On login, first thing the member sees:
> **Welcome back, [Name]**
> **Your Professional Profile** ✓ Relevé Verified Professional — View | Edit | Share
> 🔔 Notifications · 💬 Messages · 👁 Profile Activity
> **Your Relevé:** Senior Spotlight · Professional Opportunities · The Beat · Swing *(when active)* · Your Offerings

Principle: **never hunt for your own URL** — one-click "My Profile." (Route: authed `/profile` home distinct from the public `/talent/<slug>`.)

## 4. The discovery → message → notify loop (precise)
Someone discovers [pro] → opens `releveconnect.com/<handle>` → sees the work → clicks **Message** → a conversation is created **on-platform** → pro gets in-app 🔔 **and** email *"You have a new professional message on Relevé"* (deep-links back) → pro returns → replies in the **Messages** inbox. Transactional **Book / Request / License** creates a different object + its own notification.

## 5. Roles & safety boundaries (the spine)
Three identities: **Professionals** (`talent_profiles`), **Studios/Employers** (`employer_profiles`), **Families/Students** (`family_accounts`/`students` — **includes MINORS**).
- The public **discovery + DM graph is ADULT professional ↔ studio only**.
- **Families/students are NOT in the public discovery or messaging graph.** Student data stays private (`students.visibility`), reachable only via the guardian and the studio's This Week (`affiliations` + `communications`).
- Keep these two worlds architecturally separate; never let a discovery/DM path touch a minor.

## 6. Exists vs. net-new (evolve, don't rebuild)
| Capability | Status | Table(s) |
|---|---|---|
| Public profile + handle + verified | ✅ exists | talent_profiles, roster_profiles, routes |
| Save a pro ("studio saved you") | ✅ exists | shortlists |
| Inquiry / connection request | ✅ exists (one-shot) | connections |
| Reviews / reliability | ✅ exists | reviews |
| Memberships / paid tiers | ✅ exists | memberships (+ Stripe) |
| Marketplace / opportunities | ✅ exists | beat_*, swing_* |
| Studio↔family notices | ✅ exists | communications (read_at) |
| **Threaded professional Messages** | 🚧 new | conversations + messages |
| **Profile views / activity** | 🚧 new | profile_views |
| **Unified pro notifications + prefs** | 🚧 new | notifications + notification_prefs |

## 7. Recommended build slices (ship without stalling the pilot)
- **Slice 0 (small, high value):** one-click **My Profile** home + Profile 2.0 polish (View/Edit/Share). Low risk.
- **Slice 1:** surface signals that already have data — **Interest** (shortlists) + **inquiry** (connections) + a **profile-view** counter → **in-app + email notifications**.
- **Slice 2:** **Messages** (threaded conversation) with sender gating + report/block + on-platform routing.
- **Slice 3:** **Notification center + preferences/channels**; surface **opportunity matches** (Beat/Swing).
- **Slice 4:** **Paid professional utility** tier (analytics / who-viewed / placement) — **only after** real activity exists.
- Founding-studio pilot remains **Priority-0** the whole time.

## 8. Open decisions (Kathleen's calls)
- **Who-viewed privacy:** aggregate count free, viewer **identity** premium? *(recommend yes — protects viewers, matches norms.)*
- **Who can initiate a message:** any signed-in user, or **verified members only**? *(recommend verified members.)*
- **Push notifications:** now or **defer**? *(recommend defer; email + in-app first.)*
- **Split Message vs Book/Request/License** CTAs on the profile? *(recommend yes.)*
- **Pro paid-tier timing:** *(recommend after network density; studios monetize first.)*

## 9. Honest pushback (the load-bearing part)
1. **Child safety is the #1 architectural constraint.** You have minors on the platform. The professional discovery + messaging graph must be **adults only** (pro↔studio). It must be structurally impossible to discover or message a dancer/family through this layer. Build the wall in the data model, not just the UI.
2. **Sequence it — protect the pilot.** You just proved the founding-studio path works. This professional build is a *different surface*; do it in slices behind the pilot, or you risk stalling the thing that's already working.
3. **Messaging is a real system + a moderation surface.** Threads, spam/abuse, block/report, rate limits. Gate the **sender** (verified/known), route everything on-platform. Don't ship open DMs.
4. **Defer push notifications.** Email + in-app first; push needs infra and invites fatigue. And decide the **"who viewed you"** privacy model before you show viewer identities.
5. **Monetize studios first, pros later.** The founding-studio hub is your near-term revenue. Professional paid tiers only make sense once there's activity worth paying for — otherwise "paid utility" accidentally becomes "pay to exist," the exact thing you're avoiding.
6. **Keep "Verified" earned.** The badge's value is the vetting behind it. Tie it to the applications queue; never auto-verify on signup.
7. **Beat the cold-start.** Early dashboards will show low numbers ("0 views"). Seed real value (editorial opportunities, Senior Spotlight, curated matches) so the daily loop has substance before the network is dense — otherwise the "reason to return" rings hollow at first.

*The model is right and mostly buildable on what you have. The two things I'd hold firm on: the child-safety wall (§5/§9.1) and the sequencing (§9.2). Everything else is a healthy, staged evolution.*
