# Claude Code Handoff — Studio Profile: from database form to studio story
*Kathleen · July 24, 2026 · for the Studio Profile screen on `releve-platform`*

## The reframe (governs every decision below)
The studio profile is currently a **database form**. It should become a **studio story.** The audience is **professional decision-making** — a teacher deciding whether to teach there, and the Swing/Flex matching engine — **not parents, and not Google/SEO.** This is not another dance-studio directory. Every field choice serves "would a professional want to work here, and is this a match," not "does this rank on search."

A teacher evaluating a studio wants to know: *What's the culture? What's the atmosphere? What kind of students? What does success look like?* Lead with those, not with the year it opened.

## Reorder — story before logistics
The screen currently opens with Website / Year founded / Address. Important, but not what a professional reads first. Reorder to:

1. **Studio Name**
2. **Artistic Director**
3. **Studio Mission / Culture**
4. **Location**
5. **Styles**
6. **Scale**
7. **Transportation**
8. **Certifications**

Tell the story, then collect the logistics.

## New / elevated fields

**Artistic Director (new).** Not just the studio name. Teachers know a *person* — "Roberta Mathes" — before they know "Beyond Dance." People follow leaders. Add a named Artistic Director / studio leadership field.

**Studio Culture note — move it high** (right after the name). Prompt it warmly, e.g. *"What's it like to teach here?"* → free text like *"We value kindness, preparation, professionalism, and dancers who support one another…"* That tells a professional far more than the founding year.

**"What makes your studio unique?" (new).** One or two sentences — more meaningful than a checklist of styles. Example prompts: *conservatory training · college preparation · recreational dancers welcome · strong acrobatics program · performance company.*

## Keep / don't lose (technical)
- **Location stays structured + geocoded** (street/city/state/ZIP → lat/long). It moves *down visually*, but the underlying data must remain structured and geocoded — the Swing engine matches on distance ("within 25 miles"). Do not turn it into a free-text box.
- **Scale = student-count bands** already decided (Under 50 · 50–99 · 100–199 · 200+).
- Website, year founded, and address are still collected — just after the story, not before it.

## Tone & build discipline
- **Warm and invitational, optional not interrogative.** The culture / uniqueness / mission fields are **prompted but optional** — no word minimums, no forced "tell your story" (consistent with the roster application decision). Give warm placeholder prompts; never gate on them.
- **Lean and extensible.** Add these fields to the existing profile model; don't rebuild. Story fields are display-forward on the profile view.

## Field copy — use verbatim (label · helper prompt · example placeholder)

**Artistic Director**
- *Label:* Artistic Director
- *Helper:* The person behind the studio — teachers often know a name before they know a studio.
- *Placeholder:* e.g., Roberta Mathes
- *Note:* allow more than one (co-directors / studio leadership).

**Studio Culture — "What's it like to teach here?"** *(place right after Studio Name)*
- *Prompt / heading:* What's it like to teach here?
- *Helper:* A few honest words about your culture — what you value, how your dancers treat one another. This tells a teacher more than any statistic.
- *Placeholder:* "We value kindness, preparation, and professionalism — and dancers who lift each other up. Our faculty collaborate; they don't compete."

**What makes your studio unique?**
- *Prompt:* What makes your studio unique?
- *Helper:* One or two sentences. What would a dancer or teacher feel here that they wouldn't feel anywhere else?
- *Placeholder:* "Conservatory-level training with a heart for college prep — and a place where recreational dancers are valued as much as our pre-professional company."
- *Inline example chips:* Conservatory training · College preparation · Recreational dancers welcome · Strong acrobatics program · Performance company

**Studio Mission** *(short, optional — lower on the page)*
- *Prompt:* Your studio in one line.
- *Placeholder:* "Training the whole artist — technique, character, and courage."

*All four are optional and warmly prompted — never required, no word counts. Show the placeholder as gentle guidance, not a rule.*

## Definition of done
1. The profile *reads* as a studio story: name → artistic director → culture/mission surface first; logistics follow.
2. Artistic Director, Studio Culture note, and "What makes your studio unique?" fields exist and display prominently.
3. Location remains structured + geocoded (Swing-ready) even though it sits lower in the visual order.
4. New fields are optional and warmly prompted — nothing required, no word counts.
5. Nothing parent- or SEO-oriented is added; the profile serves professional decision-making and Swing/Flex matching.

*— together we rise · nous nous levons · relevé —*
