# Relevé Connect

National infrastructure for the dance industry. A searchable, categorized profile
platform where dance professionals (talent) present themselves as the product, and
studios (employers) discover, browse, and connect with them.

> together we rise · nous nous levons · relevé

**Owner:** Kathleen McAree · Relevé Connect LLC (NJ)
**This repo:** a fresh, founder-owned build. See `CLAUDE.md` for the full 90-day brief
and the rules that must never be broken.

---

## What this is (in plain English)

Think of Relevé as a professional directory built for dance. Two kinds of people use it:

- **Talent** — dancers, teachers, and choreographers. They build a rich profile
  (headshot, bio, resume, video reels, badges) and make it findable.
- **Employers** — studios. They search the directory, shortlist people they like,
  and reach out — all without Relevé ever taking a cut of anyone's paycheck.

The money Relevé makes is a yearly membership fee that turns a profile "on." That's it
for now. Everything else (a choreography marketplace, messaging inbox, booking) is
deliberately **out of scope** for these first 90 days — see `CLAUDE.md` Section 6.

---

## Status

🚧 **Phase 1 — foundation.** Currently scaffolding: project documents and database
schema. No application code yet. Follow the plain-English changelog in commit messages
and `DECISIONS.md`.

---

## The technology (what each piece does)

| Piece | Tool | Why |
|---|---|---|
| The website | Next.js (App Router, TypeScript) | Fast, modern, widely supported |
| The database | PostgreSQL via Supabase | Stores all profiles; fully exportable, no lock-in |
| Login | Supabase Auth (email link + Google) | Handles sign-in securely |
| Photos / resumes | Supabase Storage | Where uploaded files live |
| Videos | Vimeo (private embeds) | We never host video ourselves |
| Search | Postgres full-text search | Powers the employer directory |
| Email | Resend or Postmark | Sends the few, disciplined emails we allow |
| Hosting | Vercel | Where the live site runs |

---

## Running it locally (once app code exists)

> These commands won't work yet — there's no app to run during the document phase.
> They're here so you know what the day-to-day looks like.

```bash
npm install      # download the building blocks (one time)
npm run dev      # start the site on your own computer
```

Then open http://localhost:3000 in a browser.

---

## Environment variables (secrets)

Secrets live in a file called `.env.local` that is **never** committed to git.
Every variable the project needs will be documented in this table as it's added.

Copy `.env.example` to `.env.local` and fill in the values. You don't need them all
at once — each is only required when its feature is built.

| Variable | What it's for | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your database address | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public database key | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin database key (secret) | Supabase → Settings → API |
| `EMAIL_API_KEY` | Sending onboarding emails | Resend/Postmark (vendor TBD) |
| `EMAIL_FROM_ADDRESS` | The "from" address on emails | Your choice |
| `STRIPE_SECRET_KEY` | Membership payments | Stripe dashboard (test mode) |
| `STRIPE_WEBHOOK_SIGNING_SECRET` | Confirming a payment happened | Stripe dashboard |
| `NEXT_PUBLIC_SITE_URL` | The site's own address | Local default provided |

**To set up the database**, follow the plain-English guide in
[`docs/SETUP-SUPABASE.md`](docs/SETUP-SUPABASE.md).

---

## Project documents (read these)

- **`CLAUDE.md`** — the master brief. What we're building, the rules, what's out of scope.
- **`DECISIONS.md`** — a running log of every decision we make and why.
- **`EMAILS.md`** — every automated email the system can send, and exactly what triggers it.
- **`schema.sql`** — the database blueprint (all the tables and how they relate).

---

## The guardrails (never broken)

1. **No tax on labor.** Membership fee only. Relevé never takes a cut of a member's earnings.
2. **The profile is the product.**
3. **Studios are employers, not talent** — two separate account types, never blurred.
4. **You own your data.** Captured with consent, always exportable.
5. **Clean email discipline.** One confirmation on sign-up, one admin alert. Nothing else automatic.
6. **The founder is not QA.** The two flows that cannot break — intake emails and
   search results — get automated tests.
