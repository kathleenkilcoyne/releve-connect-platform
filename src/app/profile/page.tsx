// /profile — "My Professional Home" (Slice 1).
//
// A creative professional's personal home INSIDE Relevé — not a SaaS dashboard.
// Design language (shared with Messages & Notifications later): the Relevé
// palette (warm near-black · cream · gold), gold as a sparing accent only, an
// editorial serif (Fraunces) for name and numbers, generous whitespace, soft
// hairline cards, and the member's PROFILE as the centerpiece.
//
// Information architecture:
//   • "Available for" — the public-facing summary of services (placeholder set
//     this slice; per-profile selection is the future Professional Offerings flow).
//   • "Swing availability" — a LIVE toggle (available for sub calls), distinct
//     from the fixed services list.
//   • "Your Work" — the member's hub: Professional Offerings + Your Choreography
//     (license original works). Visual placeholders this slice.
//   • "Senior Spotlight" — a curated, invitation-only annual catalog; the honor
//     card shows ONLY for hand-selected artists.
//
// Gate (unchanged from Slice 0): signed in AND a professional (talent_profiles).
// Non-professionals are sent to the site root; the pilot surfaces are untouched.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProfessionalActor } from "@/lib/professional/actor";
import {
  loadProfessionalHome,
  unreadBadge,
  hasActivity,
  titleCaseRole,
  AVAILABLE_FOR_SERVICES,
} from "@/lib/professional/home";
import { loadArtistLicensing } from "@/lib/professional/licensing";
import ShareProfileButton from "./HomeActions";
import SwingToggle from "./SwingToggle";
import LicensingSection from "./LicensingSection";

export const dynamic = "force-dynamic";

