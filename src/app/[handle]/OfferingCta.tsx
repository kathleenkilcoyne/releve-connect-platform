"use client";

// The public action on an Offering card (Professional Offerings — Slice 4).
// Renders the right call-to-action for each Offering type by reusing EXISTING
// Relevé rails — never generic ecommerce:
//   - intro     → "Inquire": the existing Request-an-Intro / connections flow,
//                 with the note PREFILLED with the Offering title so the
//                 professional knows exactly which Offering is being asked
//                 about. Contact stays private per the existing connection
//                 rules. Interactive for signed-in active members; visitors who
//                 can't act are routed to sign in; the owner sees no button on
//                 their own profile (same rule as the hero's Request-an-Intro).
//   - external  → "View Product" / "Register": opens the professional-supplied
//                 URL in a new tab.
//   - licensing → "View Licensing": the existing /experiences seam.
//   - none      → nothing.
//
// No connections schema/index change (Slice 4b stays deferred): the Offering
// context travels in connections.message via introPrefillMessage(), not a new
// column.

import Link from "next/link";
import { introPrefillMessage, type ResolvedCta } from "@/lib/offerings";
import { InquireButton, CTA_BTN as BTN } from "./InquireButton";

export default function OfferingCta({
  cta,
  offeringTitle,
  profileId,
  firstName,
  handle,
  canAct,
  isOwner,
}: {
  cta: ResolvedCta;
  offeringTitle: string;
  profileId: string;
  firstName: string;
  handle: string;
  canAct: boolean;
  isOwner: boolean;
}) {
  if (cta.action === "none") return null;

  // Product / event → the professional's own external URL (new tab).
  if (cta.action === "external") {
    return (
      <a href={cta.href} target="_blank" rel="noopener noreferrer" className={BTN}>
        {cta.label} <span aria-hidden>↗</span>
      </a>
    );
  }

  // Licensed Work → the existing /experiences licensing seam (internal link).
  if (cta.action === "licensing") {
    return (
      <Link href={cta.href} className={BTN}>
        {cta.label} <span aria-hidden>→</span>
      </Link>
    );
  }

  // Service / Coaching & Sessions / Other → Inquire. Shared with
  // AvailabilityWindowsSection.tsx's My Services window CTA — same
  // send/error/pending/sent state machine, so the two contexts can never
  // quietly drift.
  return (
    <InquireButton
      prefillMessage={introPrefillMessage(firstName, offeringTitle)}
      noteLabel={
        <>
          Your note to {firstName} about &ldquo;{offeringTitle}&rdquo;
        </>
      }
      profileId={profileId}
      firstName={firstName}
      handle={handle}
      canAct={canAct}
      isOwner={isOwner}
    />
  );
}
