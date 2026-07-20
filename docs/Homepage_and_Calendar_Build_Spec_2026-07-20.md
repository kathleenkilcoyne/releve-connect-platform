# Claude Code — Homepage + "This Week" Calendar (two builds)

*Hand these to Claude Code when ready. Both are self-contained — all copy is below.*
*Brand: cream-and-gold, serif headings (match the existing `.this-week-scope` tokens).*

---

## BUILD 1 — The real homepage (replace the placeholder)

Replace the placeholder in `src/app/page.tsx` with the real Relevé Connect homepage. Structure, top to bottom:

**Sticky top nav** (stays visible on scroll): Teachers · Choreographers · Dancers · Studios · The Beat · The Climb · The Green Room, plus a gold **Apply** button.

**Hero:**
> **There are trillions of stars. Each one has its place to shine. This one is yours.**
>
> A professional home for the working dance world — where you're seen, supported, and connected from day one.

Buttons: **Meet Relevé** · **Apply**

**Mission section:**
> Talent alone was never enough. Careers are built through relationships, strategy, preparation, and opportunity — and for too long, the dance world has had the talent without the infrastructure to carry it.
>
> Relevé Connect is that infrastructure. We connect artists with opportunity, give them the tools to navigate every stage of a professional career, and help dancers, teachers, choreographers, and studios build lives on purpose, prosperity, and integrity — sustainable careers rooted in excellence.
>
> There are trillions of stars in the universe, and each one has its own place to shine. You carry a unique gift, a unique voice, a unique path. Our mission is to help you discover who you already are — and to surround you with the relationships, strategy, and opportunity to let your light be seen.

**Courage line** (deeper on the page):
> You don't need a bigger dream. You need the courage to become the person who can live it — and you won't take that step alone. That's why we're here, every step of the way.

**Ecosystem section** — on a **black** background: insert the gold ecosystem graphic (**PNG attached separately**), with this strip beneath it:
> **Seen · Connected · Protected · Licensed · Marketed · Monetized**

**Close:**
> **You belong here. You matter here.**
> **Together, we rise.**

> ⚠️ Attach the gold ecosystem PNG when sending this. The mockup file (`releve_homepage_mockup.html`) is already downloaded for layout reference.

---

## BUILD 2 — "This Week" calendar additions

Both on the existing `/this-week` screen (`src/components/this-week/ThisWeekScreen.tsx`).

### A) Daily rotating message — "You Matter Here"

At the top of the screen, an elegant greeting band: **"You Matter Here"** plus one short line that **rotates once per day** (choose by day-of-year so it's stable all day and cycles ~monthly). Cream/gold, subtle, display-only — a simple array is fine, no data model needed. Use all 30 lines:

1. Deep down, you already know what to do.
2. Just breathe. It will work itself out.
3. We don't rise to the level of our goals — we fall to the level of our standards.
4. You matter, so does today. Make it count.
5. Your life is unwritten. Make today's page beautiful.
6. Your gift is meant to be shared. So do it.
7. There is no one else quite like you.
8. Today, you will be someone's blessing.
9. There is nothing wrong with you because it hasn't happened yet — there is only ripening.
10. Sometimes the wait is the work.
11. You were meant to flow, not force.
12. You owe no one your journey.
13. Your life is always speaking to you — are you available to listen?
14. Gratitude is a game-changer — so start with yourself.
15. Be mindful of the energy you bring to any space; that part is your responsibility.
16. Lean into the part of you that is drawn to hope.
17. All you have is this precious, present moment.
18. Do not let fear be your guiding light. You already know, deep down, what to do.
19. Awakening is simply you listening to your inner voice. Once you're aware, you are conscious.
20. Move from the truest sense of who you are. The rest is just noise.
21. Define your intention. It will determine your cause and effect.
22. Choose you every time. It's the only one you're competing with anyway.
23. You are the author of your story. Write it the way you truly want it to go.
24. Everything you want is just on the other side of a decision. So make it.
25. Time stops for no one. Nor should you.
26. Offer yourself the grace you would bestow upon someone else.
27. Your body is the greatest instrument you will ever own.
28. Yesterday has no place here. Today is your best shot — take it.
29. You are worthy. Period.
30. The best predictor of your future outcome is your past behavior. Decide if you want to make a change.

### B) Music player — build the pipe now, fill it legally later

Add a small **"tap to play today's track"** control near the greeting. Browsers **block autoplay with sound**, so it must be user-initiated (a play button, or start muted). Requirements:

- Store audio in **Supabase Storage** (add an `audio` / `music` bucket, mirroring the existing `gallery` / `resumes` buckets).
- Expose a single **"current track" setting** (config value or a simple admin field) so Kathleen can set the week's track herself.
- Architect the source so it can **later** be a **member musician's original work** (a future `music_works` concept, mirroring the choreographer works / Signature Experience model). Do **NOT** build the musician marketplace now — just the player + storage + the "current track" setting, with a code note that member works are the intended future source.
- **License guardrail (flag loudly in code, like the MailerLite note):** never ship or hardcode copyrighted commercial music. Only two things ever go in — (a) royalty-free tracks Kathleen has licensed, or (b) members' original works.

---

*— together we rise · nous nous levons · relevé —*
