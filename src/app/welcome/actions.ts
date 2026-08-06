"use server";

// The gateway's one action: record which door the person chose, then send them
// through it. Persisting the choice on users.onboarding_intent is what stops the
// gateway reappearing on their next sign-in — resolveSignedInDestination() reads
// it and routes them straight to their flow.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** The four doors, and where each one leads. */
const DESTINATIONS = {
  professional: "/apply", // the existing Roster application
  studio: "/studios/join", // the existing invite/interest page (NOT the Roster)
  team: "/welcome/team", // Dance Team inquiry
  partner: "/welcome/partner", // Industry Partner inquiry
} as const;

type Intent = keyof typeof DESTINATIONS;

/**
 * account_type is IDENTITY only and can't distinguish studio from team from
 * partner — that's what onboarding_intent is for. We still set a sensible
 * account_type on FIRST creation (never a downgrade of an existing admin/etc.),
 * matching how each real onboarding flow sets it.
 */
const ACCOUNT_TYPE_BY_INTENT: Record<Intent, string> = {
  professional: "talent",
  studio: "employer",
  team: "employer",
  partner: "consumer",
};

export async function chooseIntent(formData: FormData): Promise<void> {
  const intent = String(formData.get("intent") ?? "") as Intent;
  if (!(intent in DESTINATIONS)) redirect("/welcome");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/welcome")}`);

  // Only set account_type when the row is first created — never downgrade an
  // existing admin/employer/talent just because they revisited the gateway.
  const { data: existing } = await supabase
    .from("users")
    .select("account_type")
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase.from("users").upsert(
    {
      user_id: user.id,
      email: user.email ?? "",
      account_type:
        (existing as { account_type?: string } | null)?.account_type ??
        ACCOUNT_TYPE_BY_INTENT[intent],
      onboarding_intent: intent,
    },
    { onConflict: "user_id" },
  );

  redirect(DESTINATIONS[intent]);
}
