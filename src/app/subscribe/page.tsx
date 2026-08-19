// The membership page — the single canonical membership chooser and the billing
// home (founder decision, payment sprint 2026-08-18).
//
// ── What this page is ──
// One page carrying: the four pathways, their prices, what each includes, the
// purchase button, and the manage/cancel button. Every gated page in the app
// already redirects here, so getting this page right closes several dead ends
// at once.
//
// ── Why it is thin ──
// It decides nothing. `resolveMembershipSituation` answers "what is this
// person's situation?", `offeredTiers` answers "what may we put a price on?",
// and `professionalPathway` answers "how do they reach the Roster from here?" —
// all pure, all unit-tested without a database (guardrail #6). This file reads
// rows, calls those three, and renders. When the copy for a state looks wrong,
// the fix is almost always in `lib/membership/state.ts`, not here.
//
// ── The two populations, held at once ──
// Founding members are complimentary; new joiners pay. A founding member must
// never see a paywall, and a new joiner must never be told their membership is
// a gift. That separation is the `comp` state, and it outranks the paid states.
//
// ── What this page deliberately does NOT do ──
// · It does not redirect a signed-out visitor to /login. A stranger has to be
//   able to see what Relevé costs and what it includes before signing in.
// · The `pending` panel here is STATIC. Self-refresh, the status endpoint, and
//   the gated pages rendering the same panel are F2, and are not built yet.
// · `?from=` is accepted and ignored for now; using it to return someone to
//   what they were doing is also F2.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dollars, getTier, type TierSlug } from "@/lib/membership/tiers";
import { pathwayCopy, type PathwayKey } from "@/lib/membership/tier-copy";
import {
  offeredTiers,
  professionalPathway,
  resolveMembershipSituation,
  type MembershipSituation,
  type MembershipStateRow,
} from "@/lib/membership/state";
import SubscribeButtons from "./SubscribeButtons";
import "./tokens.css";

export const dynamic = "force-dynamic";

/* ═══════════════════ the four pathways, in ratified order ═══════════════════ */

// ── Information architecture (founder correction, 2026-08-18) ──
// "The membership chooser must appear in this exact order: 01 Professional,
//  02 Creator, 03 Studio / Arts Organization, 04 Live Pass. These are the four
//  primary membership pathways into Relevé and should be presented as visual
//  peers, with Professional leading the hierarchy."
//
// What the page used to do — and why it was wrong: `offeredTiers` returns only
// what a person may BUY RIGHT NOW, and the chooser rendered exactly that list.
// So a stranger saw one card, Live Pass, because it is the only tier sellable
// without vetting. Professional was demoted to a grey footnote, and the studio
// pathway did not appear at all. That is an eligibility list masquerading as an
// information architecture.
//
// The two are now separated. All four pathways always render, as peers, in the
// order below. `offeredTiers` still decides — untouched — which of them carries
// a real purchase button; the rest carry the honest next step instead. No
// eligibility, resolver, routing, founder or payment rule changed with this.

const STUDIO_TIERS: TierSlug[] = ["studio_connect", "studio_growth", "studio_accelerator"];

type Pathway = {
  key: PathwayKey;
  /** The tier this pathway sells, or null for the studio lane (three tiers). */
  slug: TierSlug | null;
  /** Where the non-purchase action goes. */
  href: string;
};

const PATHWAYS: Pathway[] = [
  // /welcome and never /apply — /welcome is the front door that routes someone
  // into the right onboarding path, and welcome/page.tsx records the exact
  // funnel ("/profile/edit → /subscribe → /apply") that linking straight to the
  // raw form rebuilds. Nothing on that path disturbs a membership someone
  // already holds; state.test.ts asserts it.
  { key: "professional", slug: "professional", href: "/welcome" },
  { key: "creator", slug: "professional_full", href: "/welcome" },
  // Studio onboarding is invite-led, not self-serve (DECISIONS 2026-07-24).
  { key: "studio", slug: null, href: "/studios/join" },
  { key: "live_pass", slug: "live_pass", href: "/welcome" },
];

/** "01" … "04" — the gold numerals. Presentation only. */
const numeral = (i: number) => String(i + 1).padStart(2, "0");

/* ───────────────────────────── card pieces ───────────────────────────── */