export default async function ProfileHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const admin = createAdminClient();
  const actor = await resolveProfessionalActor(admin, user.id);
  if (!actor.isProfessional || !actor.talentProfileId) redirect("/");

  const home = await loadProfessionalHome(admin, {
    talentProfileId: actor.talentProfileId,
    publicSlug: actor.publicSlug,
  });

  // Licensing capability + the artist's works (tolerant if the migration isn't
  // applied yet — falls back to off / no works so the rest of the home renders).
  const licensing = await loadArtistLicensing(admin, actor.talentProfileId);

  const name = home.displayName ?? "Your profile";
  const initial = (home.firstName ?? name).trim().charAt(0).toUpperCase() || "✦";
  const identityLine = [home.primaryRole, home.location].filter(Boolean).join("  ·  ");
  const messagesBadge = unreadBadge(home.unreadMessages);
  const notificationsBadge = unreadBadge(home.unreadNotifications);
  const lastService = AVAILABLE_FOR_SERVICES.length - 1;

  return (
    <main className="min-h-screen bg-[var(--rc-cream)] text-[var(--rc-ink)]">
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-8">
        {/* Brand mark — a small crest, centered. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/releve-mark.png" alt="Relevé" className="mx-auto h-11 w-11" />

        <p className="mt-4 text-center text-[10.5px] font-medium uppercase tracking-[0.34em] text-[var(--rc-faint)]">
          {home.firstName ? `Welcome back, ${home.firstName}` : "Welcome back"}
        </p>

        {/* ===== THE CENTERPIECE — professional identity ================== */}
        <section className="mt-7 flex flex-col items-center text-center">
          {home.headshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={home.headshotUrl}
              alt={name}
              className="h-36 w-36 rounded-full object-cover shadow-[0_0_0_1px_var(--rc-gold),0_0_0_6px_var(--rc-cream),0_12px_36px_rgba(20,17,11,0.16)] sm:h-40 sm:w-40"
            />
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-full bg-[var(--rc-cream-soft)] font-serif text-5xl text-[var(--rc-faint)] shadow-[0_0_0_1px_var(--rc-gold),0_0_0_6px_var(--rc-cream),0_12px_36px_rgba(20,17,11,0.16)] sm:h-40 sm:w-40">
              {initial}
            </div>
          )}

          <h1 className="mt-6 font-serif text-4xl font-medium leading-[1.02] tracking-[-0.015em] text-[var(--rc-ink)] sm:text-5xl">
            {name}
          </h1>

          <div className="mx-auto mt-4 h-px w-8 bg-[var(--rc-gold)] opacity-80" />

          {home.verified && (
            <p className="mt-3.5 inline-flex items-center gap-2 text-[11.5px] font-medium uppercase tracking-[0.2em] text-[var(--rc-gold-deep)]">
              <span aria-hidden>&#10022;</span> Relevé Verified Professional
            </p>
          )}

          {identityLine && (
            <p className="mt-2.5 text-sm tracking-wide text-[var(--rc-taupe)]">{identityLine}</p>
          )}

          {home.honorifics.length > 0 && (
            <div className="mt-3.5 flex flex-wrap justify-center gap-2">
              {home.honorifics.map((h) => (
                <span
                  key={h}
                  className="rounded-[2px] border border-[#e7d6ac] bg-[#fbf5e7] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--rc-gold-deep)]"
                >
                  {titleCaseRole(h) ?? h}
                </span>
              ))}
            </div>
          )}

          {/* Available for — public-facing services summary (placeholder set). */}
          <div className="mt-7 w-full max-w-md">
            <div className="flex items-center justify-center gap-2.5">
              <span className="h-px w-4 bg-[var(--rc-gold)] opacity-70" />
              <span className="text-[11px] font-medium uppercase tracking-[0.26em] text-[var(--rc-gold-deep)]">
                Available for
              </span>
              <span className="h-px w-4 bg-[var(--rc-gold)] opacity-70" />
            </div>
            <p className="mt-3.5 flex flex-wrap justify-center gap-y-1.5">
              {AVAILABLE_FOR_SERVICES.map((s, i) => (
                <span key={s} className="whitespace-nowrap text-[13px] text-[var(--rc-ink-soft)]">
                  {s}
                  {i < lastService && <span className="mx-2.5 text-[var(--rc-gold)]">&middot;</span>}
                </span>
              ))}
            </p>
          </div>

          {/* Public-profile access — given real weight. */}
          <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-2.5 sm:w-auto sm:flex-row sm:items-center">
            {home.publicSlug ? (
              <Link
                href={`/${home.publicSlug}`}
                className="rounded-full bg-[var(--rc-ink)] px-7 py-3 text-center text-sm font-medium text-[var(--rc-cream)] transition-colors hover:bg-black"
              >
                View my public profile
              </Link>
            ) : (
              <span className="rounded-full border border-dashed border-[var(--rc-line)] px-7 py-3 text-center text-sm text-[var(--rc-taupe-light)]">
                Publish to get your public link
              </span>
            )}
            <Link
              href="/profile/edit"
              className="rounded-full border border-[#d8cbac] px-7 py-3 text-center text-sm font-medium text-[var(--rc-ink)] transition-colors hover:bg-[var(--rc-cream-soft)]"
            >
              Edit profile
            </Link>
            {home.publicSlug && <ShareProfileButton slug={home.publicSlug} />}
          </div>
        </section>

        {/* ===== Swing availability — live toggle ========================= */}
        <SwingToggle initial={home.swingActive} />

        {/* ===== Available for Licensing — live toggle + works manager ===== */}
        <LicensingSection
          initialOn={licensing.availableForLicensing}
          initialWorks={licensing.works}
        />

        {/* ===== Profile activity ======================================== */}
        <SectionLabel>Profile activity</SectionLabel>
        {hasActivity(home.activity) ? (
          <div className="mt-4 grid grid-cols-3 divide-x divide-[var(--rc-line)] rounded-2xl border border-[var(--rc-line)] bg-[var(--rc-cream-panel)] py-6 shadow-[0_1px_2px_rgba(20,17,11,0.05)]">
            <Stat label="Profile views" value={home.activity.views} />
            <Stat label="Saved by studios" value={home.activity.saves} />
            <Stat label="Inquiries" value={home.activity.inquiries} />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-[var(--rc-line)] bg-[var(--rc-cream-panel)] px-8 py-12 text-center shadow-[0_1px_2px_rgba(20,17,11,0.05)]">
            <p className="font-serif text-xl text-[var(--rc-ink)]">Your story starts here.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--rc-taupe)]">
              As studios discover, save, and reach out to you, it all gathers in this one place.
              {home.publicSlug
                ? " Share your profile to set things in motion."
                : " Publish your profile to begin being discovered."}
            </p>
          </div>
        )}

        {/* ===== Your inbox ============================================== */}
        <SectionLabel>Your inbox</SectionLabel>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--rc-line)] bg-[var(--rc-cream-panel)] shadow-[0_1px_2px_rgba(20,17,11,0.05)]">
          <InboxRow
            href="/messages"
            title="Messages"
            subtitle="Professional conversations, safely on Relevé"
            badge={messagesBadge}
          />
          <div className="mx-6 h-px bg-[var(--rc-line)]" />
          <InboxRow
            href="/notifications"
            title="Notifications"
            subtitle="Views, saves, and inquiries as they happen"
            badge={notificationsBadge}
          />
        </div>

        {/* ===== Your Work (theatrical dark hub) ========================= */}
        <SectionLabel>Your work</SectionLabel>
        <div className="relative mt-4 overflow-hidden rounded-2xl bg-[var(--rc-char)] px-7 pb-6 pt-3.5">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-[var(--rc-gold)]" />
          <WorkRow
            title="Professional Offerings"
            subtitle="Manage the services you offer"
            action="Manage"
          />
          {/* "Your Choreography · Apply" placeholder removed — licensing is now a
              real capability with its own section above (Available for Licensing +
              Works Available to License), so one clear licensing experience. */}
        </div>

        {/* ===== Senior Spotlight — conditional honor ==================== */}
        {home.isSeniorSpotlight && (
          <div className="mt-3 flex flex-wrap items-center gap-[18px] rounded-2xl border border-[var(--rc-gold)] bg-[var(--rc-cream-panel)] px-6 py-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/releve-mark.png" alt="" className="h-[34px] w-[34px] shrink-0" />
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--rc-gold-deep)]">
                Senior Spotlight Artist
              </div>
              <h3 className="mt-1.5 font-serif text-[19px] font-medium text-[var(--rc-ink)]">
                Curated annual catalog
              </h3>
              <p className="mt-0.5 text-[13px] text-[var(--rc-taupe)]">
                Hand-selected for the college-audition collection
              </p>
            </div>
            <span className="ml-auto whitespace-nowrap text-[12.5px] text-[var(--rc-gold-deep)]">
              View your feature &rarr;
            </span>
          </div>
        )}

        <p className="mt-14 text-center text-[10.5px] uppercase tracking-[0.36em] text-[var(--rc-gold-deep)]">
          together we rise · relevé
        </p>
      </div>
    </main>
  );
}

