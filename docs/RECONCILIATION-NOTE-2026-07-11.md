# Reconciliation Note — repo brief vs. the 2026-07-11 ratified specs
### For Claude Code. Read this alongside the two source-of-truth files in `/docs`:
- `docs/Releve_Connect_Member_Platform_Build_Spec_2026-07-11.md` (build spec — what/what order)
- `docs/Releve_Pricing_RATIFIED_2026-06-25_SINGLE_SOURCE_OF_TRUTH.md` (authoritative pricing)

**Rule:** where `CLAUDE.md` or `DECISIONS.md` disagree with those two files, **the two files win.** This note lists every disagreement I found so nothing is ambiguous. Fix the docs, don't just build around them.

---

## Good news — already aligned or built (do not rebuild)
- **Payment rails are done and tested** — the $499 Signature Experience via Stripe Connect (Express), destination charge, **80/20 split** (artist keeps 80%), founder no-split path, refund→revoke. This matches the ratified Marketplace 80/20. Keep it.
- **Database is live** — RLS on 24 tables; `signature_works`, `experience_purchases`, `talent_profiles` with `stripe_account_id`/`payouts_enabled`. Foundation is real.
- **Reviews model already correct** — `CLAUDE.md` §3 specs a two-sided review with `reciprocal_reveal_status` (hidden until both submit or the window closes). That IS the ratified two-way double-blind design. The only addition: the reveal window is **7 days** (build spec §11).
- **No stale pricing in code** — no `$10`, no `$199/$399/$699` size-based studio pricing baked into the app or schema. Clean.
- **Tier PRICES already match** — individual $99 / $149 / $199 and studio $249 / $499 / $1,499 are the same in `CLAUDE.md` §4G and the pricing source of truth. Only the *names* differ (below).

---

## Conflicts to fix (docs are stale — specs win)

**1. Founding/Charter cohorts — STALE in `CLAUDE.md` (line ~199) and `DECISIONS.md` (Resolved #5).**
- Repo says: "First 50 Studios = 50% off *the Accelerator* ($1,500→$750); First 100 Artists = locked founder rate for life."
- Ratified now (2026-07-11): **Charter Studios = first 50 studios, 50% off Year 1 across tiers, with Accelerator *capped at ~10* (not Accelerator-only).** **Charter Faculty = first 50 teacher/performers, 50% off Year 1 on $149/$199 (not 100, not locked-for-life).** Accelerator price is **$1,499** (not $1,500).
- Action: replace the founding-cohort text in `CLAUDE.md` and `DECISIONS.md` with the Charter cohort from the pricing source of truth.

**2. Tier NAMES — reconcile to the source of truth (prices are already right).**
- Individual: repo calls them **Access / Professional / Signature Pro**; ratified names are **Live Pass ($99) / Professional ($149) / Professional·Full ($199)**. (Prefer these — "Signature Pro" collides with the choreographer *Signature* marketplace status.)
- Studio: repo calls the entry tier **Base**; ratified name is **Studio Connect ($249)**. Growth and Accelerator already match.
- Action: use the ratified names everywhere in UI, config, and Stripe product names.

**3. Scope — Swing, two-way reviews, and the Marketplace are now IN scope.**
- `CLAUDE.md` §6 lists the Marketplace transaction engine, Swing per-use billing, and the reviews flow as "out of scope for the 90 days." That's superseded: the $499 Connect build already went live, and the build spec's **Section 2 critical path** makes the vetting gate → profile → Roster → **Swing** → **reviews** → **Marketplace** the actual roadmap.
- Action: treat build spec §2 as the current scope/roadmap; `CLAUDE.md` §6's out-of-scope list no longer governs these items.

**4. The $30 application fee is NEW — add it (it's the vetting-gate spine).**
- Not present in `CLAUDE.md`/`DECISIONS.md`. Ratified: **$30 to apply, vetted performer/teacher tier only** (not Live Pass, not studios), **credited 100% to membership if accepted / refunded if not / forfeited only if accepted-then-declines, waived for the Founding 25.** Public copy must **lead with "credited/refunded," never "pay to apply."** See build spec §4.

---

## Open decisions that still need Kathleen (do not guess — ask)
- **Buyer/member account type.** `users.account_type` is `talent | employer | admin`; $499 buyers and Live-Pass individuals are currently filed as `talent`. The model now has individual *consumers/members* (Live Pass) distinct from talent. Decide: add a `member`/`access` type, or handle via role. (Already flagged as an open question in `DECISIONS.md`.)
- **Category vocabularies** (styles/levels/focus/regions) — still pending final confirmation (build spec uses 4 teaching-level rungs; confirm the full lists).
- **Email vendor** (Resend vs Postmark) and **the "$99 lifetime" Founding Honoree rate** (not in the source of truth — confirm terms before building).

---

## Suggested order for Claude Code
1. Update `CLAUDE.md` + `DECISIONS.md` per conflicts 1–3 above (so the repo's own brief stops contradicting the specs). List each change back to Kathleen.
2. Continue from `RESUME-HERE.md` (finish the $499 real content + other-artist path + notifications).
3. Then follow build spec §2 from the current point: the vetting gate + $30 fee, then the profile (visual-first), then Roster/search, then Swing + reviews.

*Prepared 2026-07-11. Nothing in the repo is broken; these are documentation-alignment fixes plus the new application-fee and Charter-cohort decisions.*
