// Activate membership — the end of the spine (approved → subscribe → active).
// Signed-in only. Shows the right state: apply first · under review · approved
// (pick a tier) · already a member (manage/cancel).

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TIERS, dollars } from "@/lib/membership/tiers";
import SubscribeButtons from "./SubscribeButtons";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/subscribe");

  const db = createAdminClient();

  // Latest application state for this user.
  const { data: appRows } = await db
    .from("applications")
    .select("state, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const appState = (appRows?.[0] as { state: string } | undefined)?.state ?? null;

  // Any active membership?
  const { data: memRows } = await db
    .from("memberships")
    .select("tier, membership_status")
    .eq("user_id", user.id)
    .eq("membership_status", "active");
  const activeTiers = ((memRows ?? []) as Array<{ tier: string }>).map((m) => m.tier);
  const hasActiveProfileTier =
    activeTiers.includes("professional") || activeTiers.includes("professional_full");

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">Relevé · Membership</p>
      {children}
      <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">← Back to Relevé</Link>
    </main>
  );

  // Already a member → manage / cancel.
  if (hasActiveProfileTier) {
    return shell(
      <>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900">You&apos;re a member 🎉</h1>
        <p className="mt-3 text-neutral-600">
          Your membership is active and renews annually. You can update your card or cancel anytime —
          one click.
        </p>
        <div className="mt-6"><SubscribeButtons mode="manage" /></div>
        <p className="mt-6 text-sm text-neutral-500">
          Next: <Link href="/profile/edit" className="underline">build your profile →</Link>
        </p>
      </>,
    );
  }

  // Not approved yet → guide them.
  if (appState !== "approved") {
    const message =
      appState === null
        ? { h: "Start with your application", p: "A Relevé profile is vetted. Apply first — a real person reviews every application." , cta: { href: "/apply", label: "Apply now" } }
        : appState === "declined"
        ? { h: "Application not accepted", p: "Your application wasn't accepted this round, and your $30 was refunded in full. You're welcome to reapply in the future.", cta: null }
        : { h: "Your application is under review", p: "Thanks for applying — we'll email you the moment there's a decision. Membership opens as soon as you're approved.", cta: null };
    return shell(
      <>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900">{message.h}</h1>
        <p className="mt-3 text-neutral-600">{message.p}</p>
        {message.cta && (
          <Link href={message.cta.href} className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white">
            {message.cta.label}
          </Link>
        )}
      </>,
    );
  }

  // Approved → choose a tier.
  const pro = TIERS.professional;
  const full = TIERS.professional_full;
  return shell(
    <>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">You&apos;re approved — activate your membership</h1>
      <p className="mt-3 text-neutral-600">
        Your <span className="font-medium">$30 is credited in full</span> toward your first year. Choose your tier:
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 p-5">
          <h2 className="text-lg font-semibold text-neutral-900">{pro.label}</h2>
          <p className="mt-1 text-2xl font-semibold">{dollars(pro.priceCents)}<span className="text-sm font-normal text-neutral-500">/year</span></p>
          <p className="mt-2 text-sm text-neutral-600">Your vetted Roster profile, set your own rate at/above the $50/hr floor.</p>
          <div className="mt-4"><SubscribeButtons mode="subscribe" tier="professional" label={`Activate ${pro.label}`} /></div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-5">
          <h2 className="text-lg font-semibold text-neutral-900">{full.label}</h2>
          <p className="mt-1 text-2xl font-semibold">{dollars(full.priceCents)}<span className="text-sm font-normal text-neutral-500">/year</span></p>
          <p className="mt-2 text-sm text-neutral-600">Everything in Professional, plus multi-role and the Marketplace + Audition Library.</p>
          <div className="mt-4"><SubscribeButtons mode="subscribe" tier="professional_full" label={`Activate ${full.label}`} /></div>
        </div>
      </div>

      <p className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">
        <span className="font-medium">Annual, auto-renewing.</span> Your card is charged today and once a
        year after that. We&apos;ll email you about 2 weeks before each renewal, and you can cancel anytime
        in one click. The $30 application fee is credited to this first year.
      </p>
    </>,
  );
}
