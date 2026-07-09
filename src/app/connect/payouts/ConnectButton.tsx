"use client";

// "Connect payouts" — starts Stripe Express onboarding for an artist (Flow A).

import { useState } from "react";

export default function ConnectButton({ profileId }: { profileId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/connect/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Could not start onboarding.");
        setLoading(false);
        return;
      }
      window.location.href = data.url; // → Stripe hosted onboarding
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={connect}
        disabled={loading}
        className="rounded-full bg-neutral-900 px-8 py-3 text-base font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
      >
        {loading ? "Redirecting to Stripe…" : "Connect payouts"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
