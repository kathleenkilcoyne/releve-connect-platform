// The homepage — the real front door, built from Kathleen's mockup
// (releve_homepage_mockup.html) and her ecosystem artwork.
//
// Palette is BLACK · CREAM · GOLD throughout, per the brand rule. Tokens live in
// components/home/tokens.css, scoped to `.home-scope` so this page's full brand
// treatment can't leak into the rest of the app.
//
// ── A note on the nav ──
// The mockup's nav listed Teachers / Choreographers / Dancers / Studios /
// The Beat / The Climb / The Green Room. Six of those have no page yet, and
// shipping six dead links on the front door is worse than a shorter honest nav,
// so this renders only what genuinely works today. Adding them back is a
// one-line change each once the pages exist.

import Image from "next/image";
import Link from "next/link";
import "@/components/home/tokens.css";

export const metadata = {
  title: "Relevé Connect — where dance professionals are found",
  description:
    "National infrastructure for the dance industry. A vetted, searchable home for teachers, choreographers and dancers — and the studios looking for them.",
};

/** The roles in the ecosystem artwork, in the order they appear around it. */
const ECOSYSTEM_ROLES: { name: string; blurb: string }[] = [
  { name: "Dancers", blurb: "Find opportunities. Build your career. Share your talent." },
  { name: "Teachers", blurb: "Teach. Inspire. Mentor. Lead." },
  { name: "Studios", blurb: "Grow your studio. Find the right professionals." },
  { name: "Choreographers", blurb: "Create. License. Protect your work." },
  { name: "Colleges", blurb: "Discover talent. Connect with the future." },
  { name: "Parents", blurb: "Support. Encourage. Empower." },
  { name: "Community", blurb: "Belong. Connect. Collaborate. Lift each other up." },
  { name: "Industry", blurb: "Employ. Support. Collaborate. Move the industry forward." },
  { name: "Casting", blurb: "Find talent. Post opportunities. Make connections." },
  { name: "Producers", blurb: "Create. Produce. Bring visions to life." },
  { name: "Artists", blurb: "Every artist. Every stage. One community." },
];

