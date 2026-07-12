"use client";

// Accept / Decline buttons for one incoming intro request. Accept marks it
// "responded", Decline marks it "closed" — no contact is revealed either way
// (Open Decision 2: private by default; messaging is a later rail).

import { useState, useTransition } from "react";
import { respondToRequest } from "@/lib/connections/actions";

export default function RequestActions({
  connectionId,
  initialStatus,
}: {
  connectionId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function respond(decision: "responded" | "closed") {
    setError(null);
    startTransition(async () => {
      const res = await respondToRequest(connectionId, decision);
      if (res.error) setError(res.error);
      else setStatus(decision);
    });
  }

  if (status === "responded") {
    return <span className="text-sm font-medium text-green-700">✓ Accepted</span>;
  }
  if (status === "closed") {
    return <span className="text-sm text-neutral-400">Declined</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => respond("responded")}
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40"
      >
        Accept
      </button>
      <button
        type="button"
        onClick={() => respond("closed")}
        disabled={pending}
        className="text-sm text-neutral-500 underline disabled:opacity-40"
      >
        Decline
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
