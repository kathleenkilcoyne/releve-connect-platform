"use client";

// Admin console for the Founding Professional cohort. Grant (by email + billing
// flavor), copy an invite link, change the billing flavor later, or revoke a
// mistake. Everything routes through the gated /api/admin/founding-professionals
// endpoints; this component just drives them and refreshes the server data.
//
// THE INVITE LINK IS NOT A CREDENTIAL. It only deep-links the invited person into
// the normal sign-in flow (with their email pre-filled and the profile builder as
// the destination). It confers nothing on its own — Founding Professional status
// is materialized ONLY when someone authenticates with the invited email and the
// grant is matched by that verified address. Sharing or leaking the link grants
// no access.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GrantRow } from "./page";

type Kind = "permanent" | "comp_12mo";

function kindLabel(k: Kind): string {
  return k === "permanent" ? "Permanent complimentary" : "12-month complimentary";
}

/** Build the (credential-free) invite link for an invited email. */
function inviteLink(email: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const next = encodeURIComponent("/profile/edit");
  return `${origin}/login?next=${next}&email=${encodeURIComponent(email)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function FoundingProfessionalsConsole({ grants }: { grants: GrantRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<Kind>("permanent");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The email we just granted — surface its invite link prominently to copy.
  const [justGranted, setJustGranted] = useState<string | null>(null);

  function grant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    start(async () => {
      const res = await fetch("/api/admin/founding-professionals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed, entitlement_kind: kind, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not grant Founding Professional.");
        return;
      }
      setJustGranted(trimmed);
      setEmail("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="mt-10 space-y-10">
      {/* ---- Grant a new Founding Professional ---- */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Confer Founding Professional status</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Enter the invited person&apos;s email and choose their complimentary billing. You can add
          Founding Professionals at any time — there is no limit.
        </p>
        <form onSubmit={grant} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="fp-email" className="mb-1 block text-xs font-medium text-neutral-600">
              Invited email
            </label>
            <input
              id="fp-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="founder@example.com"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="fp-kind" className="mb-1 block text-xs font-medium text-neutral-600">
              Complimentary billing
            </label>
            <select
              id="fp-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            >
              <option value="permanent">Permanent complimentary</option>
              <option value="comp_12mo">12-month complimentary</option>
            </select>
          </div>
          <div>
            <label htmlFor="fp-note" className="mb-1 block text-xs font-medium text-neutral-600">
              Note (optional, audit)
            </label>
            <input
              id="fp-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Founding choreographer"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-4">
            <button
              type="submit"
              disabled={pending || !email.trim()}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {pending ? "Conferring…" : "Grant Founding Professional"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </form>

        {justGranted && (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              ✦ {justGranted} is now a Founding Professional.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Send them this invite link. It just takes them to sign-in with their email pre-filled —
              their status is confirmed when they sign in with this address, not by the link itself.
            </p>
            <CopyLink email={justGranted} big />
          </div>
        )}
      </section>

      {/* ---- The cohort (audit ledger) ---- */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">The cohort</h2>
          <p className="text-sm text-neutral-500">
            {grants.length} {grants.length === 1 ? "grant" : "grants"}
          </p>
        </div>
        {grants.length === 0 ? (
          <p className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
            No Founding Professionals yet. Confer the first one above.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {grants.map((g) => (
              <GrantCard key={g.id} grant={g} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GrantCard({ grant: g }: { grant: GrantRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const revoked = Boolean(g.revoked_at);
  const claimed = Boolean(g.claimed_at);

  function patch(body: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setError(null);
    start(async () => {
      const res = await fetch(`/api/admin/founding-professionals/${g.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That didn't work.");
        return;
      }
      router.refresh();
    });
  }

  // Status line: revoked > claimed (billing) > invited.
  let status: React.ReactNode;
  if (revoked) {
    status = <span className="text-neutral-500">Revoked {fmtDate(g.revoked_at)}</span>;
  } else if (claimed) {
    const active = g.membership_status === "active";
    const until = g.membership_source === "complimentary_term" && g.renewal_date
      ? ` · until ${fmtDate(g.renewal_date)}`
      : g.membership_source === "complimentary_permanent"
        ? " · no expiry"
        : "";
    status = (
      <span className={active ? "text-green-700" : "text-neutral-500"}>
        {active ? "Active" : g.membership_status ?? "—"}
        {until}
      </span>
    );
  } else {
    status = <span className="text-amber-700">Invited · awaiting first sign-in</span>;
  }

  return (
    <li className={`rounded-xl border border-neutral-200 p-4 ${pending ? "opacity-50" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-neutral-900">{g.email}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Founding Professional · {kindLabel(g.entitlement_kind)} · granted {fmtDate(g.granted_at)}
            {g.note ? ` · “${g.note}”` : ""}
          </p>
          <p className="mt-1 text-sm">{status}</p>
        </div>
      </div>

      {!revoked && (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <CopyLink email={g.email} />
          {/* Change billing flavor — identity is untouched. */}
          {g.entitlement_kind === "permanent" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => patch({ action: "change_entitlement", entitlement_kind: "comp_12mo" })}
              className="text-neutral-700 underline disabled:opacity-40"
            >
              Change to 12-month
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => patch({ action: "change_entitlement", entitlement_kind: "permanent" })}
              className="text-neutral-700 underline disabled:opacity-40"
            >
              Change to permanent
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              patch(
                { action: "revoke" },
                `Revoke Founding Professional for ${g.email}? This deactivates their complimentary membership and removes the badge. The audit record is kept.`,
              )
            }
            className="text-neutral-400 underline hover:text-red-600 disabled:opacity-40"
          >
            Revoke
          </button>
          {error && <span className="text-red-600">{error}</span>}
        </div>
      )}
    </li>
  );
}

function CopyLink({ email, big }: { email: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteLink(email));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — reveal the link so it can be copied by hand.
      window.prompt("Copy this invite link:", inviteLink(email));
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={
        big
          ? "mt-3 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          : "text-neutral-700 underline"
      }
    >
      {copied ? "Copied ✓" : "Copy invite link"}
    </button>
  );
}