export default function Home() {
  return (
    <div className="home-scope flex flex-1 flex-col">
      {/* ─────────────────────────── Top nav ───────────────────────────
          Sticky, because the mockup's whole point was "nav at the TOP,
          always visible". */}
      <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-[color:rgba(182,145,47,0.25)] bg-[color:rgba(245,238,225,0.92)] px-4 py-3.5 backdrop-blur sm:px-8 lg:px-11">
        <Link href="/" className="flex items-baseline gap-2.5 no-underline">
          <span className="text-2xl font-semibold tracking-[0.14em] text-[var(--rc-ink)]">
            RELEV<span className="rc-gold">É</span>
          </span>
          <span className="text-[0.6rem] uppercase tracking-[0.34em] text-[var(--rc-muted)]">
            Connect
          </span>
        </Link>

        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6">
          <HeaderLink href="/roster">The Roster</HeaderLink>
          <HeaderLink href="/studio">For Studios</HeaderLink>
          <HeaderLink href="/login">Sign in</HeaderLink>
          <Link
            href="/apply"
            className="rounded-sm bg-[var(--rc-gold)] px-5 py-2.5 text-[0.74rem] uppercase tracking-[0.14em] text-white no-underline transition-colors hover:bg-[#9c7c26]"
          >
            Apply
          </Link>
        </nav>
      </header>

      {/* ──────────────────────────── Hero ──────────────────────────── */}
      <section className="mx-auto max-w-4xl px-7 pb-12 pt-12 text-center sm:pb-20 sm:pt-24">
        <p aria-hidden="true" className="mb-5 text-[2.2rem] leading-none text-[var(--rc-gold)]">
          ✦
        </p>

        <h1 className="text-[clamp(1.9rem,4.6vw,3.15rem)] font-medium leading-[1.16] tracking-[0.3px] text-[var(--rc-ink)]">
          There are trillions of stars. Each one has its place to shine.
          <span className="block italic text-[var(--rc-gold)]">This one is yours.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-[660px] text-[clamp(1.02rem,2.1vw,1.2rem)] leading-relaxed text-[var(--rc-ink-soft)]">
          A professional home for the working dance world — where you&apos;re seen, supported, and
          connected from day one.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/apply"
            className="rounded-sm bg-[var(--rc-gold)] px-8 py-3.5 text-[0.82rem] uppercase tracking-[0.16em] text-white no-underline transition-colors hover:bg-[#9c7c26]"
          >
            Apply
          </Link>
          {/* "Meet Relevé" has no page of its own, so it scrolls to the mission
              rather than becoming a dead link. */}
          <a
            href="#mission"
            className="rounded-sm border border-[var(--rc-gold)] px-8 py-3.5 text-[0.82rem] uppercase tracking-[0.16em] text-[var(--rc-gold)] no-underline transition-colors hover:bg-[color:rgba(182,145,47,0.08)]"
          >
            Meet Relevé
          </a>
        </div>
      </section>

      {/* ─────────────────────────── Mission ─────────────────────────── */}
      <section
        id="mission"
        aria-labelledby="mission-heading"
        className="scroll-mt-24 bg-[var(--rc-cream-2)] px-7 py-12 text-center sm:py-20"
      >
        <h2 id="mission-heading" className="sr-only">
          Our mission
        </h2>
        <div className="mx-auto max-w-[720px]">
          <p className="text-[clamp(1.02rem,2vw,1.18rem)] leading-relaxed text-[var(--rc-ink-soft)]">
            Talent alone was never enough. Careers are built through relationships, strategy,
            preparation, and opportunity — and for too long, the dance world has had the talent
            without the infrastructure to carry it.
          </p>
          <p className="mt-5 text-[clamp(1.02rem,2vw,1.18rem)] leading-relaxed text-[var(--rc-ink-soft)]">
            Relevé Connect is that infrastructure. We connect artists with opportunity, give them
            the tools to navigate every stage of a professional career, and help dancers, teachers,
            choreographers, and studios build lives on purpose, prosperity, and integrity —
            sustainable careers rooted in excellence.
          </p>
          <p className="mt-5 text-[clamp(1.02rem,2vw,1.18rem)] leading-relaxed text-[var(--rc-ink-soft)]">
            There are trillions of stars in the universe, and each one has its own place to shine.
            You carry a unique gift, a unique voice, a unique path. Our mission is to help you
            discover who you already are — and to surround you with the relationships, strategy,
            and opportunity to let your light be seen.
          </p>
        </div>
      </section>

      {/* ────────────────────────── Courage line ──────────────────────────
          Deliberately its own quiet moment on cream, deeper down the page. */}
      <section className="px-7 py-14 text-center sm:py-20">
        <p className="mx-auto max-w-[760px] text-[clamp(1.25rem,2.9vw,1.65rem)] leading-[1.4] text-[var(--rc-ink)]">
          You don&apos;t need a bigger dream. You need the{" "}
          <span className="italic text-[var(--rc-gold)]">courage</span>{" "}
          to become the person who can live it — and you won&apos;t take that step alone.
          That&apos;s why we&apos;re here, every step of the way.
        </p>
      </section>

      {/* ────────────────────────── Ecosystem ──────────────────────────
          The artwork already contains the heading, the subtitle, "Together, we
          rise.", every role label, and the SEEN · CONNECTED · … strip. So none
          of that is repeated as visible HTML — it would render twice.

          But an image is invisible to screen readers and to search engines, and
          this page's whole job is to be found and shared. So the same content is
          also present as real, structured, screen-reader-only text below. */}
      <section
        aria-labelledby="ecosystem-heading"
        className="bg-[var(--rc-black)] px-4 py-12 text-center sm:px-6 sm:py-20"
      >
        <h2 id="ecosystem-heading" className="sr-only">
          The Relevé Ecosystem — every role, every connection, every generation. Together, we rise.
        </h2>

        <Image
          src="/releve-ecosystem.png"
          alt="The Relevé Ecosystem — every role, every connection, every generation. Together, we rise. Relevé Connect sits at the centre of a constellation linking dancers, teachers, studios, choreographers, colleges, parents, community, industry, casting, producers and artists."
          width={1600}
          height={1600}
          priority
          sizes="(max-width: 900px) 94vw, 900px"
          className="mx-auto h-auto w-full max-w-[900px]"
        />

        {/* The artwork's content, as text — for screen readers and search. */}
        <ul className="sr-only">
          {ECOSYSTEM_ROLES.map((role) => (
            <li key={role.name}>
              {role.name}: {role.blurb}
            </li>
          ))}
        </ul>
        <p className="sr-only">
          Seen · Connected · Protected · Licensed · Marketed · Monetized
        </p>
      </section>

      {/* ──────────────────────────── Close ────────────────────────────
          The last thing on the page is the promise, not a call to action. */}
      <section className="px-7 py-16 text-center sm:py-24">
        <p className="text-[clamp(1.5rem,3.6vw,2.15rem)] leading-[1.3] text-[var(--rc-ink)]">
          You belong here. You matter here.
        </p>
        <p className="mt-3 text-[clamp(1.5rem,3.6vw,2.15rem)] italic leading-[1.3] text-[var(--rc-gold)]">
          Together, we rise.
        </p>
        <div className="mt-10">
          <Link
            href="/apply"
            className="rounded-sm bg-[var(--rc-gold)] px-8 py-3.5 text-[0.82rem] uppercase tracking-[0.16em] text-white no-underline transition-colors hover:bg-[#9c7c26]"
          >
            Apply
          </Link>
        </div>
      </section>

      {/* ──────────────────────────── Footer ──────────────────────────── */}
      <footer className="border-t border-[color:rgba(217,184,95,0.15)] bg-[var(--rc-black)] px-6 py-8 text-center">
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#8a7f6a]">
          together we rise · nous nous levons · relevé
        </p>
        <nav aria-label="Footer" className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2">
          <FooterLink href="/apply">Apply</FooterLink>
          <FooterLink href="/studio">For Studios</FooterLink>
          <FooterLink href="/roster">The Roster</FooterLink>
          <FooterLink href="/login">Sign in</FooterLink>
        </nav>
      </footer>
    </div>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="border-b-2 border-transparent py-1 text-[0.82rem] tracking-[0.08em] text-[var(--rc-ink)] no-underline transition-colors hover:border-[var(--rc-gold)] hover:text-[var(--rc-gold)]"
    >
      {children}
    </Link>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[0.7rem] uppercase tracking-[0.16em] text-[#8a7f6a] no-underline transition-colors hover:text-[var(--rc-gold-bright)]"
    >
      {children}
    </Link>
  );
}
