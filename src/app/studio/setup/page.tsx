// /studio/setup — the ONE invite-only studio onboarding door.
//
// (spec: STUDIO-ONBOARDING-ONE-FLOW-FROM-KATHLEEN.md). The full studio builder is
// NEVER reachable without a valid invitation bound to the signed-in email:
//
//   1. The invitation email links here with ?token=<token>.
//   2. Not signed in → /login?next=/studio/setup?token=… (Email OTP, invited email).
//   3. Signed in → the authenticated email MUST equal the invite's email.
//        match    → bind (claim invite + set the profile owner) and render setup.
//        mismatch → refuse. A different email may not claim this invite.
//   4. Invalid / expired / redeemed-by-someone-else token → a clean notice, never
//      the form.
//
// Returning later (no token): a signed-in owner who already holds a studio profile
// lands back in it, pre-filled. Anyone else gets "you need an invitation".
//
// Everything here runs under the SERVICE ROLE (admin client): at bind time the
// signed-in user does not yet own the invited profile, so their own RLS client
// couldn't read it. Once bound (owner_user_id set), the save action uses the
// ordinary RLS client.

import { redirect } from "next/navigation";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import StudioEditor from "../edit/StudioEditor";
import SubmitForReview from "./SubmitForReview";

export const dynamic = "force-dynamic";

type Option = { slug: string; label: string };

type EmployerFields = {
  employer_id: string;
  status: string | null;
  name: string | null;
  artistic_director: string[] | null;
  unique_note: string | null;
  mission: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  promo_video_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  year_founded: number | null;
  student_count_band: string | null;
  staff_count: number | null;
  room_count: number | null;
  nearest_transit: string | null;
  car_required: boolean | null;
  parking: string | null;
  directions_note: string | null;
  culture_note: string | null;
  bio: string | null;
};

type Invite = {
  invite_id: string;
  email: string;
  employer_id: string;
  status: string;
  expires_at: string | null;
  redeemed_by: string | null;
};

const PROFILE_COLUMNS =
  "employer_id, status, name, artistic_director, unique_note, mission, website, instagram, " +
  "tiktok, facebook, promo_video_url, address_line1, address_line2, city, state_province, " +
  "postal_code, country, year_founded, student_count_band, staff_count, room_count, " +
  "nearest_transit, car_required, parking, directions_note, culture_note, bio";

/** A plain, form-less notice page (used for every "can't proceed" case). */
function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-lg flex-1 px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Relevé Connect · For Studios
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{title}</h1>
      <div className="mt-4 text-neutral-600">{children}</div>
      <Link href="/studios" className="mt-8 inline-block text-sm text-neutral-500 underline">
        ← About Founding Studios
      </Link>
    </main>
  );
}

/** Claim the invite for this user and make them the owner of its studio profile. */
async function bindInvite(
  admin: SupabaseClient,
  invite: Invite,
  userId: string,
  email: string,
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Ensure the account row exists FIRST, as `employer`, without ever
  //    downgrading an existing admin/talent role. This must precede binding the
  //    owner: employer_profiles.owner_user_id references public.users(user_id),
  //    so the users row has to exist before the profile can point at it.
  const { data: existingUser } = await admin
    .from("users")
    .select("account_type")
    .eq("user_id", userId)
    .maybeSingle();
  await admin.from("users").upsert(
    {
      user_id: userId,
      email,
      account_type: (existingUser as { account_type?: string } | null)?.account_type ?? "employer",
      status: "active",
    },
    { onConflict: "user_id" },
  );

  // 2. Set the profile owner — but only if it's still unclaimed, so re-visiting
  //    can never steal a profile that's already bound.
  await admin
    .from("employer_profiles")
    .update({ owner_user_id: userId })
    .eq("employer_id", invite.employer_id)
    .is("owner_user_id", null);

  // 3. Claim the invite once. (Status advances to in_progress on the first SAVE,
  //    not merely on sign-in — see the lifecycle table in the spec.)
  if (!invite.redeemed_by) {
    await admin
      .from("founding_studio_invites")
      .update({ redeemed_by: userId, redeemed_at: now })
      .eq("invite_id", invite.invite_id);
  }
}

