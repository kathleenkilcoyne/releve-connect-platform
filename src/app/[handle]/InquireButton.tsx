"use client";

// The shared "Inquire" interaction — extracted 2026-08-18 so a Service card and
// an Available This Week window use the EXACT SAME send/error/pending/sent
// state machine rather than two copies that could quietly drift. Originally
// lived only in OfferingCta.tsx; now used there AND by
// AvailabilityWindowsSection.tsx.
//
// Reuses the existing Request-an-Intro / connections flow (lib/connections) —
// no new schema, no new column. Whatever context the inquiry is ABOUT (which
// Service, or which published window) travels entirely in the prefilled note
// text the caller supplies; the connections table itself stays generic.
//
// Interactive for signed-in active members; a visitor who can't act is routed
// to sign in; the owner sees no button on their own profile (same rule as the
// hero's Request-an-Intro).

import Link from "next/link";
import { useState, useTransition } from "react";
import { sendIntroRequest } from "@/lib/connections/actions";
import { INTRO_MAX_LEN } from "@/lib/connections/messages";

// One restrained, uniform button treatment across every CTA on the page —
// editorial, not a retail "buy" button.
export const CTA_BTN =
  "inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50";

export function InquireButton({
  prefillMessage,
  noteLabel,
  profileId,
  firstName,
  handle,
  canAct,
  isOwner,
}: {
  /** The note text pre-loaded into the textarea — computed by the caller so
   *  each context (an Offering, a published window) can name itself. */
  prefillMessage: string;
  /** The line above the textarea: "Your note to {firstName} about …". */
  noteLabel: React.ReactNode;
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
      <Link href={`/login?next=/${handle}`} className={CTA_BTN}>
        Inquire
      </Link>
    );
  }

  function openNote() {
    setError(null);
    // Prefill only if the member hasn't already typed something.
    setMessage((m) => (m ? m : prefillMessage));
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
      <button type="button" onClick={openNote} className={CTA_BTN}>
        Inquire
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <label className="mb-1 block text-xs font-medium text-neutral-600">{noteLabel}</label>
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
