"use client";

// The subscribe / manage buttons. "subscribe" starts the annual Checkout;
// "manage" opens the Stripe billing portal (one-click cancel). Both just POST
// and redirect to the Stripe-hosted URL.

import { useState } from "react";

export default function SubscribeButtons({
  mode,
  tier,
  label,
}: {
  mode: "subscribe" | "manage";
  tier?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const url = mode === "subscribe" ? "/api/membership/checkout" : "/api/membership/portal";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: mode === "subscribe" ? JSON.stringify({ tier }) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={busy}
        className={`rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-40 ${
          mode === "subscribe"
            ? "bg-neutral-900 text-white"
            : "border border-neutral-300 text-neutral-800"
        }`}
      >
        {busy ? "One moment…" : mode === "manage" ? "Manage or cancel membership" : label ?? "Subscribe"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
