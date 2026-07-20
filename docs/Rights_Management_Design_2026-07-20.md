# Relevé Connect — Choreography Rights Management (design)

*Working design, 2026-07-20. Kathleen + Claude. NOT built yet — this is the spec
to build from once "season" is fully defined. No migration exists.*

---

## Design tenet (Kathleen, 2026-07-20)

**Keep the architecture flexible where the decision is an ARTISTIC choice, and
fixed only where it is a TECHNICAL necessity.** Renewal rights, license terms,
and pricing are artistic/business choices → the choreographer controls them, over
time. The conflict engine, the money ledger, and the season windows are technical
necessities → fixed and enforced by the platform. When unsure which a thing is,
ask: "would two different choreographers legitimately want it different ways?" If
yes, it's artistic — make it a setting, not a rule.

---

## The reframe (the north star for this whole system)

**Relevé is the rights-management platform for dance choreography. We are NOT
selling videos.** The product is a **grant of rights** — a license to USE
choreography as intellectual property. The video is evidence of the license, not
the thing being sold. This keeps faith with the founding rule: revenue is
product + infrastructure, never a cut of anyone's labor.

Consequence for copy: not "you set your price" but **"you set your terms, and
your price follows from them."**

---

## The three calendars — keep them separate

Conflating these is the main design hazard.

1. **Program calendar** — when Relevé operates (Senior Spotlight: applications
   Jan–Apr, selected May, filming Jun–Jul, released Aug 15). Operational only.
2. **Availability window** — when a license CAN be bought. Senior Spotlight =
   year-round. Competition = seasonal.
3. **License term** — the period the granted rights actually COVER. The ONLY
   calendar exclusivity conflicts are checked against.

---

## License Types — presets over dimensions (Competition Collection)

Choreographer-facing menu (the artistic layer). Each TYPE is a preset that fills
the underlying rights DIMENSIONS (the technical layer). The conflict engine reads
the dimensions, NEVER the type name — so a future 4th type (Educational, Concert)
is a new preset with zero change to conflict logic.

| License Type | Exclusivity | Sales cap | Meaning |
|---|---|---|---|
| **Standard** | non-exclusive | unlimited | Anyone can license it this season. |
| **Limited Edition** | non-exclusive | capped (3/5/10) | Only N studios get it this season. |
| **National Exclusive** | exclusive | 1 | One studio, nobody else, whole season. |

Rule: **one offering type per work + season.** The choreographer picks the type;
they may switch it freely until the first sale, after which it locks (the first
sale creates rights that constrain everything else). Senior Spotlight Collection
is always Standard (unlimited, non-exclusive) — the simplest preset.

### Renewal Option — a choreographer setting on the offering

Snapshotted onto each granted license (a later change never rewrites an existing
holder's rights). Three values:
- **No renewal rights** — reopens to the public every August.
- **Right of First Refusal** — exclusive holder gets first option next season.
  **DEFAULT for National Exclusive.**
- **Auto-renewal invitation** — platform proactively offers the renewal.

The field is folded in NOW; the season-rollover job that acts on it is LATER.

---

## Rights as dimensions, not a flat enum

Kathleen's list (unlimited · limited · exclusive · regional · national exclusive
· renewable · one-season) is really FOUR independent dimensions + permitted use:

| Dimension | Values |
|---|---|
| **Exclusivity** | non-exclusive · regional-exclusive · national-exclusive |
| **Territory** | worldwide · national · named region |
| **Term** | one season · renewable · perpetual |
| **Volume** | unlimited · limited to N **sales** (limited edition: only N studios ever get it) |
| **Permitted use** | competition · concert · recital · education (from "intent to use") |

A granted license snapshots the chosen values AT GRANT TIME (like
`teaching_earnings` snapshots the rate) — later offering changes never rewrite a
granted license.

---

## RATIFIED

- **Exclusive blocks EVERYTHING in scope.** If a choreographer sells National
  Exclusive · 2027 Competition Season, nobody else can license that work in that
  scope during that season — not even a plain non-exclusive. Otherwise the buyer
  did not actually receive an exclusive. (Kathleen, 2026-07-20.)
- **"Catalog" → "Collection"** for Senior Spotlight. Curated, invite-only,
  premium — "like Oprah's Favorite Things."
- **Senior Spotlight Collection** = College Audition Choreography, **available
  year-round**, and is the SIMPLEST config of the general model: unlimited ·
  non-exclusive · worldwide · perpetual. Configurable rights apply to the
  **Competition Collection**, not to Senior Spotlight.
- **Watermarking is included with licensing** (not a separate product). Dynamic,
  per-purchaser, BURNED-IN, generated ONCE per license: e.g. "Licensed by Jane
  Smith · Relevé Connect · Order #12345". Generate-once is the economic call;
  recurring revenue is the license renewal, not re-rendering.

## The conflict rule (the heart of the platform) — SIMPLIFIED 2026-07-20

