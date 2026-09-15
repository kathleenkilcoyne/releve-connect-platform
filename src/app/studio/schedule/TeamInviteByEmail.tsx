"use client";

// Dance team — invite your adult members by email, using the SAME team join
// code TeamJoinCode.tsx mints. Sits directly beneath that panel and requires
// an active code to already exist: this box never mints one itself — that
// stays TeamJoinCode's one job, so there is exactly one place a code is
// created for a team.

import { useMemo, useState } from "react";
import { parseInviteAddresses } from "@/lib/studio/team-invite";

const MAX_ADDRESSES = 50;

type ResultRow = { email: string; ok: boolean; error?: string };

export default function TeamInviteByEmail({
  hasCode,
  memberLabel = "Team Members",
}: {
  hasCode: boolean;
  memberLabel?: string;
}) {
  const membersLower = memberLabel.toLowerCase();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const parsed = useMemo(() => parseInviteAddresses(raw), [raw]);
  const total = parsed.valid.length + parsed.invalid.length;
  const overLimit = total > MAX_ADDRESSES;

  async function send() {
    if (busy || parsed.valid.length === 0 || overLimit) return;
    setBusy(true);
    setNotice(null);
    setResults(null);
    try {
      const res = await fetch("/api/studio/schedule/team-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: raw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ ok: false, text: data.error ?? "Could not send invitations." });
        return;
      }
      const rows = (data.results ?? []) as ResultRow[];
      setResults(rows);
      const sentCount = rows.filter((r) => r.ok).length;
      setNotice({
        ok: sentCount > 0,
        text: `${sentCount} of ${rows.length} invitation${rows.length === 1 ? "" : "s"} sent.`,
      });
      if (sentCount === rows.length) setRaw("");
    } catch {
      setNotice({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="team-invite-email" className="mt-10 border-t border-neutral-200 pt-6">
      <h2 className="text-lg font-semibold text-neutral-900">Invite your {membersLower} by email</h2>

      {!hasCode ? (
        <p className="mt-1 text-sm text-neutral-600">
          Generate a team join code above first — invitations send that code, and your team doesn&apos;t
          have one yet.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-neutral-600">
            Paste in email addresses — separated by commas, semicolons, spaces, or one per line — and
            Relevé emails each one your team join link.
          </p>

          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={4}
            placeholder={"dancer1@email.com, dancer2@email.com\ndancer3@email.com"}
            className="mt-3 w-full rounded-lg border border-neutral-300 p-3 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
          />

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span>
              {parsed.valid.length} address{parsed.valid.length === 1 ? "" : "es"}
            </span>
            {parsed.invalid.length > 0 && (
              <span className="text-red-600">
                {parsed.invalid.length} that don&apos;t look like emails: {parsed.invalid.join(", ")}
              </span>
            )}
            {overLimit && (
              <span className="text-red-600">
                Up to {MAX_ADDRESSES} addresses at a time — you have {total}.
              </span>
            )}
          </div>

          <button
            onClick={send}
            disabled={busy || parsed.valid.length === 0 || overLimit}
            className="mt-4 rounded-lg border border-neutral-900 bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send invitations"}
          </button>

          {notice && (
            <p className={`mt-3 text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>
          )}

          {results && results.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {results.map((r, i) => (
                <li key={`${r.email}-${i}`} className={r.ok ? "text-green-700" : "text-red-600"}>
                  {r.ok ? "✓" : "✗"} {r.email}
                  {!r.ok && r.error ? ` — ${r.error}` : ""}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
