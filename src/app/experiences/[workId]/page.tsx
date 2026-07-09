// The $499 Signature Experience page — sales/paywall when locked, the gated
// deliverables when unlocked (spec §6).
//
// Access is granted when there is a PAID experience_purchase for this work that
// belongs to the viewer. Two ways to be "the viewer":
//   • Post-purchase: the Stripe success_url returns here with ?session_id=… ,
//     which we match to a paid purchase for this work. (Works today, no login.)
//   • Logged-in buyer: once Supabase Auth is wired, a signed-in buyer with a
//     paid purchase for this work sees it on any visit. (Auth-ready seam below.)
//
// Reads use the admin client on the server so the public sales page works for
// logged-out visitors; gated fields are only rendered once access is confirmed.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { bookingLinks } from "@/lib/notifications";
import BuyButton from "./BuyButton";

export const dynamic = "force-dynamic";

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

/** Turn a Vimeo URL into its player embed URL (best-effort). */
function vimeoEmbed(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : url;
}

async function viewerHasAccess(
  db: ReturnType<typeof createAdminClient>,
  workId: string,
  sessionId?: string,
): Promise<boolean> {
  // Path 1 — post-purchase return via Stripe session id.
  if (sessionId) {
    const { data } = await db
      .from("experience_purchases")
      .select("id")
      .eq("signature_work_id", workId)
      .eq("stripe_checkout_session_id", sessionId)
      .eq("status", "paid")
      .maybeSingle();
    if (data) return true;
  }

  // Path 2 — logged-in buyer (auth-ready; a no-op until Supabase Auth is wired).
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await db
        .from("experience_purchases")
        .select("id")
        .eq("signature_work_id", workId)
        .eq("buyer_user_id", user.id)
        .eq("status", "paid")
        .maybeSingle();
      if (data) return true;
    }
  } catch {
    // No auth session — fine.
  }

  return false;
}

export default async function ExperiencePage({
  params,
  searchParams,
}: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<{ session_id?: string; canceled?: string }>;
}) {
  const { workId } = await params;
  const { session_id, canceled } = await searchParams;
  const db = createAdminClient();

  const { data } = await db
    .from("signature_works")
    .select(
      "id, title, style, length_label, level, built_for, price_cents, status, " +
        "artistic_intent, music_note, count_sheet_url, vimeo_performance_url, vimeo_breakdown_url, " +
        "talent_profiles!inner(display_name)",
    )
    .eq("id", workId)
    .single();

  // Untyped Supabase client → cast the embedded-join row to an explicit shape.
  const work = data as unknown as {
    id: string;
    title: string;
    style: string | null;
    length_label: string | null;
    level: string | null;
    built_for: string | null;
    price_cents: number;
    status: string;
    artistic_intent: string | null;
    music_note: string | null;
    count_sheet_url: string | null;
    vimeo_performance_url: string | null;
    vimeo_breakdown_url: string | null;
    talent_profiles: { display_name: string | null } | { display_name: string | null }[];
  } | null;

  if (!work || work.status !== "published") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">Experience not found</h1>
        <p className="mt-3 text-neutral-600">
          This Signature Experience isn’t available. It may be unpublished or the link is wrong.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm text-neutral-500 underline">
          ← Back to Relevé
        </Link>
      </main>
    );
  }

  const artist = Array.isArray(work.talent_profiles)
    ? work.talent_profiles[0]
    : work.talent_profiles;
  const artistName = artist?.display_name ?? "Relevé Artist";
  const hasAccess = await viewerHasAccess(db, workId, session_id);

  // -------------------------------------------------------------- UNLOCKED
  if (hasAccess) {
    const links = bookingLinks();
    const perf = vimeoEmbed(work.vimeo_performance_url);
    const breakdown = vimeoEmbed(work.vimeo_breakdown_url);

    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Signature Experience · Unlocked
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900">{work.title}</h1>
        <p className="mt-1 text-neutral-600">with {artistName}</p>

        {perf && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">Performance</h2>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={perf}
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        )}

        {breakdown && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">Breakdown</h2>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={breakdown}
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        )}

        {work.artistic_intent && (
          <section className="mt-10">
            <h2 className="mb-2 text-lg font-semibold text-neutral-900">Artistic intent</h2>
            <p className="whitespace-pre-line text-neutral-700">{work.artistic_intent}</p>
          </section>
        )}

        {work.music_note && (
          <section className="mt-8">
            <h2 className="mb-2 text-lg font-semibold text-neutral-900">Music</h2>
            <p className="text-neutral-700">{work.music_note}</p>
          </section>
        )}

        <section className="mt-10 flex flex-wrap gap-4">
          {work.count_sheet_url && (
            <a
              href={work.count_sheet_url}
              className="rounded-lg border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              ⬇ Count sheet
            </a>
          )}
          {links.founderWelcomeUrl && (
            <a
              href={links.founderWelcomeUrl}
              className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Book your Welcome call
            </a>
          )}
          {links.checkinUrl && (
            <a
              href={links.checkinUrl}
              className="rounded-lg border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Book your Check-In
            </a>
          )}
        </section>

        {(!links.founderWelcomeUrl || !links.checkinUrl) && (
          <p className="mt-6 text-xs text-neutral-400">
            (Booking links appear here once configured.)
          </p>
        )}
      </main>
    );
  }

  // ---------------------------------------------------------------- LOCKED
  return (
    <main className="mx-auto max-w-2xl px-6 py-20 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Signature Experience
      </p>
      <h1 className="mt-2 text-4xl font-semibold text-neutral-900">{work.title}</h1>
      <p className="mt-2 text-lg text-neutral-600">with {artistName}</p>

      <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm text-neutral-500">
        {work.style && <span className="rounded-full bg-neutral-100 px-3 py-1">{work.style}</span>}
        {work.length_label && (
          <span className="rounded-full bg-neutral-100 px-3 py-1">{work.length_label}</span>
        )}
        {work.level && <span className="rounded-full bg-neutral-100 px-3 py-1">{work.level}</span>}
      </div>

      {work.built_for && <p className="mt-6 text-neutral-700">Built for {work.built_for}</p>}
      {work.artistic_intent && (
        <p className="mx-auto mt-4 max-w-xl text-neutral-600">
          {work.artistic_intent.slice(0, 240)}
          {work.artistic_intent.length > 240 ? "…" : ""}
        </p>
      )}

      {canceled && (
        <p className="mt-8 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Checkout canceled — you have not been charged.
        </p>
      )}

      <div className="mt-10">
        <BuyButton workId={work.id} priceLabel={dollars(work.price_cents)} />
      </div>

      <p className="mt-6 text-sm text-neutral-500">
        Includes private performance + breakdown video, count sheet, and Year 1 of Relevé Access.
      </p>
    </main>
  );
}