Exclusivity is **national + season-wide** — there is NO regional/per-competition
exclusivity for competition. Rationale (Kathleen): Nationals converges studios
from across the country, so any sub-national "exclusive" is incoherent — a
non-exclusive holder from another region shows up at Nationals with the same
piece, which is the exact conflict exclusivity must prevent. So exclusive =
national, or it isn't exclusive.

This collapses the "territory" dimension for competition and reduces the check,
for a given **work + season**, to:

> - An **exclusive** grant requires **zero** other active licenses for that
>   work+season → **first come, first served**.
> - If an active exclusive exists → **no** further grants for that work+season.
> - Otherwise **non-exclusive** grants are allowed up to the offering's sales cap
>   (or unlimited).

Enforced in the database (exclusion constraint / guarded transaction), never
left to application hope. Territory stays a future SEAM (deferred concert/
recital/education uses may want it) but is not part of the competition check.

### Intent-to-Use form (informational, NOT a constraint)

At purchase the buyer completes an Intent-to-Use form listing their anticipated
competitions. This gives the choreographer visibility into where their work will
appear — but it does **not** limit the license and is **not** part of the
conflict check. A National Exclusive holder owns the full season regardless of
which competitions they later qualify for (including Nationals). Model it as
metadata attached to the granted license.

---

## RATIFIED (season working session, 2026-07-20)

- **Competition Season = fixed calendar window, Aug 1 → Jul 31.** Fixed (not
  rolling-12-from-purchase) so two buyers mean the identical window and
  conflict-checking stays clean.
- **Limited Quantity = capped number of SALES** (3 / 5 / 10 — a limited edition,
  "only N studios ever get this"), NOT a per-license usage cap.
- **Season is a NAMED date-range preset** (data, not code — same discipline as
  `app_config`), so a granted license carries concrete `effective_from` /
  `effective_to` and conflict-checking is pure range overlap.
- **College audition cycle** (marketing context, NOT a licensing gate — Senior
  Spotlight is year-round): prescreens Oct–Dec, live auditions Jan–Feb,
  decisions by May 1.

## RESOLVED in the season working session (2026-07-20)

1. **Term = the whole named season.** Confirmed: a National Exclusive for 2027 is
   owned for the entire season including Nationals, regardless of purchase date.
   Consequence: the first non-exclusive sale for a season disables exclusive for
   that season (an exclusive requires zero prior overlapping licenses).
2. **Season named by the ending year** ("2027 Season" = Aug 2026 – Jul 2027).
3. **Regional exclusivity is OUT** for competition — exclusivity is national +
   season-wide. Intent-to-Use form replaces geographic carving (informational).
4. **Limited Quantity = per-season cap** (5 studios can license the 2027 season;
   resets for 2028).
5. **Competition-use only** for now; recital/education are a later term model.
6. **Senior Spotlight = unlimited, non-exclusive** — the simplest config, "not
   beachfront."

## RESOLVED — renewal + license types (2026-07-20)

- **Renewable is a choreographer SETTING** {no_renewal · right_of_first_refusal
  (default for exclusive) · auto_renewal_invitation}, not a platform rule. It is
  an artistic choice (design tenet). A renewal re-runs the conflict check.
- **License Types** = presets over dimensions: Standard · Limited Edition ·
  National Exclusive (table above). Conflict engine reads dimensions, not type.

**The season definition is now COMPLETE — the schema is fully determined.** Ready
to build the foundation on Kathleen's word (build order below). Still NOT before
launch: nothing here gates go-live; licensing stays "Coming".

---

## Senior Spotlight Collection — program calendar (Kathleen, 2026-07-20)

Positioning: "like Oprah's Favorite Things." Marketed as: *Designed for dancers
preparing for BFA and BA dance program auditions across the country. Browse
licensed choreography from professional choreographers, learn directly from the
artist, and perform work created specifically for the college audition process.*

- Applications for choreographers: **January–April**
- Selected choreographers announced: **May**
- Filming & production: **June–July**
- Collection released: **August 15**
- Featured collection season: **August–December**

---

## Future — the choreographer dashboard (fold the SCHEMA in now, build the UI later)

Creators need to SEE their value; it reinforces it. The dashboard shows:
licenses sold this month · lifetime licenses · current earnings · most popular
choreography · **and — most important for a rights platform — what rights are
still AVAILABLE to sell** ("You've sold Northeast exclusive for 2027; national
exclusive is no longer available that season").

Built on an append-only license-earnings ledger (mirroring `teaching_earnings`)
+ an availability view derived from active grants. One artist-earnings view
unions teaching + licensing so a single dashboard query serves both.

---

## Build order (when green-lit)

1. Rights schema: works · license offerings · granted licenses (terms
   snapshotted) · the exclusivity conflict constraint · named seasons.
2. License-earnings ledger + the artist-earnings union view.
3. Availability view (what's left to sell) → dashboard data.
4. Signed/expiring delivery seam (recurring licenses need REVOCABLE access; every
   bucket today serves permanent public URLs — that must change for this).
5. LATER, not before launch: the transcoding pipeline that burns in the
   watermark (Vimeo cannot do per-viewer burn-in; needs Mux / Cloudflare Stream
   / ffmpeg worker). Licensing is marked "Coming", so this does not gate launch.
