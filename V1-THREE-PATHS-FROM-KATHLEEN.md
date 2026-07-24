# Claude Code Handoff — Stable V1: three clean paths, lean & extensible
*Kathleen · July 24, 2026 · for the next Claude Code session on `releve-connect-platform`*

## Objective
Ship a **stable Version 1** that reflects the updated architecture. **Not a redesign.** The site must clearly present distinct paths for its audiences without confusing a visitor, and the **family profile / calendar / dashboard foundation must be built into the data architecture now** so it never needs rebuilding — while the family *feature set* stays lean.

## Build philosophy (the guardrail for every decision)
**Lean, extendable, extensible — over feature-complete.** Build the *foundations* now (roles, entities, routing, schema) so nothing gets torn out later; **defer the full feature sets.** Every addition must strengthen the core experience, never delay launch. When in doubt: lay the extensible foundation, ship the minimal surface on top.

---

## Theme & homepage language (verbatim)
**One platform, three experiences.** One authentication system, one calendar engine, one data platform — **different experiences depending on who signs in.** The theme is three verbs, one per audience:

**Professionals → Apply · Studios → Partner · Families → Join**

**Homepage copy — use verbatim.** Header over the three-path block:

> ## Build your future.
> - **Professionals:** Apply to the Professional Roster.
> - **Studios:** Become a Founding Studio.
> - **Families:** Join Through Your Studio.

*Enforcement note: "Join Through Your Studio" is not just copy — the `/join` flow is **studio-gated at the data layer** (requires a participating-studio invite/code). A family cannot create a profile without their studio, even if they misread the button. Words + architecture both prevent open family signup.*

*(The hero "trillions of stars" headline stays as the emotional opener; "Build your future." headers the three-path fork beneath it — unless Kathleen says otherwise.)*

**Optional supporting sublines** (Kathleen to approve or cut — one line under each button; they help visitors self-select and reduce confusion):
- **Professionals** — *Vetted teachers, choreographers, and performers. Build your credentialed profile.*
- **Studios** — *Bring your studio and your competition families into the ecosystem. By invitation.*
- **Families** — *With a participating studio? Create your family's "This Week."*

---

## The three paths (present them so no visitor is confused)

### 1. Professional — the primary CTA (unchanged)
- **Apply to the Professional Roster.** A **vetted, credentialed application, professionals only** (teachers, choreographers, adjudicators, studio owners, industry pros).
- Stays the dominant hero CTA at `/apply`. **Do not dilute it.** Families never apply here.

### 2. Studios — "Become a Founding Pilot Studio / Request Information"
- **Not self-serve in V1.** Studios are onboarded **manually / white-glove by Kathleen** (5 hand-picked pilots: Tate, Dreammakers, NY PAC, +2).
- Site surface = a short **interest / request-information form** → notifies Kathleen → she onboards them personally.
- **Build the `studio` entity into the data model now** (a studio can later invite its families); **defer** the self-serve studio signup + billing flow.

### 3. Families — "Join through your studio"
- Families **do NOT apply to the Professional Roster.** They **create a Family Profile after joining through a *participating* studio.**
- **Studio-gated:** entry requires an invite/code from a pilot studio (guardian-managed account). No open public family signup in V1.
- Outcome = a **private, guardian-managed Family Profile** + the **"This Week" calendar/dashboard** (reuse the existing **Ava · Student** model / `ThisWeekScreen.tsx`). Never appears on the public Roster.

> Copy discipline everywhere: professionals **apply**, studios **request / are invited**, families **join through their studio**. A parent must never see "Apply" as their path.

---

## Architecture to build NOW (so there's no rebuild later)
These are foundations, not features — lay them in V1 even if the surface is minimal:
1. **Role model** — `Professional` / `Studio` / `Family-guardian` (+ `Student` under a guardian). Role drives **data model + dashboard view**.
2. **Studio entity** — exists in the schema now; can **invite/enroll families** (studio code or invite link), even though studios are onboarded manually.
3. **Family Profile + guardian account + "This Week" calendar** — wired to a real account, private, guardian-owned.
4. **Dashboard-by-role routing** — one shared calendar engine, different surface per role (Professional / Studio / Family). "The dashboard changes depending on who signs in."

## Explicitly DEFER (don't build in V1 — but don't foreclose)
- Self-serve **studio signup + billing** (manual for the pilot).
- **Live Pass** premium/upgrade billing (guardian-billed; architect the entitlement flag, defer the paywall).
- **Public minor profiles** and the **age-18 → Professional Roster** conversion (pending legal — build the pipe, gate the launch).
- **Marketplace / licensing** storefront (roadmap).

---

## Do NOT touch / guardrails
- `/apply` and the professional flow stay **unchanged and primary.** No family/minor fields added to it.
- **Public Roster = professionals only.** Family/student profiles are private and never surface there.
- **Minor data is guardian-managed and private.** No public-facing minor profile ships; consent/COPPA gating is **pending Marshall Law**.

---

## Definition of done (stable V1)
1. Homepage presents three unconfusable paths: **Apply** (professional, primary) · **Become a Founding Pilot Studio / Request Info** (studios) · **Join through your studio** (families).
2. Studio interest form works and notifies Kathleen; **no self-serve studio account** is created.
3. A **participating studio can invite families**; a family can **create a guardian-managed Family Profile + "This Week" calendar**, landing in the Family dashboard.
4. Role model, studio entity, and dashboard-by-role routing exist in the schema — the family layer is **extensible without a rebuild.**
5. `/apply`, the Professional Roster, and its CTA are untouched; family/student profiles never appear on the public Roster.
6. Nothing half-built is shipped: every path that's visible works; deferred items are cleanly absent, not broken.

*— together we rise · nous nous levons · relevé —*
