"use client";

// Admin — the FAMILY join code panel for one studio (Brick B1).
//
// Concierge tool: Kathleen mints the code here and hands it to the studio for its
// competition families. It shows the plain code AND a ready-to-paste /join link
// that pre-fills the code, so a family lands on the enrollment form with it
// already filled in. Writes go to the gated /family-code route; on success we
// refresh the server page so the newly-minted code renders.

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FamilyCode = {
  code: string;
  use_count: number;
  max_uses: number | null;
  expires_at: string | null;
  created_at: string;
};

export default function FamilyJoinCode({
  employerId,
  codes,
}: {
  employerId: string;
  codes: FamilyCode[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // At most one active code per studio (the route enforces this), but render
  // defensively as a list in case the data ever carries more.
  const active = codes[0] ?? null;

  async function run(action: "generate" | "regenerate") {
    if (
      action === "regenerate" &&
      !window.confirm(
        "Replace the current family code? The old code stops working immediately — only do this if you haven't already shared it, or you want to invalidate it.",
      )
    ) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/studios/${employerId}/family-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ ok: false, text: data.error ?? "Could not create the code." });
      } else {
        setNotice({
          ok: true,
          text: data.reused
            ? "This studio already had an active code — showing it below."
            : action === "regenerate"
              ? "New code generated. The previous code is now disabled."
              : "Family join code generated.",
        });
        router.refresh();
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  function joinLink(code: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/join?code=${encodeURIComponent(code)}`;
  }

  async function copy(text: string, which: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 1500);
    } catch {
      setNotice({ ok: false, text: "Couldn't copy — select the text and copy manually." });
    }
  }

  return (
    <div>
      <p className="mt-1 text-sm text-neutral-600">
        Hand this to a competition studio for its families. A parent enters it at{" "}
        <span className="font-mono">/join</span> and their dancer is enrolled under this studio —
        guardian-managed. Nothing here is self-serve; you mint it, they share it.
      </p>

      {active ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          {/* The code, plainly */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl font-semibold tracking-[0.15em] text-neutral-900">
              {active.code}
            </span>
            <button
              onClick={() => copy(active.code, "code")}
              className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-white"
            >
              {copied === "code" ? "Copied ✓" : "Copy code"}
            </button>
          </div>

          {/* The ready-to-paste, code-carrying link */}
          <div className="mt-3">
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
              Shareable link (pre-fills the code)
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-800">
                {joinLink(active.code)}
              </code>
              <button
                onClick={() => copy(joinLink(active.code), "link")}
                className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-white"
              >
                {copied === "link" ? "Copied ✓" : "Copy link"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            {active.use_count} {active.use_count === 1 ? "family has" : "families have"} joined ·{" "}
            {active.max_uses == null ? "unlimited uses" : `up to ${active.max_uses} uses`} ·{" "}
            {active.expires_at ? `expires ${new Date(active.expires_at).toLocaleDateString()}` : "no expiry"}
          </p>

          <button
            onClick={() => run("regenerate")}
            disabled={busy}
            className="mt-4 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 disabled:opacity-40"
          >
            {busy ? "Working…" : "Replace code"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => run("generate")}
          disabled={busy}
          className="mt-4 rounded-lg border border-neutral-900 bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Working…" : "Generate family join code"}
        </button>
      )}

      {notice && (
        <p className={`mt-3 text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>
      )}
    </div>
  );
}
