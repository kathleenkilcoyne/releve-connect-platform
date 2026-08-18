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

  // One CTA treatment for every pathway (`.rc-cta`, subscribe/tokens.css). The
  // button must never signal which membership matters more — only the verb
  // changes. Deliberately NOT a filled black button on the tiers that go
  // straight to checkout (founder direction, 2026-08-18).
  return (
    <div>
      <button onClick={go} disabled={busy} className="rc-cta">
        {busy
          ? "One moment…"
          : mode === "manage"
            ? "Manage or cancel membership"
            : `${label ?? "Subscribe"} →`}
      </button>
      {error && (
        <p className="mt-2 text-[0.85rem] text-[#8f2f2f]">{error}</p>
      )}
    </div>
  );
}
