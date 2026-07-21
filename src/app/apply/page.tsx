// The application intake — the vetting gate's front door (build spec §4).
// Signed-in only, so the application ties to the person under RLS. Loads the
// controlled-vocabulary pick-lists and any saved draft, then hands off to the
// interactive form.
//
// ── Re-entry (the bug this fixes) ──
// Previously this page ALWAYS rendered an empty form. A returning applicant saw
// a blank page, and submitting it silently OVERWROTE the application they had
// already sent — or quietly created a second one. Now the page looks first:
//   · a saved draft        → rehydrate the form exactly as they left it
//   · already submitted    → show its status; do NOT render an editable form
//   · nothing yet          → a fresh form, as before

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ApplyForm from "./ApplyForm";

export const dynamic = "force-dynamic";

type Option = { slug: string; label: string };

/** Applicant-facing copy for an application that is no longer editable. */
const STATUS_COPY: Record<string, { title: string; body: string }> = {
  submitted: {
    title: "Your application is in.",
    body: "It's with the council now. We'll email you as soon as there's a decision — there's nothing else you need to do.",
  },
  "in-review": {
    title: "Your application is in review.",
    body: "A member of the Relevé council reads every application personally. We'll email you as soon as there's a decision.",
  },
  "more-info": {
    title: "We've asked you for a little more.",
    body: "Check your email — we've sent a note about what we need. Just reply to it and we'll pick things up from there.",
  },
  approved: {
    title: "You're in — welcome to Relevé.",
    body: "Your application was accepted. The next step is your profile.",
  },
  declined: {
    title: "An update on your application.",
    body: "We weren't able to move forward this time. This is a not-right-now, not a judgment of your work — you're welcome to apply again.",
  },
};

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string }>;
}) {
  const { resume } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Preserve the resume token through sign-in, so a link from the email lands
  // back here rather than dumping them on a blank form.
  if (!user) {
    const next = resume ? `/apply?resume=${encodeURIComponent(resume)}` : "/apply";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  // My most recent application, whatever state it's in. RLS scopes this to me.
  const { data: mine } = await supabase
    .from("applications")
    .select("application_id, state, draft_fields, draft_saved_at, resume_expires_at, submitted_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existing = mine as {
    application_id: string;
    state: string;
    draft_fields: Record<string, string | string[]> | null;
    draft_saved_at: string | null;
    resume_expires_at: string | null;
    submitted_at: string | null;
  } | null;

  // ── Already submitted → status, not an editable form ──────────────────────
  if (existing && existing.state !== "draft") {
    const copy = STATUS_COPY[existing.state] ?? {
      title: "Your application is with us.",
      body: "We'll be in touch by email.",
    };
    const submitted = existing.submitted_at
      ? new Date(existing.submitted_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;

    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · Apply to the Roster
        </p>
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-8">
          <h1 className="text-2xl font-semibold text-neutral-900">{copy.title}</h1>
          <p className="mt-3 text-neutral-600">{copy.body}</p>
          {submitted && (
            <p className="mt-4 text-sm text-neutral-500">Submitted {submitted}.</p>
          )}
          {existing.state === "approved" && (
            <Link
              href="/profile/edit"
              className="mt-6 inline-block rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Build your profile →
            </Link>
          )}
          <p className="mt-6 text-xs text-neutral-500">
            Need to change something? Reply to any email from us and we&apos;ll sort it out —
            your application stays exactly as you sent it.
          </p>
        </div>
        <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">
          ← Back to Relevé
        </Link>
      </main>
    );
  }

  const [rolesRes, stylesRes, levelsRes, focusRes, openToRes] = await Promise.all([
    supabase.from("role_types").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("styles").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("levels").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("focus_areas").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("open_to_badges").select("slug, label").eq("is_active", true).order("sort_order"),
  ]);

  // Note: a draft whose 14-day window has passed still opens. The work is theirs
  // and discarding it would be gratuitous — the window governs the emailed LINK,
  // not their right to their own words.
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé · Apply to the Roster
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Apply to Relevé</h1>
      <p className="mt-2 text-lg italic text-neutral-500">This is your stage. Take your time.</p>

      <div className="mt-5 space-y-3 text-neutral-600">
        <p>
          You&apos;ll notice this application asks a lot. That&apos;s on purpose.{" "}
          <span className="font-medium text-neutral-900">
            Every application is personally reviewed.
          </span>{" "}
          It is lengthy because we are thorough — so that one day we can stand behind your name and
          say, <em>this is one of ours.</em>
        </p>
        <p>
          <span className="font-medium text-neutral-900">Your progress saves as you go</span>, so
          you can step away and come back whenever you need to. Answer honestly — there are no wrong
          answers here, only your true ones.
        </p>
        <p className="font-medium text-neutral-900">You belong here. You matter here.</p>
      </div>

      {existing?.draft_saved_at && (
        <p className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          <span className="font-medium text-neutral-900">Welcome back.</span> We&apos;ve restored
          your application from{" "}
          {new Date(existing.draft_saved_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          . Nothing has been submitted yet.
        </p>
      )}

      <ApplyForm
        email={user.email ?? ""}
        initial={existing?.draft_fields ?? null}
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
