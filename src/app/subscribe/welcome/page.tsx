// Landing after a successful subscription — the friendly confirmation. The
// webhook is what actually flips the membership active and credits the $30.
//
// ── Why this page reads the Stripe session (2026-08-16) ──
// It used to be a static component: every subscriber, on every tier, was told
// "your $30 application fee has been credited" and pointed at "Build your
// profile". Both are wrong for a Live Pass member — Live Pass pays no $30 fee
// (it isn't vetted) and carries no profile (`hasProfile: false`), so that CTA
// sent a paying member to /profile/edit, which gates on hasActiveProfileTier and
// bounced them straight back to /subscribe. A dead-end loop as the first thing
// they did after paying.
//
// The fix reads the CHECKOUT SESSION, not the database, for two reasons:
//   1. No webhook race. The membership row is written `pending` at checkout and
//      only flips `active` when the webhook lands — observed three minutes later
//      in testing. The session metadata is correct the instant we redirect.
//   2. It describes THIS purchase. A member holding more than one membership row
//      can't be resolved from the database without guessing.
//
// ── The default is NEUTRAL, and that is deliberate ──
// The profile-building path is shown ONLY when the session positively identifies
// a profile-bearing tier. Live Pass, an unrecognised tier, a missing session_id,
// and a failed Stripe lookup all fall to the same neutral confirmation. Getting
// this backwards is what produced the original bug, so the code is arranged so
// that "we don't know" can never produce professional onboarding copy.
//
// Live Pass is primarily the family/minor admission into Relevé through a studio
// or team — NOT a Professional Roster membership (founder clarification
// 2026-08-16). So its CTA is deliberately neutral ("Continue to Relevé") rather
// than pointing at the Roster, until the correct Live Pass / family member home
// is defined.
//
// The $30 line is driven by `credit_fee_id` — the same value the checkout route
// sets when it actually applies the coupon — so it is claimed only when a credit
// was really applied. A Founding 25 honoree (fee waived) or a complimentary
// founding member must never be told a fee was credited when none was paid.

import Link from "next/link";
import { getStripe } from "@/lib/stripe/server";
import { getTier, dollars, type MembershipTier } from "@/lib/membership/tiers";

export const dynamic = "force-dynamic";

/** What this purchase was, resolved from the Stripe Checkout Session. */
type Purchased = {
  tier: MembershipTier | null;
  /** True ONLY when a $30 application-fee credit was actually applied. */
  creditApplied: boolean;
};

async function resolvePurchase(sessionId: string | undefined): Promise<Purchased> {
  if (!sessionId) return { tier: null, creditApplied: false };
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const slug = session.metadata?.tier ?? null;
    return {
      tier: slug ? getTier(slug) : null,
      // Set by /api/membership/checkout only when the coupon was attached.
      creditApplied: Boolean(session.metadata?.credit_fee_id),
    };
  } catch {
    // Bad/expired/foreign session id — fall through to the neutral copy.
    // Never claim a credit, or a tier, we could not confirm.
    return { tier: null, creditApplied: false };
  }
}

export default async function SubscribeWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const { tier, creditApplied } = await resolvePurchase(session_id);

  // Profile onboarding requires POSITIVE identification of a profile-bearing
  // tier. Anything else — Live Pass, unknown tier, no session — is neutral.
  const isProfileTier = tier?.hasProfile === true;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8">
        <p className="text-2xl">🎉</p>
        <h1 className="mt-3 text-2xl font-semibold text-green-900">Welcome to Relevé.</h1>

        {isProfileTier ? (
          /* ---- Professional / Creator — unchanged, except that the $30
                  sentence now appears only when a credit really applied. ---- */
          <>
            <p className="mt-3 text-green-800">
              Your membership is being activated (a moment for the payment to confirm).
              {creditApplied ? " Your $30 application fee has been credited to this first year." : ""}{" "}
              Your membership renews annually, and you can cancel anytime in one click from the
              membership page.
            </p>
            <Link
              href="/profile/edit"
              className="mt-5 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
            >
              Build your profile →
            </Link>
          </>
        ) : (
          /* ---- Live Pass / unknown / no session — NEUTRAL.
                  No $30 language, no profile CTA, no Roster assumption. ---- */
          <>
            <p className="mt-3 text-green-800">
              {tier ? `Your ${tier.label} purchase is complete.` : "Your purchase is complete."} Your
              membership is being activated
              {tier ? ` and renews annually at ${dollars(tier.priceCents)}/year` : ""}. You can
              manage or cancel your membership anytime from the membership page.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
            >
              Continue to Relevé →
            </Link>
          </>
        )}
      </div>
      <Link href="/subscribe" className="mt-6 text-sm text-neutral-500 underline">Manage membership</Link>
    </main>
  );
}
