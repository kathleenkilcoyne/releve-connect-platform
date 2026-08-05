"use client";

// The Founding Studios admin console (client). Invite by email, and move each
// studio through its lifecycle. Every write hits a gated admin API route; on
// success we refresh the server component so the list reflects the new state.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StudioRow } from "./page";
import { TEAM_TYPES, TEAM_TYPE_OPTION_LABELS, type TeamType } from "@/lib/studio/team-types";

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
  const [orgType, setOrgType] = useState<"studio" | "dance_team">("studio");
  const [teamType, setTeamType] = useState<TeamType>("college");
  const [memberLabel, setMemberLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const isTeam = orgType === "dance_team";

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/studio-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          org_type: orgType,
          ...(isTeam
            ? { team_type: teamType, member_label: memberLabel.trim() || null }
            : {}),
        }),
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
        <label className="block text-sm font-medium text-neutral-800">
          {isTeam ? "Invite a dance team" : "Invite a studio"}
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          Enter the {isTeam ? "Team Director" : "studio owner"}&apos;s email. We create their private
          profile and email them a secure setup link. Re-entering an email re-sends the same link.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            value={orgType}
            onChange={(ev) => setOrgType(ev.target.value as "studio" | "dance_team")}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          >
            <option value="studio">Studio</option>
            <option value="dance_team">Dance team</option>
          </select>
          <input
            type="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder={isTeam ? "director@team.org" : "owner@studio.com"}
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

        {/* Dance-team flavor (display-only) + what the team calls its members. */}
        {isTeam && (
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex flex-col text-xs font-medium text-neutral-600">
              Team type
              <select
                value={teamType}
                onChange={(ev) => setTeamType(ev.target.value as TeamType)}
                className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal text-neutral-800 focus:border-neutral-500 focus:outline-none"
              >
                {TEAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TEAM_TYPE_OPTION_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col text-xs font-medium text-neutral-600">
              Member label (optional)
              <input
                value={memberLabel}
                onChange={(ev) => setMemberLabel(ev.target.value)}
                placeholder="e.g. Dancers, Athletes — defaults to Team Members"
                className="mt-1 min-w-[14rem] rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal focus:border-neutral-500 focus:outline-none"
              />
            </label>
          </div>
        )}
        {notice && (
          <p className={`mt-3 text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>
        )}
      </form>

      {/* The list */}
      <div className="mt-8 overflow-x-auto">
        {studios.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {isTeam ? "No dance teams yet. Invite one above." : "No studios yet. Invite one above."}
          </p>
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
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Manage = the private admin review route (read the
                            submission + Approve/Publish there). Shown for any
                            studio with content to manage. */}
                        {(s.status === "submitted" ||
                          s.status === "approved" ||
                          s.status === "live") && (
                          <Link
                            href={`/admin/studios/${s.employer_id}`}
                            className="rounded-md border border-sky-400 bg-sky-600 px-2.5 py-1 text-xs font-medium text-white"
                          >
                            Manage studio
                          </Link>
                        )}
                        {/* Separate from Manage — only a LIVE studio has a public
                            profile; opens it in a new tab. */}
                        {s.status === "live" && (
                          <a
                            href={s.public_slug ? `/studios/${s.public_slug}` : "/studios"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700"
                          >
                            View public profile ↗
                          </a>
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
