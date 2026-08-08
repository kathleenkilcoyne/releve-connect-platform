"use client";

// The family "Got it" control on a This Week card. Grey "Got it" → tap → green
// "✓ Got it". Optimistic: it flips immediately, then confirms with the server
// action; on failure it reverts and shows a quiet inline message. Rendered by
// EventCard only when the card carries `ack` context (family cards), so it never
// appears on a professional/teacher card.

import { useState, useTransition } from "react";
import { acknowledgeEvent } from "@/app/this-week/actions";
import type { EventAck } from "@/lib/this-week/types";

export function AckButton({ ack }: { ack: EventAck }) {
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(ack.acknowledgedAt);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const done = acknowledgedAt !== null;

  function onClick() {
    if (done || pending) return;
    setError(null);
    const optimistic = new Date().toISOString();
    setAcknowledgedAt(optimistic); // flip immediately
    startTransition(async () => {
      const res = await acknowledgeEvent({
        sessionId: ack.sessionId,
        scope: ack.scope,
        studentIds: ack.studentIds,
        familyId: ack.familyId,
      });
      if (!res.ok) {
        setAcknowledgedAt(null); // revert
        setError(res.error ?? "Couldn't save — try again.");
      } else if (res.acknowledgedAt) {
        setAcknowledgedAt(res.acknowledgedAt);
      }
    });
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={done || pending}
        aria-pressed={done}
        aria-label={done ? "Acknowledged" : "Mark as got it"}
        className={
          done
            ? "inline-flex items-center gap-1.5 rounded-full border border-[var(--rc-gold)] bg-[var(--rc-gold-soft)] px-3 py-1 text-xs font-semibold text-[var(--rc-ink)]"
            : "inline-flex items-center gap-1.5 rounded-full border border-[var(--rc-hairline)] bg-white px-3 py-1 text-xs font-semibold text-[var(--rc-muted)] hover:border-[var(--rc-ink)] hover:text-[var(--rc-ink)] disabled:opacity-50"
        }
      >
        {done ? (
          <>
            <span aria-hidden="true">✓</span> Got it
          </>
        ) : (
          <>{pending ? "Saving…" : "Got it"}</>
        )}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
