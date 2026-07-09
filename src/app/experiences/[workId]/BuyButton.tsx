"use client";

// The "Buy the $499 Signature Experience" button. Calls our checkout route and
// hands off to Stripe's hosted Checkout page.

import { useState } from "react";

export default function BuyButton({
  workId,
  priceLabel,
}: {
  workId: string;
  priceLabel: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/experiences/${workId}/checkout`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Could not start checkout.");
        setLoading(false);
        return;
      }
      window.location.href = data.url; // → Stripe Checkout
    } catch {
      setError("Something went wrong starting checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={buy}
        disabled={loading}
        className="rounded-full bg-neutral-900 px-8 py-3 text-base font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
      >
        {loading ? "Starting checkout…" : `Buy the Signature Experience — ${priceLabel}`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
