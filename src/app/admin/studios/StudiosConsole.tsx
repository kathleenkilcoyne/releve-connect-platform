"use client";

// The Founding Studios admin console (client). Invite by email, and move each
// studio through its lifecycle. Every write hits a gated admin API route; on
// success we refresh the server component so the list reflects the new state.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StudioRow } from "./page";

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  in_progress: "In progress",
  submitted: "Submitted",
  approved: "Approved",
  live: "Live",
};
const STATUS_TONE: Record<string, string> = {
  invited: "bg-neutral-100 text-neutral-600",
  in_progress: "bg-neutral-100 text-neutral-700",
  submitted: "bg-amber-100 text-amber-800",
  approved: "bg-sky-100 text-sky-800",
  live: "bg-green-100 text-green-800",
};

export default function StudiosConsole({ studios }: { studios: StudioRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/studio-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ ok: false, text: data.error ?? "Could not create the invitation." });
      } else {
        setNotice({
          ok: true,
          text:
            (data.resent ? "Invitation re-sent to " : "Invitation sent to ") +
            email.trim().toLowerCase() +
            (data.email_sent === false ? " (email vendor not configured — link logged server-side)." : "."),
        });
        setEmail("");
        router.refresh();
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function act(employerId: string, action: "approve" | "publish" | "unpublish") {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/studios/${employerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ ok: false, text: data.error ?? `Could not ${action}.` });
      } else {
        setNotice({ ok: true, text: `Studio is now "${data.status}".` });
        router.refresh();
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function resend(emailAddr: string) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/studio-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddr }),
      });
      const data = await res.json().catch(() => ({}));
      setNotice(
        res.ok
          ? { ok: true, text: `Invitation re-sent to ${emailAddr}.` }
          : { ok: false, text: data.error ?? "Could not resend." },
      );
    } catch {
      setNotice({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      {/* Create invitation */}
      <form onSubmit={createInvite} className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <label className="block text-sm font-medium text-neutral-800">Invite a studio</label>
        <p className="mt-1 text-xs text-neutral-500">
          Enter the studio owner&apos;s email. We create their private profile and email them a secure
          setup link. Re-entering an email re-sends the same link.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="owner@studio.com"
            className="min-w-[16rem] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Working…" : "Send invitation"}
          </button>
        </div>
        {notice && (
          <p className={`mt-3 text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>
        )}
      </form>

      {/* The list */}
      <div className="mt-8 overflow-x-auto">
        {studios.length === 0 ? (
          <p className="text-sm text-neutral-500">No studios yet. Invite one above.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Studio</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Location</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {studios.map((s) => {
                const location = [s.city, s.state_province].filter(Boolean).join(", ");
                return (
                  <tr key={s.employer_id} className="border-b border-neutral-100 align-top">
                    <td className="py-3 pr-3 font-medium text-neutral-900">
                      {s.name?.trim() || <span className="text-neutral-400">— (setup pending)</span>}
                    </td>
                    <td className="py-3 pr-3 text-neutral-600">{s.email}</td>
                    <td className="py-3 pr-3 text-neutral-600">{location || "—"}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_TONE[s.status] ?? "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-2">
                        {s.status === "submitted" && (
                          <button
                            onClick={() => act(s.employer_id, "approve")}
                            disabled={busy}
                            className="rounded-md border border-sky-300 px-2.5 py-1 text-xs font-medium text-sky-800 disabled:opacity-40"
                          >
                            Approve
                          </button>
                        )}
                        {s.status === "approved" && (
                          <button
                            onClick={() => act(s.employer_id, "publish")}
                            disabled={busy}
                            className="rounded-md border border-green-400 bg-green-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                          >
                            Publish
                          </button>
                        )}
                        {s.status === "live" && (
                          <button
                            onClick={() => act(s.employer_id, "unpublish")}
                            disabled={busy}
                            className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 disabled:opacity-40"
                          >
                            Unpublish
                          </button>
                        )}
                        <button
                          onClick={() => resend(s.email)}
                          disabled={busy}
                          className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-600 disabled:opacity-40"
                        >
                          Resend invite
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
