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
import { useState, useTransition } from "react";
import { sendIntroRequest } from "@/lib/connections/actions";
import { INTRO_MAX_LEN } from "@/lib/connections/messages";
import { introPrefillMessage, type ResolvedCta } from "@/lib/offerings";

// One restrained, uniform button treatment across every CTA type — editorial,
// not a retail "buy" button.
const BTN =
  "inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50";

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

  // Service / Coaching & Sessions / Other → Inquire.
  return (
    <InquireButton
      offeringTitle={offeringTitle}
      profileId={profileId}
      firstName={firstName}
      handle={handle}
      canAct={canAct}
      isOwner={isOwner}
    />
  );
}

function InquireButton({
  offeringTitle,
  profileId,
  firstName,
  handle,
  canAct,
  isOwner,
}: {
  offeringTitle: string;
  profileId: string;
  firstName: string;
  handle: string;
  canAct: boolean;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // The owner previewing their own profile can't inquire to themselves — the
  // hero hides its Request-an-Intro for the owner too.
  if (isOwner) return null;

  // Logged-out / non-member visitors are routed to sign in, the same gate the
  // existing connections flow enforces. (The server action re-checks, so this
  // is UX, not the security boundary.)
  if (!canAct) {
    return (
      <Link href={`/login?next=/${handle}`} className={BTN}>
        Inquire
      </Link>
    );
  }

  function openNote() {
    setError(null);
    // Prefill only if the member hasn't already typed something.
    setMessage((m) => (m ? m : introPrefillMessage(firstName, offeringTitle)));
    setOpen(true);
  }

  function onSend() {
    setError(null);
    start(async () => {
      const res = await sendIntroRequest(profileId, message);
      if (res.error) setError(res.error);
      else {
        setSent(true);
        setOpen(false);
      }
    });
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 ring-1 ring-green-200">
        ✓ Inquiry sent
      </span>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={openNote} className={BTN}>
        Inquire
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <label className="mb-1 block text-xs font-medium text-neutral-600">
        Your note to {firstName} about “{offeringTitle}”
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, INTRO_MAX_LEN))}
        rows={4}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
      />
      <p className="mt-1 text-xs text-neutral-400">
        {firstName} sees your note and can respond. Your contact details stay private until you both
        choose to share them.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onSend}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Sending…" : "Send inquiry"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-500 underline">
          Cancel
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
