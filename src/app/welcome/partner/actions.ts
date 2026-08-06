"use server";

// Industry Partner (The Beat) inquiry — the WRITE.
//
// Short interest capture into partner_interest (default-deny RLS) + ONE internal
// admin alert. NOT a self-serve advertiser dashboard — that comes later.
// Idempotent, same as the team form.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPartnerInterestAlert } from "@/lib/notifications";

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}
function orNull(v: FormDataEntryValue | null): string | null {
  const s = clean(v);
  return s === "" ? null : s;
}

export async function submitPartnerInterest(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/welcome/partner")}`);

  const orgName = clean(formData.get("org_name"));
  const contactName = clean(formData.get("contact_name"));
  if (!orgName || !contactName) redirect("/welcome/partner?error=1");

  const admin = createAdminClient();

  const { data: already } = await admin
    .from("partner_interest")
    .select("interest_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!already) {
    await admin.from("partner_interest").insert({
      user_id: user.id,
      org_name: orgName,
      org_type: orNull(formData.get("org_type")),
      contact_name: contactName,
      contact_title: orNull(formData.get("contact_title")),
      website_or_social: orNull(formData.get("website_or_social")),
      participation: orNull(formData.get("participation")),
      message: orNull(formData.get("message")),
    });

    await sendPartnerInterestAlert({
      orgName,
      orgType: orNull(formData.get("org_type")),
      contactName,
      contactTitle: orNull(formData.get("contact_title")),
      websiteOrSocial: orNull(formData.get("website_or_social")),
      participation: orNull(formData.get("participation")),
      message: orNull(formData.get("message")),
      email: user.email ?? null,
    });
  }

  redirect("/welcome/partner?sent=1");
}
