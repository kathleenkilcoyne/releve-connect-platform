// /activate — the Professional Roster activation screen.
//
// An APPROVED professional who hasn't activated pays $30 to begin 60 days of
// Professional access, credited toward their continuing subscription. Vetting is
// never touched here — approval already happened; this is the paid activation of
// an already-approved professional.
//
// Guards:
//   not signed in                → /login
//   already has access           → /profile/edit (nothing to activate)
//   not an approved professional → /subscribe (which explains their state)

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasActiveProfessionalAccess } from "@/lib/membership/access";
import { isProfessionalApplicant } from "@/lib/membership/families";
import ActivateButton from "./ActivateButton";

export const dynamic = "force-dynamic";

export default async function ActivatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/activate");

  // Already activated (membership or an active window) → straight to the builder.
  if (await hasActiveProfessionalAccess(supabase, user.id)) redirect("/profile/edit");

  // Must be an approved professional to activate.
  const db = createAdminClient();
  const { data: appRow } = await db
    .from("applications")
    .select("state, roles")
    .eq("user_id", user.id)
    .eq("state", "approved")
    .maybeSingle();
  const application = appRow as { state: string; roles: string[] | null } | null;
  if (!application || !isProfessionalApplicant(application.roles)) redirect("/subscribe");

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé · Professional Roster
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-neutral-900">
        You&apos;ve been accepted to the Relevé Professional Roster.
      </h1>
      <p className="mt-4 text-neutral-600">
        Activate your Professional Profile to build, publish, and appear on the Roster where studios
        find you.
      </p>

      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold text-neutral-900">Activate · $30</span>
          <span className="text-sm text-neutral-500">60 days of Professional access</span>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-neutral-700">
          <li>• Your full <span className="font-medium">$30 is credited</span> toward your continuing Professional subscription.</li>
          <li>• Build, publish, and share your professional profile.</li>
          <li>• Appear on the Roster.</li>
        </ul>
        <div className="mt-6">
          <ActivateButton />
        </div>
        <p className="mt-3 text-xs text-neutral-400">Transactions are handled securely by Stripe.</p>
      </div>

      <p className="mt-6 text-sm text-neutral-500">
        You&apos;re accepted either way — activation is what turns your live profile on.
      </p>
      <Link href="/" className="mt-8 inline-block text-sm text-neutral-500 underline">
        Not now — I&apos;ll stay approved and activate later
      </Link>
    </main>
  );
}