export default async function StudioSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = rawToken?.trim() || undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();

  let employerId: string;

  if (token) {
    const { data: inviteRow } = await admin
      .from("founding_studio_invites")
      .select("invite_id, email, employer_id, status, expires_at, redeemed_by")
      .eq("token", token)
      .maybeSingle();
    const invite = inviteRow as Invite | null;

    if (!invite || (invite.expires_at && new Date(invite.expires_at) < new Date())) {
      return (
        <Notice title="This invitation isn’t valid">
          <p>
            This link may have expired or already been used. If you believe it should work, reply
            to your invitation email and we&apos;ll sort it out.
          </p>
        </Notice>
      );
    }

    // Not signed in → send them to sign in AS the invited email, and come back here.
    if (!user) {
      redirect(`/login?next=${encodeURIComponent(`/studio/setup?token=${token}`)}&from=studio`);
    }

    // Already claimed by someone else → refuse.
    if (invite.redeemed_by && invite.redeemed_by !== user.id) {
      return (
        <Notice title="This invitation has already been claimed">
          <p>It&apos;s bound to a different account. Please contact Relevé Connect for help.</p>
        </Notice>
      );
    }

    // The gate: the signed-in email must match the invited email.
    if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
      return (
        <Notice title="This invitation was sent to a different email">
          <p>
            It was sent to <span className="font-medium">{invite.email}</span>, but you&apos;re
            signed in as <span className="font-medium">{user.email}</span>.
          </p>
          <p className="mt-3">
            Please sign out and sign back in with <span className="font-medium">{invite.email}</span>{" "}
            to continue.
          </p>
          <form action="/auth/signout" method="post" className="mt-5">
            <button className="text-sm font-medium text-neutral-900 underline" type="submit">
              Sign out
            </button>
          </form>
        </Notice>
      );
    }

    await bindInvite(admin, invite, user.id, user.email ?? "");
    employerId = invite.employer_id;
  } else {
    // No token — a returning owner picking up where they left off.
    if (!user) redirect(`/login?next=${encodeURIComponent("/studio/setup")}&from=studio`);

    const { data: mineRow } = await admin
      .from("employer_profiles")
      .select("employer_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    const mine = mineRow as { employer_id: string } | null;
    if (!mine) {
      return (
        <Notice title="Studio setup is by invitation">
          <p>
            Founding Studios join through a private invitation link. If you&apos;re expecting one,
            check your email — or get in touch below.
          </p>
        </Notice>
      );
    }
    employerId = mine.employer_id;
  }

  // ---- Load the profile + pick-lists + joins (service role) ----------------
  const [stylesRes, concRes, certsRes, profRes] = await Promise.all([
    admin.from("styles").select("slug, label").eq("is_active", true).order("sort_order"),
    admin
      .from("studio_concentrations")
      .select("slug, label")
      .eq("is_active", true)
      .order("sort_order"),
    admin.from("certifications").select("slug, label").eq("is_active", true).order("sort_order"),
    admin.from("employer_profiles").select(PROFILE_COLUMNS).eq("employer_id", employerId).maybeSingle(),
  ]);

  const styleOptions = (stylesRes.data ?? []) as Option[];
  const concentrationOptions = (concRes.data ?? []) as Option[];
  const certOptions = (certsRes.data ?? []) as Option[];
  const e = profRes.data as unknown as EmployerFields | null;

  const [es, ec, ce] = await Promise.all([
    admin.from("employer_styles").select("styles(slug)").eq("employer_id", employerId),
    admin
      .from("employer_concentrations")
      .select("studio_concentrations(slug)")
      .eq("employer_id", employerId),
    admin.from("employer_certifications").select("certifications(slug)").eq("employer_id", employerId),
  ]);
  const slugsOf = (rows: unknown, key: string): string[] =>
    ((rows as Array<Record<string, { slug: string } | { slug: string }[]>>) ?? [])
      .map((r) => {
        const v = r[key];
        return Array.isArray(v) ? v[0]?.slug : v?.slug;
      })
      .filter(Boolean) as string[];

  const status = e?.status ?? "invited";
  const untouched = status === "invited";
  const canSubmit = status === "invited" || status === "in_progress";

  const statusBanner: Record<string, { tone: string; text: string }> = {
    invited: {
      tone: "border-neutral-200 bg-neutral-50 text-neutral-600",
      text: "Draft — saved privately to you. Nothing is public until Relevé reviews and publishes it.",
    },
    in_progress: {
      tone: "border-neutral-200 bg-neutral-50 text-neutral-600",
      text: "Draft — saved privately to you. Submit for review when you're ready; nothing is public until Relevé publishes it.",
    },
    submitted: {
      tone: "border-amber-200 bg-amber-50 text-amber-800",
      text: "Submitted for review. Kathleen will take a look and be in touch — nothing is public yet. You can still edit.",
    },
    approved: {
      tone: "border-sky-200 bg-sky-50 text-sky-800",
      text: "Approved. Relevé will publish your studio page shortly.",
    },
    live: {
      tone: "border-green-200 bg-green-50 text-green-800",
      text: "Live — your studio page is public.",
    },
  };
  const banner = statusBanner[status] ?? statusBanner.in_progress;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Relevé · Founding Studio setup
        </p>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-neutral-500 underline" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <h1 className="mt-2 text-3xl font-semibold text-neutral-900">
        {untouched ? "Set up your studio" : "Your studio"}
      </h1>
      <p className="mt-3 text-neutral-600">
        This is your studio&apos;s home on Relevé — how teachers, choreographers, and families find
        you. Fill in what you can now; you can save and come back any time.
      </p>

      <div className={`mt-5 rounded-lg border px-4 py-3 text-sm ${banner.tone}`}>{banner.text}</div>

      <StudioEditor
        initial={{
          name: e?.name ?? "",
          artistic_director: (e?.artistic_director ?? []).join(", "),
          unique_note: e?.unique_note ?? "",
          mission: e?.mission ?? "",
          website: e?.website ?? "",
          instagram: e?.instagram ?? "",
          tiktok: e?.tiktok ?? "",
          facebook: e?.facebook ?? "",
          promo_video_url: e?.promo_video_url ?? "",
          address_line1: e?.address_line1 ?? "",
          address_line2: e?.address_line2 ?? "",
          city: e?.city ?? "",
          state_province: e?.state_province ?? "",
          postal_code: e?.postal_code ?? "",
          country: e?.country ?? "USA",
          year_founded: e?.year_founded != null ? String(e.year_founded) : "",
          student_count_band: e?.student_count_band ?? "",
          staff_count: e?.staff_count != null ? String(e.staff_count) : "",
          room_count: e?.room_count != null ? String(e.room_count) : "",
          nearest_transit: e?.nearest_transit ?? "",
          car_required: e?.car_required == null ? "" : e.car_required ? "yes" : "no",
          parking: e?.parking ?? "",
          directions_note: e?.directions_note ?? "",
          culture_note: e?.culture_note ?? "",
          bio: e?.bio ?? "",
        }}
        styleOptions={styleOptions}
        concentrationOptions={concentrationOptions}
        certOptions={certOptions}
        selectedStyles={slugsOf(es.data, "styles")}
        selectedConcentrations={slugsOf(ec.data, "studio_concentrations")}
        selectedCerts={slugsOf(ce.data, "certifications")}
      />

      {canSubmit && <SubmitForReview />}

      <Link href="/" className="mt-10 inline-block text-sm text-neutral-500 underline">
        ← Back to Relevé
      </Link>
    </main>
  );
}
