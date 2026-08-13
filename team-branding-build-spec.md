# Team Branding — Build Spec ("Your team's space")

*Co-branded organization identity for Relevé Connect. One branding system on `employer_profiles` serves **studios, college teams, and professional teams** alike. Relevé stays the platform frame; the member's org fills the room. Companion to the Dance Teams umbrella addendum.*

**Status:** Decided in shape — defaults noted below, adjust freely · **Owner:** Kathleen Kilcoyne

---

## The idea

A member should open This Week and instantly feel they're **inside their own team's space** — their logo and name above the calendar — while **Relevé Connect remains visible as the platform brand**. Co-branding, not a takeover. The same fields brand a studio dancer's page and a college/pro team member's page, because branding lives on the organization, not the org *type*.

Foundation already exists: `employer_profiles` has `logo_url` and the full org-profile structure; `team_type` and `member_label` were just added. This is a small, additive extension.

---

## Decisions (defaults — change any)

- **Accent colors:** a **primary accent** (required-optional — used if set) plus an **optional secondary**. One is harder to misuse; two gives more identity. *Default: primary + optional secondary.*
- **Motto:** short and optional, **≤ 60 characters** (a tagline, not a paragraph). *Default: on, ≤60.*
- **Show branding on the join reveal too:** yes — *"You're joining {logo} Test College Dance Team"* is a lovely confirmation moment and costs little once the fields exist. *Default: yes.*

---

## Data model (additive)

On `employer_profiles`:
- `logo_url` — **already exists**; the uploaded logo/mascot. Reused.
- `brand_accent` (new, `text`, nullable) — primary accent, hex `#RRGGBB`.
- `brand_accent_2` (new, `text`, nullable) — optional secondary accent, hex.
- `team_motto` (new, `text`, nullable) — short tagline; enforce ≤ 60 chars (DB check + form).

**Storage:** logos upload to a Supabase Storage bucket (e.g. `org-branding`), path scoped per employer (`{employer_id}/logo.*`). Public-read is fine (a logo isn't sensitive); the upload writes the object and sets `employer_profiles.logo_url`. Constrain to PNG/JPG/SVG, a sane size cap (e.g. ≤ 2 MB), and a roughly square display crop.

---

## Who edits it

The organization's **administrator** — the Team Director (dance team) or studio owner — from the org's profile/settings. Upload logo, pick accent color(s), write the motto. Members never edit org branding.

---

## How it renders

A **co-branded team header band** sits **above the calendar** on This Week, for **both** self-managed team members and studio/family members (using their affiliated org's branding):

- **Logo** (or the initials monogram fallback) + **team name**, with the **motto** beneath if set.
- The **accent color** is used *tastefully as an accent* — the monogram background, a header rule/underline, the name treatment — **not** a full repaint of the page.
- **Relevé Connect** remains the persistent platform mark in the top chrome. The band personalizes the content; it never replaces the platform frame.

**Dependency:** this builds on the just-requested fix that resolves a member's org **from their active affiliation** (not from calendar items) — that's what gives the header an org to brand even before any events exist.

### Initials monogram fallback (no logo)
When `logo_url` is empty, render a clean monogram from the team name's initials (up to 2–3 letters from significant words, skipping "The" and parenthetical tags like "(TEST)") in a rounded tile tinted with the accent color. Always looks intentional, never broken.

---

## Accessibility guardrail (the one real nuance)

Administrators will eventually pick an accent color that, used carelessly, makes text unreadable. So:
- Apply the accent only to **safe surfaces** (monogram background, rules, chips).
- Wherever text sits **on** the accent, compute a **contrast-correct foreground** (black/white by luminance, WCAG AA), or validate the chosen color's contrast **at save time** and warn.
- Never let a team's color reduce legibility of the calendar itself.

(The `brand-guidelines` and `dataviz` design skills are good references for tasteful, accessible accent treatment.)

---

## Scope boundaries

**Build now:** the fields, the admin upload/settings, the co-branded This Week header (both member types), the monogram fallback, contrast-safe accent, and branding on the join reveal.

**Not now:** full per-team theming/skins, custom fonts, email-template branding, public-profile branding — later, and each on its own merits.

---

## Paste-ready instruction for Claude Code

> Add organization branding to Relevé Connect. Same discipline as the slices: Analyze → Change → Test, one additive migration matching the repo's migration naming, tests + production build green, commit but DO NOT push (Kathleen controls deploys). Any user-facing string uses **Relevé** with the accented é. This is a new slice — keep it separate from the in-flight join-copy fix.

**Schema (additive):** on `employer_profiles` add `brand_accent text NULL`, `brand_accent_2 text NULL`, `team_motto text NULL` (check length ≤ 60). Reuse the existing `logo_url`.

**Storage:** create a public-read Supabase Storage bucket `org-branding`; objects keyed `{employer_id}/...`; write policy limited to the org's administrator. Accept PNG/JPG/SVG, ≤ 2 MB.

**Admin settings:** in the org profile/settings (Team Director / studio owner), add: logo/mascot upload (sets `logo_url`), primary accent + optional secondary (hex, with a contrast validation/warning at save), and the optional motto (≤ 60). Only the org administrator may edit.

**Render — co-branded header:** add a `TeamBrandHeader` shown above the calendar on This Week for both self-managed members and studio/family members, using the member's affiliated org (from the affiliation, not from schedule items). Show logo-or-monogram + org name + motto; use the accent only on safe surfaces with a computed accessible foreground. Keep the Relevé platform mark in the top chrome — this personalizes, it does not replace.

**Monogram fallback:** when `logo_url` is empty, render initials (up to 2–3 letters from significant words, skipping "The" and "(…)" tags) in an accent-tinted rounded tile.

**Join reveal:** when a valid team/family code resolves, show the org's logo (or monogram) next to its name on the confirmation step.

**Tests:** monogram derivation, contrast fallback (a dark and a light accent both yield legible text), header renders from affiliation with zero events, and the ≤60 motto limit.

**Depends on:** the fix that resolves a member's org name from their active affiliation.

---

*Result: a college dancer, a pro-team member, and a studio family all open This Week and see their own identity above the calendar — inside Relevé, unmistakably theirs.*
