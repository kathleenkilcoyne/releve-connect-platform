// Industry Partner (The Beat) inquiry — the page.
//
// Same two-state shape as the team page: a returning partner-intent user sees
// their confirmation, a first-time one sees the short form. Interim real inquiry
// (captures + alerts an admin); NOT a self-serve advertiser dashboard yet.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitPartnerInterest } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Partner with Relevé",
  description: "Reach the dance world through Relevé. Tell us about your organization.",
};

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none";

export default async function PartnerInquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/welcome/partner")}`);

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("partner_interest")
    .select("org_name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-16">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-8">
          <p className="text-2xl">💛</p>
          <h1 className="mt-3 text-2xl font-semibold text-green-900">Thanks — we&apos;ve got it.</h1>
          <p className="mt-3 text-green-800">
            We received your note about{" "}
            <span className="font-medium">{(existing as { org_name: string }).org_name}</span>.
            Someone from Relevé will be in touch by email to talk through how we can work together.
          </p>
        </div>
        <Link href="/" className="mt-8 text-sm text-neutral-500 underline">
          ← Back to Relevé
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect · Industry Partners
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Partner with Relevé.</h1>
      <p className="mt-3 text-neutral-600">
        Brands, vendors, and organizations that want to reach the dance world — tell us who you are
        and how you&apos;d like to work together. We&apos;ll take it from there.
      </p>

      {error && (
        <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Please add at least your organization name and a contact name.
        </p>
      )}

      <form action={submitPartnerInterest} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Organization name</span>
          <input name="org_name" required className={inputCls} placeholder="Your company or organization" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Organization type</span>
          <input
            name="org_type"
            className={inputCls}
            placeholder="e.g. dancewear brand, vendor, media, education, sponsor"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Contact name</span>
            <input name="contact_name" required className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Title</span>
            <input name="contact_title" className={inputCls} placeholder="Your role" />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">Website or social link</span>
          <input name="website_or_social" className={inputCls} placeholder="https:// or @handle" />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            How would you like to participate?
          </span>
          <textarea
            name="participation"
            className={`${inputCls} min-h-[90px]`}
            placeholder="Advertising on The Beat, sponsoring, offering something to members…"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            Anything else? <span className="text-neutral-400">(optional)</span>
          </span>
          <textarea name="message" className={`${inputCls} min-h-[70px]`} />
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Send to Relevé
        </button>
      </form>

      <Link href="/welcome" className="mt-8 inline-block text-sm text-neutral-500 underline">
        ← Not an industry partner? Choose again
      </Link>
    </main>
  );
}
