// The membership page — the single canonical membership chooser and the billing
// home (founder decision, payment sprint 2026-08-18).
//
// ── What this page is ──
// One page carrying: the tiers, the prices, what each includes, the purchase
// button, and the manage/cancel button. Every gated page in the app already
// redirects here, so getting this page right closes several dead ends at once.
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
import { tierCopy } from "@/lib/membership/tier-copy";
import {
  offeredTiers,
  professionalPathway,
  resolveMembershipSituation,
  type MembershipSituation,
  type MembershipStateRow,
} from "@/lib/membership/state";
import SubscribeButtons from "./SubscribeButtons";

export const dynamic = "force-dynamic";

/* ───────────────────────────── pieces ───────────────────────────── */

function TierCard({
  slug,
  signedOut,
  emphasis,
  note,
}: {
  slug: TierSlug;
  signedOut: boolean;
  emphasis: boolean;
  note?: string | null;
}) {
  const tier = getTier(slug)!;
  const copy = tierCopy(slug);

  return (
    <div
      className={`rounded-2xl border p-6 ${
        emphasis ? "border-neutral-900 bg-white shadow-sm" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-semibold text-neutral-900">{tier.label}</h3>
        <p className="whitespace-nowrap text-lg font-semibold text-neutral-900">
          {dollars(tier.priceCents)}
          <span className="text-sm font-normal text-neutral-500">/year</span>
        </p>
      </div>
      <p className="mt-1 text-sm text-neutral-600">{copy.tagline}</p>

      <ul className="mt-4 space-y-1.5">
        {copy.includes.map((line) => (
          <li key={line} className="flex gap-2 text-sm text-neutral-700">
            <span aria-hidden className="text-neutral-400">
              ·
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {note && <p className="mt-4 text-sm font-medium text-neutral-900">{note}</p>}

      <div className="mt-5">
        {signedOut ? (
          <Link
            href={`/login?next=${encodeURIComponent(`/subscribe?tier=${slug}`)}`}
            className="inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
          >
            Join with {tier.label} →
          </Link>
        ) : (
          <SubscribeButtons mode="subscribe" tier={slug} label={`Join with ${tier.label}`} />
        )}
      </div>

      {/* Annual auto-renewal is disclosed at the point of purchase, not buried
          in a confirmation email after the card has been taken. */}
      <p className="mt-3 text-xs text-neutral-500">
        Billed annually. Renews each year, and you can cancel anytime in one click.
      </p>
    </div>
  );
}

function TierList({
  slugs,
  signedOut,
  wanted,
  creditNote,
}: {
  slugs: TierSlug[];
  signedOut: boolean;
  wanted?: string | null;
  creditNote?: string | null;
}) {
  if (slugs.length === 0) return null;
  return (
    <div className="mt-8 grid gap-4">
      {slugs.map((slug) => (
        <TierCard
          key={slug}
          slug={slug}
          signedOut={signedOut}
          // Someone who chose a tier before signing in comes back to it framed.
          emphasis={slugs.length === 1 || wanted === slug}
          note={slug === "professional" || slug === "professional_full" ? creditNote : null}
        />
      ))}
    </div>
  );
}

/** The one condition the manage/cancel button renders on (F4 + F11). */
function ManageBilling({ situation }: { situation: MembershipSituation }) {
  if (!situation.canManageBilling) return null;
  return (
    <div className="mt-8 border-t border-neutral-200 pt-6">
      <SubscribeButtons mode="manage" />
      <p className="mt-2 text-xs text-neutral-500">
        Update your card, see past invoices, or cancel — all in one place.
      </p>
    </div>
  );
}

/**
 * The Professional Roster is a PATHWAY, not an upsell (founder rule
 * 2026-08-18). Someone who has not been vetted is invited to apply; they are
 * never handed a checkout button that would 403.
 *
 * ── Why this points at /welcome and NOT /apply (founder rule 2026-08-18) ──
 * `/welcome` is the intended front door: it asks how someone is joining and
 * routes them into the right onboarding path. `/apply` is the raw Roster
 * application that sits behind it. `welcome/page.tsx` records the exact funnel
 * it was built to prevent — "/profile/edit → /subscribe → /apply" — which
 * pushed studios, teams and partners into the Roster application because
 * nothing asked them first. Linking straight to /apply from here would rebuild
 * that funnel from this page.
 *
 * Nothing on that path touches an existing membership: /welcome writes only
 * `users.onboarding_intent`, and an application is its own row. A Live Pass
 * member keeps their Live Pass throughout — the resolver still returns
 * `active_live_pass` while their application is submitted and under review,
 * which is asserted in state.test.ts.
 */
function ProfessionalPath({ situation }: { situation: MembershipSituation }) {
  const path = professionalPathway(situation);
  if (path === "none" || path === "purchase") return null;

  return (
    <div className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <p className="text-sm font-medium text-neutral-900">
        Are you a dance professional?
      </p>
      {path === "apply" ? (
        <>
          <p className="mt-1 text-sm text-neutral-600">
            The Professional Roster is a separate, vetted membership — a built profile that
            studios search. We&apos;ll walk you through it, and anything you already have with
            Relevé stays exactly as it is.
          </p>
          <Link
            href="/welcome"
            className="mt-4 inline-block rounded-lg border border-neutral-900 px-5 py-2.5 text-sm font-medium text-neutral-900"
          >
            Apply for Professional membership →
          </Link>
        </>
      ) : (
        <p className="mt-1 text-sm text-neutral-600">
          Your Professional application is with us — we&apos;ll email you the moment there&apos;s
          a decision.
        </p>
      )}
    </div>
  );
}

const buildProfile = (
  <Link
    href="/profile/edit"
    className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
  >
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
    if (app && (applicationState === "approved")) {
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

  /* ---- the frame every state shares ---- */
  const shell = (children: React.ReactNode) => (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé · Membership
      </p>

      {canceled && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm text-neutral-700">
            No problem — nothing was charged. Your membership is here whenever you&apos;re ready.
          </p>
        </div>
      )}

      {/* An abandoned checkout leaves a `pending` row behind forever. Say so
          plainly, so nobody pays twice for something already in flight. */}
      {situation.stalePendingTier && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            You started a {getTier(situation.stalePendingTier)?.label} checkout a while ago. If
            you completed it, it&apos;s still confirming and we&apos;ll email you — you don&apos;t
            need to buy again.
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
          the membership state rather than a state of its own. */}
      {situation.isAdmin && (
        <div className="mt-8 rounded-xl border border-neutral-900 bg-neutral-900 p-5">
          <p className="text-sm font-medium text-white">You&apos;re signed in as an admin.</p>
          <p className="mt-1 text-sm text-neutral-300">
            This page is about membership — it isn&apos;t where you review applications.
          </p>
          <Link
            href="/admin/applications"
            className="mt-4 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-neutral-900"
          >
            Go to the vetting queue →
          </Link>
        </div>
      )}

      {/* Who am I? Nothing else in the app answers this, and being signed in as
          the wrong account (across a phone, a laptop and a spouse's phone) is
          indistinguishable from the site being broken. */}
      {user && <p className="mt-8 text-xs text-neutral-400">Signed in as {user.email}</p>}

      <Link href="/" className="mt-4 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );

  const h1 = (text: string) => (
    <h1 className="mt-2 text-3xl font-semibold text-neutral-900">{text}</h1>
  );
  const p = (text: string) => <p className="mt-3 text-neutral-600">{text}</p>;

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
    case "comp":
      return shell(
        <>
          {h1("You're a founding member 🎉")}
          {p(
            "Your membership is complimentary — nothing to pay, nothing to enter. Thank you for being here at the start.",
          )}
          {situation.hasProfile && buildProfile}
        </>,
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
          <TierList slugs={tiers} signedOut={false} wanted={wanted} />
          <ManageBilling situation={situation} />
        </>,
      );

    // ── F3. Live Pass is a real membership, and its holder is home. ──
    case "active_live_pass":
      return shell(
        <>
          {h1("Your Live Pass is active")}
          {p("Here's what your family membership includes.")}
          <ul className="mt-5 space-y-1.5">
            {tierCopy("live_pass").includes.map((line) => (
              <li key={line} className="flex gap-2 text-sm text-neutral-700">
                <span aria-hidden className="text-neutral-400">
                  ·
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <ProfessionalPath situation={situation} />
          <TierList slugs={tiers} signedOut={false} wanted={wanted} creditNote={creditNote} />
          <ManageBilling situation={situation} />
        </>,
      );

    case "active_studio":
      return shell(
        <>
          {h1("Your studio membership is active")}
          {p(`You're on ${getTier(situation.tier!)?.label}.`)}
          <Link
            href="/studio"
            className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
          >
            Go to your studio →
          </Link>
          <TierList slugs={tiers} signedOut={false} wanted={wanted} />
          <ManageBilling situation={situation} />
        </>,
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
          {h1("You're in — welcome 🎉")}
          {p(
            "Your application was accepted. Choose the membership that fits, and your profile opens the moment it's active.",
          )}
          <TierList slugs={tiers} signedOut={false} wanted={wanted} creditNote={creditNote} />
          <ManageBilling situation={situation} />
        </>,
      );

    case "applied":
      return shell(
        <>
          {h1("Your application is under review")}
          {p(
            "Thanks for applying — we'll email you the moment there's a decision. In the meantime, a Live Pass brings your whole family into Relevé.",
          )}
          <TierList slugs={tiers} signedOut={false} wanted={wanted} />
          <ManageBilling situation={situation} />
        </>,
      );

    case "declined":
      return shell(
        <>
          {h1("Application not accepted")}
          {p(
            "Your application wasn't accepted this round. This is a not-right-now, not a judgment of your work — you're welcome to apply again.",
          )}
          <TierList slugs={tiers} signedOut={false} wanted={wanted} />
          <ManageBilling situation={situation} />
        </>,
      );

    // ── A stranger, or a signed-in member with nothing yet. ──
    case "signed_out":
    case "none":
      return shell(
        <>
          {h1("Join Relevé")}
          {p(
            "One membership, one year. Choose the one that fits — and if you're a dance professional, the Roster is an application away.",
          )}
          <TierList slugs={tiers} signedOut={signedOut} wanted={wanted} />
          <ProfessionalPath situation={situation} />
          <ManageBilling situation={situation} />
        </>,
      );
  }
}
