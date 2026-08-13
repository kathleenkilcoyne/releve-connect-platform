// Membership page — the end of the spine (approved → member).
//
// FREE FOUNDING PERIOD (launch, 2026-07-20): membership is COMPLIMENTARY and is
// granted automatically on acceptance (see grantFoundingMembership in the admin
// approve route). There is no paid checkout here right now, so this page shows
// state, not a price list:
//   · already a member       → complimentary founding membership + build profile
//   · approved (edge case)    → welcome + build profile
//   · applied, under review   → reassure
//   · not applied             → invite to apply
//   · declined                → gentle "not now"
//
// The paid-tier chooser, the $30-credit copy, and the Stripe manage/cancel
// button were removed for the free period. The prior paid version is in git
// history; RESUME-HERE lists exactly what to restore when payment is switched on.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProfessionalApplicant } from "@/lib/membership/families";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/subscribe");

  const db = createAdminClient();

  const { data: appRows } = await db
    .from("applications")
    .select("state, created_at, roles")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const app0 = appRows?.[0] as { state: string; roles: string[] | null } | undefined;
  const appState = app0?.state ?? null;
  const appRoles = app0?.roles ?? null;

  const { data: memRows } = await db
    .from("memberships")
    .select("tier, membership_status, renewal_date")
    .eq("user_id", user.id)
    .eq("membership_status", "active");
  const member =
    ((memRows ?? []) as Array<{ renewal_date: string | null }>)[0] ?? null;

  // Active, in-window $30 activation also grants access — no membership row
  // (unified membership model §3).
  const { data: actRows } = await db
    .from("activations")
    .select("access_expires_at")
    .eq("user_id", user.id)
    .eq("membership_family", "professional")
    .eq("status", "active")
    .gt("access_expires_at", new Date().toISOString())
    .limit(1);
  const activationActive = Boolean(actRows && (actRows as unknown[]).length > 0);

  // ── The trap this escapes (2026-07-22) ──
  // Signing in lands on /profile/edit, which requires an ACTIVE MEMBERSHIP and
  // otherwise redirects here. An admin who has no membership — which is exactly
  // the founder's situation, since nobody has approved her — therefore gets
  // dumped on this page on EVERY sign-in, with no route onward except "Back to
  // Relevé", and no link to the admin console existing anywhere on the site.
  // Kathleen spent an evening locked out of her own vetting queue this way.
  // So: if this person is an admin, always give them the door.
  const { data: roleRow } = await db
    .from("users")
    .select("account_type")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = (roleRow as { account_type?: string } | null)?.account_type === "admin";

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé · Membership
      </p>
      {children}

      {isAdmin && (
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
      <p className="mt-8 text-xs text-neutral-400">Signed in as {user.email}</p>

      <Link href="/" className="mt-4 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );

  const buildProfile = (
    <Link
      href="/profile/edit"
      className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
    >
      Build your profile →
    </Link>
  );

  // Active member — complimentary during the founding period.
  if (member) {
    // No end date is shown, deliberately (founder decision 2026-07-21): naming a
    // date turns a gift into a countdown, and the market will signal when to
    // charge. The membership row still carries `renewal_date` internally.
    return shell(
      <>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
          You&apos;re a founding member 🎉
        </h1>
        <p className="mt-3 text-neutral-600">
          Your membership is complimentary — nothing to pay, nothing to enter. Thank you for being
          here at the start.
        </p>
        {buildProfile}
      </>,
    );
  }

  // Active $30 activation window — access without a founding membership.
  if (activationActive) {
    return shell(
      <>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
          Your Professional access is active
        </h1>
        <p className="mt-3 text-neutral-600">
          You&apos;re activated — build and publish your profile. Your $30 is credited toward your
          continuing Professional subscription when you continue.
        </p>
        {buildProfile}
      </>,
    );
  }

  // Approved but NOT activated → the $30 activation on-ramp (professionals only).
  if (appState === "approved" && isProfessionalApplicant(appRoles)) {
    return shell(
      <>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900">You&apos;ve been accepted 🎉</h1>
        <p className="mt-3 text-neutral-600">
          Activate your Professional Profile to build, publish, and appear on the Roster — 60 days of
          access, and your <span className="font-medium">$30 is credited</span> toward your continuing
          subscription.
        </p>
        <Link
          href="/activate"
          className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
        >
          Activate your profile →
        </Link>
      </>,
    );
  }

  // Approved but not a professional applicant (rare) — a plain welcome.
  if (appState === "approved") {
    return shell(
      <>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900">You&apos;re in — welcome 🎉</h1>
        <p className="mt-3 text-neutral-600">
          You&apos;ve been accepted. We&apos;ll be in touch with your next steps.
        </p>
      </>,
    );
  }

  // Everyone else — guide by application state.
  const message =
    appState === null
      ? {
          h: "Membership is by acceptance",
          p: "Relevé is a vetted community of professionals. Apply to join — every application is reviewed with care.",
          cta: { href: "/welcome", label: "Apply now" },
        }
      : appState === "declined"
        ? {
            h: "Application not accepted",
            p: "Your application wasn't accepted this round. This is a not-right-now, not a judgment of your work — you're welcome to apply again.",
            cta: null,
          }
        : {
            h: "Your application is under review",
            p: "Thanks for applying — we'll email you the moment there's a decision. Your complimentary founding membership opens as soon as you're accepted.",
            cta: null,
          };

  return shell(
    <>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">{message.h}</h1>
      <p className="mt-3 text-neutral-600">{message.p}</p>
      {message.cta && (
        <Link
          href={message.cta.href}
          className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
        >
          {message.cta.label}
        </Link>
      )}
    </>,
  );
}
