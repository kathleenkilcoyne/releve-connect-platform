# Decisions Log

A plain-English record of every meaningful decision on Relevé Connect — what we
decided, when, and why. Newest entries at the top. This exists so that months from
now (or a future engineer) can understand *why* the project is the way it is.

---

## 2026-07-01 — Database connection code (Step 3, path A chosen)

**Decided:** Kathleen chose to set up Supabase now (path A). While she runs the
setup guide, built the code side so the app connects the moment keys are added:
- Installed `@supabase/supabase-js` and `@supabase/ssr`.
- Added connection helpers in `src/lib/supabase/` — `client.ts` (browser),
  `server.ts` (server), `admin.ts` (privileged, server-only for webhooks/admin).
- Added a `/setup-check` page: a green/red screen to confirm the database is
  connected and the category lists loaded — so verifying isn't a technical task.
**Why:** Lets setup and coding happen in parallel; nothing here needs her account.

---

## 2026-07-01 — Website skeleton + database prep

**Decided:** Scaffolded the Next.js website (Step 2). Confirmed it builds and runs.

**Decided:** Prepared the database groundwork *without* creating any account yet —
`.env.example` (settings template), `supabase/seed.sql` (starter category lists),
and `docs/SETUP-SUPABASE.md` (a click-by-click guide).
**Why:** Creating the Supabase account is tied to Kathleen's email/billing and it
owns all the data (Guardrail #4), so she does that step. This prep means it's fast
and painless when she's ready — no product decisions made in the meantime.

**Pending Kathleen's choice:** whether to (a) set up Supabase now, or (b) build the
screens against sample data first and wire the database after. Asked; awaiting reply.

---

## 2026-07-01 — Project kickoff & foundation

**Decided:** Start a fresh, founder-owned codebase for the 90-day Profile System build.
**Why:** The prior contractor build lives on Netlify from GitHub repo
`kathleenkilcoyne/releve-platform`. This is a clean new repo — no code migration.
Keep the old site live until we cut over, then re-point the domain.

**Decided:** The technology stack — Next.js + Supabase (Postgres) + Vercel + Vimeo + Resend/Postmark.
**Why:** Modern, well-supported, exportable, and no vendor lock-in. See `CLAUDE.md` Section 5.

**Decided:** Build order is a single vertical slice first — talent signs up → builds a
profile → publishes → appears in employer search under the right categories — before
adding breadth.
**Why:** Proves the core loop works end to end before we spread effort.

---

## Resolved open decisions (carried in from CLAUDE.md Section 8)

These were settled before the build began. Recorded here so they're not re-litigated.

1. **Hosting = Vercel.** Fresh clean repo on Vercel. Old Netlify site stays live until cutover.
2. **First contact = lean in-app intro request** (not "reveal contact info"). First
   contact routes through Relevé and is stored as a connection record; talent gets an
   email notification and can respond. Contact details private by default. **No full
   chat inbox now** — just this one seam.
3. **Category vocabularies** — reuse the starter lists in `CLAUDE.md` Section 3A.
   ⚠️ *Still needs Kathleen's final confirmation of the exact lists before launch.*
4. **Certified badge = RC-granted after ~60 days** from membership activation. Relevé's
   own stamp, separate from peer ratings.
5. **First 50 badge** = the first 50 approved applicants; the badge attaches at paid
   activation. Silver sibling of the gold "Founding 25" mark.

---

## Open questions still needing Kathleen's input

- [ ] Confirm the final category vocabularies (styles, levels, focus areas, regions) —
      see Open Decision 3 above.
- [ ] Confirm the email vendor: **Resend** vs **Postmark** (both fine; needed before
      wiring up onboarding emails).