/* ─────────────────────────────  Pieces  ──────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-11 flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--rc-taupe-light)]">
      <span className="h-px w-3.5 bg-[var(--rc-gold)] opacity-85" />
      {children}
    </h2>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 text-center">
      <div className="font-serif text-[38px] font-medium leading-none text-[var(--rc-ink)]">{value}</div>
      <div className="mt-2 text-[10.5px] uppercase tracking-[0.15em] text-[var(--rc-taupe-light)]">
        {label}
      </div>
    </div>
  );
}

function InboxRow({
  href,
  title,
  subtitle,
  badge,
}: {
  href: string;
  title: string;
  subtitle: string;
  badge: string | null;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between px-6 py-5 transition-colors hover:bg-[var(--rc-cream-soft)]"
    >
      <span>
        <span className="block font-medium text-[var(--rc-ink)]">{title}</span>
        <span className="mt-0.5 block text-sm text-[var(--rc-taupe)]">{subtitle}</span>
      </span>
      <span className="ml-4 flex shrink-0 items-center gap-3">
        {badge && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--rc-gold-deep)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--rc-gold)]" />
            {badge}
          </span>
        )}
        <span className="text-[var(--rc-faint)] transition-transform group-hover:translate-x-0.5" aria-hidden>
          &rarr;
        </span>
      </span>
    </Link>
  );
}

// Placeholder rows inside the "Your Work" hub — the affordance is shown, the
// destinations arrive in a later slice (no dead links this slice).
function WorkRow({ title, subtitle, action }: { title: string; subtitle: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-[18px]">
      <div>
        <h4 className="font-serif text-[21px] font-medium text-[#f4ecd8]">{title}</h4>
        <p className="mt-1.5 text-[13.5px] text-[#c3b99f]">{subtitle}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[12.5px] tracking-[0.04em] text-[#e7d9b4]">
        <span className="h-px w-[18px] bg-[var(--rc-gold)]" />
        {action}
      </span>
    </div>
  );
}
