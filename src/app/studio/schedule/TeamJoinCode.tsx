"use client";

// Dance team — the Team Director's own Team join code panel.
//
// This is SEPARATE from the competition-studio family join code. A team code is
// shared with ADULT members, who redeem it through the adult dance-team pathway
// (/team-join) — never the family /join. Redeeming it creates a self-managed
// adult account with NO guardian, minor, or family record, and does NOT place
// anyone on the professional Roster or Swing.

import { useState } from "react";
import { useRouter } from "next/navigation";

export type TeamCode = { code: string; use_count: number };

export default function TeamJoinCode({
  code,
  memberLabel = "Team Members",
}: {
  code: TeamCode | null;
  memberLabel?: string;
}) {
  const membersLower = memberLabel.toLowerCase();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function run(action: "generate" | "regenerate") {
    if (
      action === "regenerate" &&
      !window.confirm(
        "Replace your team join code? The old code stops working immediately — only do this if you haven't shared it, or want to invalidate it.",
      )
    ) {
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/studio/schedule/team-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNotice({ ok: false, text: data.error ?? "Could not create the code." });
      else {
        setNotice({
          ok: true,
          text:
            action === "regenerate"
              ? "New team code generated. The previous code is now disabled."
              : data.reused
                ? "Your team already had a code — showing it below."
                : "Team join code generated.",
        });
        router.refresh();
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  function joinLink(c: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/team-join?code=${encodeURIComponent(c)}`;
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
    <section className="mt-10 border-t border-neutral-200 pt-6">
      <h2 className="text-lg font-semibold text-neutral-900">Team join code</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Share this with your <span className="font-medium">adult</span> {membersLower}. Each one
        enters it on the dance team join page and gets a self-managed account connected to your team.
        It is separate from any studio&apos;s family code, and joining does{" "}
        <span className="font-medium">not</span> add anyone to the Relevé Roster or The Swing.
      </p>

      {code ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl font-semibold tracking-[0.15em] text-neutral-900">
              {code.code}
            </span>
            <button
              onClick={() => copy(code.code, "code")}
              className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-white"
            >
              {copied === "code" ? "Copied ✓" : "Copy code"}
            </button>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
              Shareable link (for your {membersLower})
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-800">
                {joinLink(code.code)}
              </code>
              <button
                onClick={() => copy(joinLink(code.code), "link")}
                className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-white"
              >
                {copied === "link" ? "Copied ✓" : "Copy link"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            {code.use_count} {code.use_count === 1 ? "member has" : "members have"} joined · unlimited
            uses · no expiry
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
          {busy ? "Working…" : "Generate team join code"}
        </button>
      )}

      {notice && (
        <p className={`mt-3 text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>
      )}
    </section>
  );
}
