# Team Director Management Route — Gap Spec

*Found in live testing: a dance team's Director has no self-serve route to manage their own organization. Closes the loop on Dance Teams + Branding.*

**Status:** Gap confirmed in production testing · **Owner:** Kathleen Kilcoyne

---

## What we found

Branding renders correctly (accent, monogram, motto all verified on the member's This Week). But when we went to **upload a logo as the Team Director**, there was no way in:

- `/studio/edit` — the org editor where branding lives — redirects to **`/studio/setup`**, which is **invitation-only and studio-shaped** ("Studio setup is by invitation").
- A dance team created outside that invitation flow has **no Director-reachable route** to its own editor — even though the team has an owner.
- So a real college or pro team's Director currently **cannot manage their own logo / accent / motto** (and, by the same gate, likely can't mint their team join code through the UI either — we minted ours directly as a workaround).

Admin can edit via the Admin Console, but that's an internal workaround, not a product path. **This route is the actual missing piece — arguably more important than the logo upload itself.**

---

## What's needed

A **Team Director** (the owner/admin of a `dance_team`) can reach an **org editor** for their team and manage its profile + branding — logo, `brand_accent`, `brand_accent_2`, `team_motto` — parallel to what a studio owner gets today. The branding *editor UI already exists* in `StudioEditor`; it just isn't reachable for dance-team Directors.

---

## Approach (recommended: generalize, don't fork)

Consistent with the Dance Teams "one engine, many faces" principle — extend the existing org editor rather than build a second one.

1. **Resolver.** The org-editor route must resolve the caller's organization for **both** `studio` (existing) and `dance_team` (new) — via ownership/admin (`owner_user_id`, or the org-admin association studios use). A dance-team Director lands directly on their team's editor instead of being bounced to the invitation-only studio setup.
   - *Note from testing:* our test team set `owner_user_id` to the Director's account, yet `/studio/edit` still bounced — so the resolver/access check currently does **not** recognize `dance_team` ownership. That's the core fix.

2. **Access.** Whatever gate guards the editor, the logo-upload route (`api/studio/branding/logo`), and the team-code mint route (`api/studio/schedule/team-code`) must grant a `dance_team`'s **Director** access to their own team. (The mint route already checks `org_type='dance_team'`; the editor + upload need the same recognition.)

3. **Copy — org-type aware.** Labels adapt: **"Team Director" / "team"** for `dance_team`, **"studio owner" / "studio"** for `studio`. Reuse the Dance Teams umbrella language; the branding section is identical either way.

4. **Reachability.** Give the Director a way *in* — a link/entry point from wherever they land after signing in (a team home or the This Week chrome for a Director), leading to "Manage team" → the org editor. The team-code mint UI (`TeamJoinCode`) should sit on that same Director surface.

---

## Upstream (how a team + Director come to exist)

The editor is moot without a Director assigned. For the **pilot**, the simplest path: **admin creates the dance team and assigns its Director** (sets `owner_user_id` / an org-admin link), and that Director can then reach the editor above. A self-serve "start a dance team" onboarding flow can come later; it's not needed to unblock branding management now.

*(Our test team was created via SQL with the Director as owner — so implementing #1's resolver against `owner_user_id` for `dance_team` would immediately make it editable.)*

---

## Scope

**Build now:** make the org editor + branding + team-code mint reachable and usable by a `dance_team` Director (resolver + access + org-type copy + an entry link).

**Not now:** a full public self-serve team-creation/onboarding wizard; multi-admin roles per team; billing/entitlement for teams. Later, each on its own.

---

## Paste-ready instruction for Claude Code

> A dance team's Director has no route to manage their org. The branding editor exists in `StudioEditor` but `/studio/edit` is invitation-gated (redirects to `/studio/setup`) and only resolves studios, so a `dance_team` owner is locked out. Fix by generalizing — same discipline as the slices: Analyze → Change → Test, additive, tests + build green, commit but DO NOT push (Kathleen controls deploys). Relevé with the é.

- **Resolve dance teams.** Make the org-editor route resolve the caller's org for `dance_team` as well as `studio` (via `owner_user_id` / the org-admin association). A `dance_team` Director should land on their team's editor, not the invitation-only studio setup. (Confirm against the existing test team, whose `owner_user_id` is the Director.)
- **Access.** Grant a `dance_team` Director access to the editor, the branding logo-upload route (`api/studio/branding/logo`), and the team-code mint route (`api/studio/schedule/team-code`). Mirror the check the mint route already does for `org_type='dance_team'`.
- **Org-type copy.** In the editor, use "Team Director" / "team" for `dance_team` and "studio" for `studio`. The branding fields (logo, `brand_accent`, `brand_accent_2`, `team_motto`) are the same.
- **Entry point.** Give a Director a visible way in — a "Manage team" link from their signed-in surface leading to the editor; put the `TeamJoinCode` mint UI there too.
- **Pilot creation path:** ensure an admin can create a `dance_team` and assign its Director (owner), so the above becomes reachable end-to-end.
- **Tests:** a `dance_team` Director reaches and saves the editor (branding round-trips), a non-Director is refused, and the studio path still works unchanged.

---

*Once this lands, we can finish the branding test the intended way — Director uploads a logo through the UI — and a real college/pro team can brand itself without admin help.*
