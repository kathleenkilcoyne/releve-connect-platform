// The application intake — the vetting gate's front door (build spec §4).
// Signed-in only, so the application ties to the person under RLS. Loads the
// controlled-vocabulary pick-lists, then hands off to the interactive form.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ApplyForm from "./ApplyForm";

export const dynamic = "force-dynamic";

type Option = { slug: string; label: string };

export default async function ApplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/apply");

  const [rolesRes, stylesRes, levelsRes, focusRes, openToRes] = await Promise.all([
    supabase.from("role_types").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("styles").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("levels").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("focus_areas").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("open_to_badges").select("slug, label").eq("is_active", true).order("sort_order"),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé · Apply to the Roster
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
        Apply for a vetted Relevé profile
      </h1>
      <p className="mt-3 text-neutral-600">
        This is the vetted, credentialed home for dance professionals. Tell us who you are in your
        own words — a real person reads every application.{" "}
        <span className="font-medium">Applying is free, and founding members get their first year
        of membership free too.</span>
      </p>

      <ApplyForm
        email={user.email ?? ""}
        roleOptions={(rolesRes.data ?? []) as Option[]}
        styleOptions={(stylesRes.data ?? []) as Option[]}
        levelOptions={(levelsRes.data ?? []) as Option[]}
        focusOptions={(focusRes.data ?? []) as Option[]}
        openToOptions={(openToRes.data ?? []) as Option[]}
      />

      <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
