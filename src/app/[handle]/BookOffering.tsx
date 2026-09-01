"use client";

// The "Book" action on a bookable My Service offering (Professional Services
// transaction rail, Phase 1, 2026-09-01). Renders INSTEAD OF <OfferingCta> —
// never alongside it — for the specific case an offering's card determined is
// bookable (see OfferingsSection.tsx): a service/session type, a real price,
// the professional connected to Stripe payouts, and at least one open window.
// Every other offering (product/license/event/other, or a service/session not
// yet fully set up) renders <OfferingCta> exactly as before this rail existed.
//
// Same visitor rules as Inquire: the owner sees nothing on their own profile; a
// visitor who can't act yet is routed to sign in.

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatBookingWindow, type BookingWindow } from "@/lib/bookings/format";
import { formatMoney } from "@/lib/offerings";

const BTN =
  "inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50";
const BTN_PRIMARY =
  "inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40";

export type BookableWindow = BookingWindow & { id: string };

export default function BookOffering({
  offeringTitle,
  priceCents,
  windows,
  handle,
  canAct,
  isOwner,
}: {
  offeringTitle: string;
  /** The Professional's own stated price — shown as-is, the fee is added at
   *  checkout (never on this card, so the price a Professional set is always
   *  what a visitor sees named against their work). */
  priceCents: number;
  windows: BookableWindow[];
  handle: string;
  canAct: boolean;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (isOwner) return null;

  if (!canAct) {
    return (
      <Link href={`/login?next=/${handle}`} className={BTN}>
        Book — {formatMoney(priceCents / 100)}
      </Link>
    );
  }

  function book(windowId: string) {
    setError(null);
    setPendingId(windowId);
    start(async () => {
      try {
        const res = await fetch(`/api/bookings/${windowId}/checkout`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          setError(data.error ?? "Could not start checkout. Please try again.");
          setPendingId(null);
          return;
        }
        window.location.href = data.url as string;
      } catch {
        setError("Something went wrong. Please try again.");
        setPendingId(null);
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={BTN}>
        Book — {formatMoney(priceCents / 100)}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="mb-2 text-xs font-medium text-neutral-600">
        Choose a time for &ldquo;{offeringTitle}&rdquo;
      </p>
      <ul className="space-y-2">
        {windows.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => book(w.id)}
              disabled={pending}
              className={`w-full text-left ${BTN_PRIMARY} justify-between`}
            >
              <span>{formatBookingWindow(w)}</span>
              {pending && pendingId === w.id && <span>Starting…</span>}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={pending}
        className="mt-3 text-sm text-neutral-500 underline disabled:opacity-40"
      >
        Cancel
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
