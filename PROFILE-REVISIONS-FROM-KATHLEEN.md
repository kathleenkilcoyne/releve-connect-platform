# Relevé — Profile Builder Revisions
*From Kathleen, July 24, 2026. For Claude Code: apply to the profile builder (`/profile/edit`) and the Roster.*

## Labels & copy
1. **Page heading:** "Create Your Profile" → **"Welcome to the Relevé Roster"**
2. **"Teaching Reel" → "Featured Video"** (not everyone teaches). Helper text: *"A teaching clip, choreography, class footage, or performance."*
3. **Bio** — add prompt/helper text under the field: *"Tell us what makes you unique. Share your background, experience, and what dancers can expect working with you."*

## Make these SEARCHABLE / FILTERABLE — the important one
Kathleen's idea, and it's the right architecture. **Dance Styles, Focus Areas, Certifications, Location, and Availability should be structured tags — not free text** — so the Roster (and later Swing) can be searched, e.g.:
> *"Show me Jazz teachers within 20 miles, available weekends, CPR-certified."*

Store each as a defined tag/enum **now**; build the Roster filter UI on top. This is the **same data spine Swing will use** — capturing it structured from day one is nearly free; retrofitting later is a migration.

4. **Dance Styles** — keep the selections (Ballet, Jazz, Contemporary, …) and make them **filterable facets** for studio search + distance.
5. **Focus Areas** — keep, and **add: Early Childhood · Adaptive Dance · Improvisation.**
6. **Certifications** — keep, and **add: State Teaching License · CPR/First Aid · Safe Sport.**

## Swing section — simplify
7. Replace the Swing opt-in with a single line: **"You will receive opportunities when Swing launches."**

## Photo Gallery
8. Keep as-is. ✓

## NEW section — "Availability"
9. Add an **Availability** section:
   - **General availability** (filterable checkboxes): **Saturdays · Weekends · Summers Only · Willing to Travel · Virtual Available**
   - A **"Currently"** area for professional status:
     - Short text lines: **Teaching at: \_\_\_ · Touring with: \_\_\_**
     - Yes/No toggles (**also make these filterable**): **Accepting Choreography · Accepting Master Classes · Available for Adjudication · Available for Guest Teaching**
   - *Note:* the "Accepting / Available for" toggles are strong search filters in their own right (e.g. a studio searching "choreographers accepting commissions"). Keep them structured.

## Publish / visibility toggle
10. Rename the publish control to **"Ready to Join the Relevé Roster"**, with helper text: *"Turn this on when you're ready for studios and fellow professionals to discover you."*
    - **Default OFF** — the profile stays a private draft until the member flips it on.

## 11. Profile completion meter — warm, value-framed (not a cold %)
Add a completion nudge, but frame it around **being found**, never a bare percentage:
- Copy like *"A few things left to help studios find you"*, calling out high-impact items (Featured Video, Dance Styles, Location, Focus Areas).
- **Weight it** so only fields that drive Roster/Swing search matches move the meter — the incentive points at discoverability, not vanity.
- Its destination is the **"Ready to Join the Relevé Roster"** toggle — the meter's job is to walk someone confidently to publishing.
- **Start with earned progress** (once the basics exist, they're "most of the way there") rather than a discouraging low number.
- Never blocking; keep most fields optional.

**Also — drop the planned application progress bar** (CLAUDE.md §4F). Now that the application is short and warm, a progress bar there reads as interrogating. The meter belongs on the **profile**, not the application.

## Guiding notes
- Keep most fields **optional** so the profile feels like a showcase, not a chore.
- Everything structured above feeds the **Roster search now** and **Swing matching later** — one data model, two features.