/**
 * Sets the pathway's key value phrases in semibold, leaving the rest regular
 * (founder direction, 2026-08-18: "bold only these key value phrases").
 *
 * Matching is case-insensitive and longest-phrase-first, so a phrase that
 * contains another cannot be split in half by the shorter one. The phrases
 * themselves live in `tier-copy.ts` beside the copy, and `tier-copy.test.ts`
 * fails if a copy edit ever orphans one.
 */
function Emphasize({ text, phrases }: { text: string; phrases: readonly string[] }) {
  if (phrases.length === 0) return <>{text}</>;

  const ordered = [...phrases].sort((a, b) => b.length - a.length);
  const pattern = ordered
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  const wanted = new Set(phrases.map((p) => p.toLowerCase()));

  return (
    <>
      {parts.map((part, i) =>
        wanted.has(part.toLowerCase()) ? (
          <strong key={i} className="font-semibold text-[var(--rc-ink)]">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function CtaLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rc-cta">
      {label} →
    </Link>
  );
}

/**
 * All four primary CTAs share one treatment. The BUTTON never signals which
 * membership matters more — only the verb changes (Apply / Explore / Join).
 * Live Pass is deliberately NOT the sole filled button just because it happens
 * to go straight to checkout (founder direction, 2026-08-18).
 */
function PathwayCard({
  pathway,
  index,
  situation,
  tiers,
  signedOut,
  wanted,
  creditNote,
}: {
  pathway: Pathway;
  index: number;
  situation: MembershipSituation;
  tiers: TierSlug[];
  signedOut: boolean;
  wanted?: string | null;
  creditNote?: string | null;
}) {
  const copy = pathwayCopy(pathway.key);
  const isStudio = pathway.key === "studio";

  // ---- What may this card actually DO? (eligibility, unchanged) ------------
  const buyableStudio = isStudio ? STUDIO_TIERS.filter((t) => tiers.includes(t)) : [];
  const purchasable = pathway.slug ? tiers.includes(pathway.slug) : buyableStudio.length > 0;
  const isHeld = isStudio
    ? situation.state === "active_studio"
    : pathway.slug === "live_pass"
      ? situation.state === "active_live_pass"
      : situation.tier === pathway.slug && situation.hasProfile;
  const underReview =
    !isStudio && pathway.slug !== "live_pass" && professionalPathway(situation) === "under_review";

  // ---- Price. The studio lane shows none: the tier is chosen with Relevé. ---
  const price = isStudio
    ? null
    : pathway.slug === "live_pass"
      ? `${dollars(getTier("live_pass")!.priceCents)}/year per family`
      : `${dollars(getTier(pathway.slug!)!.priceCents)}/year`;

  const emphasis = wanted != null && wanted === pathway.slug;

  return (
    <div
      className={`rc-card rounded-sm p-7 ${emphasis ? "ring-1 ring-[var(--rc-gold)]" : ""}`}
    >
      {/* Eyebrow: gold numeral, then the membership name. Letter-spaced, small. */}
      <p className="text-[0.68rem] uppercase">
        <span className="rc-numeral">{numeral(index)}</span>
        <span className="mx-2 text-[var(--rc-hairline)]">·</span>
        <span className="font-semibold tracking-[0.16em] text-[var(--rc-ink)]">{copy.name}</span>
      </p>

      {/* Price sits under the name, not shouting beside it. Gold, not bold. */}
      {price && (
        <p className="mt-3 text-[1.35rem] leading-none text-[var(--rc-gold)]">{price}</p>
      )}

      {/* A gold hairline is the only rule on the card. */}
      <hr className="mt-5 border-0 border-t border-[var(--rc-gold)] opacity-40" />

      {/* The audience statement — italic, and the only italic inside a card. */}
      <p className="mt-5 text-[1.06rem] italic leading-[1.6] text-[var(--rc-ink)]">
        {copy.tagline}
      </p>

      {/* Body copy: regular weight, ink-soft rather than muted for contrast,
          and a generous measure. Readability over daintiness. */}
      <p className="mt-3.5 text-[1rem] leading-[1.65] text-[var(--rc-ink-soft)]">
        {copy.description}
      </p>

      <ul className="mt-6 space-y-2.5">
        {copy.includes.map((line) => (
          <li
            key={line}
            className="flex gap-3 text-[0.97rem] leading-[1.55] text-[var(--rc-ink-soft)]"
          >
            <span aria-hidden className="mt-[0.62em] h-px w-3 shrink-0 bg-[var(--rc-gold)]" />
            <span>
              <Emphasize text={line} phrases={copy.emphasis} />
            </span>
          </li>
        ))}
      </ul>

      {purchasable && creditNote && !isStudio && (
        <p className="mt-5 text-[0.85rem] text-[var(--rc-ink)]">{creditNote}</p>
      )}

      <div className="rc-card-actions pt-7">
        {/* Auto-renewal is disclosed where the card is entered — the brief calls
            undisclosed annual auto-renew a consumer-protection exposure. It sits
            ABOVE the button so that terms come before the action, and so all
            four CTAs land on one baseline across the 2×2 composition. */}
        {purchasable && !isHeld && (
          <p className="mb-4 text-[0.75rem] leading-relaxed text-[var(--rc-muted)]">
            Billed annually. Renews each year, and you can cancel anytime in one click.
          </p>
        )}

        {isHeld ? (
          <p className="text-[0.85rem] uppercase tracking-[0.12em] text-[var(--rc-gold)]">
            ✓ Your current membership
          </p>
        ) : underReview ? (
          <p className="text-[0.88rem] leading-relaxed text-[var(--rc-muted)]">
            Your application is with us — we&apos;ll email you the moment there&apos;s a decision.
          </p>
        ) : purchasable && isStudio ? (
          <div className="grid gap-2.5">
            {/* No price ladder in the bullets, so each button carries its own. */}
            {buyableStudio.map((t) =>
              signedOut ? (
                <CtaLink
                  key={t}
                  href={`/login?next=${encodeURIComponent(`/subscribe?tier=${t}`)}`}
                  label={`${getTier(t)!.label} — ${dollars(getTier(t)!.priceCents)}/year`}
                />
              ) : (
                <SubscribeButtons
                  key={t}
                  mode="subscribe"
                  tier={t}
                  label={`${getTier(t)!.label} — ${dollars(getTier(t)!.priceCents)}/year`}
                />
              ),
            )}
          </div>
        ) : purchasable ? (
          signedOut ? (
            <CtaLink
              href={`/login?next=${encodeURIComponent(`/subscribe?tier=${pathway.slug}`)}`}
              label={pathway.key === "live_pass" ? copy.cta : `Join as ${copy.name}`}
            />
          ) : (
            <SubscribeButtons
              mode="subscribe"
              tier={pathway.slug!}
              label={pathway.key === "live_pass" ? copy.cta : `Join as ${copy.name}`}
            />
          )
        ) : (
          <CtaLink href={pathway.href} label={copy.cta} />
        )}
      </div>
    </div>
  );
}

/**
 * The chooser: all four pathways, always, as peers, in the ratified order.
 * `tiers` (from `offeredTiers`) decides which carry a purchase button — it is
 * not allowed to decide which APPEAR.
 *
 * 2×2 on desktop, a single column on phones. Equal-height cards (see
 * `.rc-card` in tokens.css) so the four CTAs land on a shared baseline.
 */
function Chooser({
  situation,
  tiers,
  signedOut,
  wanted,
  creditNote,
}: {
  situation: MembershipSituation;
  tiers: TierSlug[];
  signedOut: boolean;
  wanted?: string | null;
  creditNote?: string | null;
}) {
  return (
    <>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {PATHWAYS.map((p, i) => (
          <PathwayCard
            key={p.key}
            pathway={p}
            index={i}
            situation={situation}
            tiers={tiers}
            signedOut={signedOut}
            wanted={wanted}
            creditNote={creditNote}
          />
        ))}
      </div>

      {/* The way out for anyone who does not recognise themselves in a card.
          /welcome is the front door that asks how they are joining. */}
      <div className="mt-12 border-t border-[var(--rc-hairline)] pt-8 text-center">
        {/* Regular, not italic: italics are reserved for the headline line and
            the four audience statements (founder direction, 2026-08-18). */}
        <p className="text-[1.06rem] leading-[1.7] text-[var(--rc-ink-soft)]">
          Not sure which membership is right for you?
        </p>
        <Link
          href="/welcome"
          className="mt-3 inline-block text-[0.8rem] uppercase tracking-[0.14em] text-[var(--rc-gold)] underline underline-offset-4"
        >
          Find your place in Relevé →
        </Link>
      </div>
    </>
  );
}

/** The one condition the manage/cancel button renders on (F4 + F11). */
function ManageBilling({ situation }: { situation: MembershipSituation }) {
  if (!situation.canManageBilling) return null;
  return (
    <div className="mt-12 border-t border-[var(--rc-hairline)] pt-7">
      <SubscribeButtons mode="manage" />
      <p className="mt-2 text-[0.75rem] text-[var(--rc-muted)]">
        Update your card, see past invoices, or cancel — all in one place.
      </p>
    </div>
  );
}

const buildProfile = (
  <Link href="/profile/edit" className="rc-cta mt-8">
    Build your profile →
  </Link>
);

/* ───────────────────────────── the page ───────────────────────────── */

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; tier?: string; canceled?: string }>;
}) {
  const { tier: wanted, canceled } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ---- Gather (and nothing more) -------------------------------------------
  let applicationState: string | null = null;
  let applicationFeePaid = false;
  let membershipRows: MembershipStateRow[] = [];
  let accountType: string | null = null;

  if (user) {
    const db = createAdminClient();

    const [appRes, memRes, roleRes] = await Promise.all([
      db
        .from("applications")
        .select("application_id, state, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1),
      db
        .from("memberships")
        .select(
          "tier, membership_status, source, stripe_customer_id, renewal_date, updated_at, created_at",
        )
        .eq("user_id", user.id),
      db.from("users").select("account_type").eq("user_id", user.id).maybeSingle(),
    ]);

    const app = (appRes.data?.[0] ?? null) as
      | { application_id: string; state: string }
      | null;
    applicationState = app?.state ?? null;
    membershipRows = (memRes.data ?? []) as MembershipStateRow[];
    accountType = (roleRes.data as { account_type?: string } | null)?.account_type ?? null;

    // The $30 line is claimed only where a fee was genuinely PAID — never for a
    // Founding 25 waiver, never for a comp. Mirrors the checkout route's
    // `credit_fee_id`, which is what actually attaches the coupon.
    if (app && applicationState === "approved") {
      const { data: feeRow } = await db
        .from("application_fee_payments")
        .select("id")
        .eq("application_id", app.application_id)
        .eq("status", "paid")
        .maybeSingle();
      applicationFeePaid = Boolean(feeRow);
    }
  }

  const situation = resolveMembershipSituation({
    userId: user?.id ?? null,
    accountType,
    applicationState,
    applicationFeePaid,
    membershipRows,
  });

  const tiers = offeredTiers(situation);
  const signedOut = situation.state === "signed_out";
  const creditNote = situation.applicationFeeCredited
    ? "Your $30 application fee is credited in full toward your first year."
    : null;

  /* ---- the frame every state shares ----
     `wide` opens the page up for the 2×2 chooser; the prose states stay narrow,
     because a paragraph set across a wide measure is harder to read. */
  const shell = (
    children: React.ReactNode,
    opts: { wide?: boolean; eyebrow?: string; centered?: boolean } = {},
  ) => (
    <div
      className={`subscribe-scope min-h-screen ${
        opts.centered ? "flex flex-col justify-center" : ""
      }`}
    >
      <main
        className={`mx-auto w-full px-6 py-20 ${
          opts.wide ? "max-w-5xl" : opts.centered ? "max-w-xl" : "max-w-2xl"
        }`}
      >
        <p
          className={`text-[0.68rem] uppercase tracking-[0.32em] text-[var(--rc-muted)] ${
            opts.centered ? "text-center" : ""
          }`}
        >
          Relevé <span className="text-[var(--rc-gold)]">·</span>{" "}
          {opts.eyebrow ?? "Membership"}
        </p>

        {canceled && (
          <div className="mt-6 border-l-2 border-[var(--rc-gold)] bg-[var(--rc-ivory)] px-5 py-4">
            <p className="text-[0.9rem] text-[var(--rc-ink-soft)]">
              No problem — nothing was charged. Your membership is here whenever you&apos;re
              ready.
            </p>
          </div>
        )}

        {/* An abandoned checkout leaves a `pending` row behind forever. Say so
            plainly, so nobody pays twice for something already in flight. */}
        {situation.stalePendingTier && (
          <div className="mt-6 border-l-2 border-[var(--rc-gold)] bg-[var(--rc-ivory)] px-5 py-4">
            <p className="text-[0.9rem] text-[var(--rc-ink-soft)]">
              You started a {getTier(situation.stalePendingTier)?.label} checkout a while ago. If
              you completed it, it&apos;s still confirming and we&apos;ll email you — you
              don&apos;t need to buy again.
            </p>
          </div>
        )}

        {children}

        {/* ── The escape hatch (2026-07-22) ──
            Signing in lands on /profile/edit, which requires an active membership
            and otherwise redirects here. An admin who has no membership — the
            founder's own situation, since nobody has approved her — was therefore
            dumped on this page on EVERY sign-in with no route onward, and no link
            to the admin console anywhere on the site. Kathleen spent an evening
            locked out of her own vetting queue that way.
            It renders in EVERY state, which is why `isAdmin` is a flag alongside
            the membership state rather than a state of its own.

            A DISCREET UTILITY LINK, not a panel (founder direction, 2026-08-18):
            it was a full-width black block, which dominated a page whose whole
            job is to make a member feel welcome. The escape hatch has to exist —
            it does not have to shout. */}
        {situation.isAdmin && (
          <p className={`mt-12 ${opts.centered ? "text-center" : ""}`}>
            <Link
              href="/admin/applications"
              className="text-[0.78rem] tracking-[0.04em] text-[var(--rc-muted)] underline underline-offset-4 transition-colors hover:text-[var(--rc-gold)]"
            >
              Admin · View vetting queue →
            </Link>
          </p>
        )}

        {/* Who am I? Nothing else in the app answers this, and being signed in as
            the wrong account (across a phone, a laptop and a spouse's phone) is
            indistinguishable from the site being broken. */}
        {user && (
          <p
            className={`mt-12 text-[0.72rem] text-[var(--rc-muted)] ${
              opts.centered ? "text-center" : ""
            }`}
          >
            Signed in as {user.email}
          </p>
        )}

        <div className={opts.centered ? "text-center" : ""}>
          <Link
            href="/"
            className="mt-4 inline-block text-[0.8rem] text-[var(--rc-muted)] underline underline-offset-4"
          >
            ← Back to Relevé
          </Link>
        </div>
      </main>
    </div>
  );

  // Slightly more weight and scale than before, still restrained — the H1 is
  // the anchor of the page, not a banner (founder direction, 2026-08-18).
  const h1 = (text: string) => (
    <h1 className="mt-4 text-[clamp(2.25rem,5vw,3.35rem)] font-semibold leading-[1.06] tracking-[-0.2px] text-[var(--rc-ink)]">
      {text}
    </h1>
  );
  const p = (text: string) => (
    <p className="mt-4 max-w-[62ch] text-[1.06rem] leading-[1.7] text-[var(--rc-ink-soft)]">
      {text}
    </p>
  );

  /* ---- one branch per state ---- */
  switch (situation.state) {
    // ── Someone just paid. The most fragile moment in the product. ──
    // No redirect, ever. (Self-refresh and the gated pages are F2.)
    case "pending":
      return shell(
        <>
          {h1("Confirming your payment…")}
          {p(
            "Thank you — we've got it. Your membership is being activated now; this usually takes a moment. You can refresh this page, and we'll email you the moment it's ready.",
          )}
          {situation.hasProfile && buildProfile}
        </>,
      );

    // ── Relevé gave them this. No prices, no manage button, no paywall. ──
    //
    // This state is a WELCOME, not a system status (founder direction,
    // 2026-08-18). It was technically correct and emotionally wrong: a headline
    // announcing an account type, a sentence leading with what the member does
    // not owe, and a black admin slab dominating the page. A founding member
    // arriving here should feel recognised.
    //
    // Deliberately silent on when a complimentary term ends: naming a date turns
    // a gift into a countdown (founder decision, 2026-07-21). `compExpiresAt` is
    // resolved and available — it is simply not spent here.
    case "comp":
      return shell(
        <div className="rc-plate px-8 py-14 sm:px-12">
          <h1 className="text-[clamp(2.25rem,5vw,3.35rem)] font-semibold leading-[1.06] tracking-[-0.2px] text-[var(--rc-ink)]">
            Welcome to Relevé.
          </h1>

          <p className="mt-4 text-[1.3rem] italic leading-[1.5] text-[var(--rc-ink)]">
            You&apos;re here at the beginning.
          </p>

          <hr className="rc-plate-rule" />

          <p className="mx-auto max-w-[46ch] text-[1.06rem] leading-[1.7] text-[var(--rc-ink-soft)]">
            You are one of Relevé&apos;s founding members — here before there was anything to
            join, and part of what this becomes. Your membership is{" "}
            <strong className="font-semibold text-[var(--rc-ink)]">complimentary</strong>, with
            our thanks.
          </p>

          {situation.hasProfile && (
            <>
              <p className="mx-auto mt-4 max-w-[46ch] text-[1.06rem] leading-[1.7] text-[var(--rc-ink-soft)]">
                What comes next is yours to build.
              </p>
              <Link href="/profile/edit" className="rc-cta rc-cta-primary mt-9">
                Build your profile →
              </Link>
            </>
          )}
        </div>,
        { eyebrow: "Founding Member", centered: true },
      );

    // ── A complimentary term has run out. What happens next is F9, and it is
    //    Kathleen's to ratify — so this says what is true and sells nothing. ──
    case "comp_expired":
      return shell(
        <>
          {h1("Your complimentary membership has ended")}
          {p(
            "Thank you for being here at the start — your founding membership covered your first year. We'll be in touch about continuing; nothing changes today, and there's nothing you need to do.",
          )}
          {situation.hasProfile && buildProfile}
        </>,
      );

    case "active_profile_tier":
      return shell(
        <>
          {h1("Your membership is active")}
          {p(
            `You're on ${getTier(situation.tier!)?.label}. Your Roster profile is yours to build and change whenever you like.`,
          )}
          {buildProfile}
          <Chooser situation={situation} tiers={tiers} signedOut={false} wanted={wanted} />
          <ManageBilling situation={situation} />
        </>,
        { wide: true },
      );

    // ── F3. Live Pass is a real membership, and its holder is home. ──
    case "active_live_pass":
      return shell(
        <>
          {h1("Your Live Pass is active")}
          {p(
            "Your family membership is live — everything it includes is below, marked as yours. The other pathways are here too, if you ever want one.",
          )}
          <Chooser
            situation={situation}
            tiers={tiers}
            signedOut={false}
            wanted={wanted}
            creditNote={creditNote}
          />
          <ManageBilling situation={situation} />
        </>,
        { wide: true },
      );

    case "active_studio":
      return shell(
        <>
          {h1("Your studio membership is active")}
          {p(`You're on ${getTier(situation.tier!)?.label}.`)}
          <Link href="/studio" className="rc-cta mt-8">
            Go to your studio →
          </Link>
          <Chooser situation={situation} tiers={tiers} signedOut={false} wanted={wanted} />
          <ManageBilling situation={situation} />
        </>,
        { wide: true },
      );

    // ── A way back, never a locked door. The full fix is F7. ──
    case "lapsed":
      return shell(
        <>
          {h1("There was a problem with your last payment")}
          {p(
            "Your membership is paused, and nothing has been lost — your profile and everything on it are exactly as you left them. Updating your card puts it all back.",
          )}
          <ManageBilling situation={situation} />
        </>,
      );

    case "approved_no_membership":
      return shell(
        <>
          {h1("You're in — welcome")}
          {p(
            "Your application was accepted. Choose the membership that fits, and your profile opens the moment it's active.",
          )}
          <Chooser
            situation={situation}
            tiers={tiers}
            signedOut={false}
            wanted={wanted}
            creditNote={creditNote}
          />
          <ManageBilling situation={situation} />
        </>,
        { wide: true },
      );

    case "applied":
      return shell(
        <>
          {h1("Your application is under review")}
          {p(
            "Thanks for applying — we'll email you the moment there's a decision. In the meantime, there are other ways to be part of Relevé.",
          )}
          <Chooser situation={situation} tiers={tiers} signedOut={false} wanted={wanted} />
          <ManageBilling situation={situation} />
        </>,
        { wide: true },
      );

    case "declined":
      return shell(
        <>
          {h1("Application not accepted")}
          {p(
            "Your application wasn't accepted this round. This is a not-right-now, not a judgment of your work — you're welcome to apply again.",
          )}
          <Chooser situation={situation} tiers={tiers} signedOut={false} wanted={wanted} />
          <ManageBilling situation={situation} />
        </>,
        { wide: true },
      );

    // ── A stranger, or a signed-in member with nothing yet. ──
    case "signed_out":
    case "none":
      return shell(
        <>
          {h1("Join Relevé")}
          {/* Stays italic, by direction. The one editorial line above the grid. */}
          <p className="mt-5 text-[1.3rem] italic leading-[1.5] text-[var(--rc-ink)]">
            One industry. Four ways to belong.
          </p>
          {p(
            "Choose the Relevé membership built for the way you work, create, lead, or grow in dance.",
          )}
          <Chooser
            situation={situation}
            tiers={tiers}
            signedOut={signedOut}
            wanted={wanted}
            creditNote={creditNote}
          />
          <ManageBilling situation={situation} />
        </>,
        { wide: true },
      );
  }
}
