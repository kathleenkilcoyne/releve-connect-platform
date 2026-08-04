"use client";

// Smart Calendar — the "Company Roster" (2026-07-31 refinement). Two views:
//   1. All Company Dancers — the MAIN roster: every dancer once, with the studio's
//      Age Division (editable inline), the age-range reference, and their
//      parent-connection status. Answers "who is in the company?"
//   2. Groups & classes — reusable groups the studio schedules against. Answers
//      "how are they organized for scheduling?"
//
// Age Division is STUDIO-controlled (stored on the studio-scoped affiliation),
// never derived from age. Boundary: groups + divisions exist ONLY for scheduling
// — no registration, tuition, costumes, attendance, or payroll. Success notices
// auto-dismiss so nothing lingers between the roster and the schedule.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GroupEntry, RosterEntry } from "@/lib/studio/schedule-data";
import { AGE_DIVISIONS } from "@/lib/studio/divisions";

export default function StudioRoster({
  groups,
  roster,
  isTeam = false,
}: {
  groups: GroupEntry[];
  roster: RosterEntry[];
  /** A college team relabels the roster + join-code wording; default is a studio. */
  isTeam?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMembers, setEditMembers] = useState<Set<string>>(new Set());

  const [savingDivision, setSavingDivision] = useState<string | null>(null);

  const nameById = new Map(roster.map((r) => [r.student_id, r.display_name]));

  /** A success/info flash that clears itself after ~4s (nothing lingers). */
  function flash(next: { ok: boolean; text: string } | null) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(next);
    if (next && next.ok) {
      noticeTimer.current = setTimeout(() => setNotice(null), 4000);
    }
  }

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    flash(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash({ ok: false, text: data.error ?? "Something went wrong." });
        return false;
      }
      router.refresh();
      return true;
    } catch {
      flash({ ok: false, text: "Something went wrong. Please try again." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function setDivision(studentId: string, division: string) {
    setSavingDivision(studentId);
    try {
      const res = await fetch(`/api/studio/schedule/roster/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ division }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) flash({ ok: false, text: data.error ?? "Couldn't set the division." });
      else {
        flash({ ok: true, text: "Division updated." });
        router.refresh();
      }
    } catch {
      flash({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setSavingDivision(null);
    }
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (await call("/api/studio/schedule/groups", "POST", { name: newName })) {
      setNewName("");
      setCreating(false);
      flash({ ok: true, text: "Group created." });
    }
  }

  function startEdit(g: GroupEntry) {
    setEditingId(g.group_id);
    setEditName(g.name);
    setEditMembers(new Set(g.member_ids));
    flash(null);
  }

  function toggleMember(id: string) {
    setEditMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveGroup() {
    if (
      await call(`/api/studio/schedule/groups/${editingId}`, "PATCH", {
        name: editName,
        member_ids: [...editMembers],
      })
    ) {
      setEditingId(null);
      flash({ ok: true, text: "Group saved." });
    }
  }

  async function removeGroup(g: GroupEntry) {
    if (!window.confirm(`Delete "${g.name}"? Events that targeted it will drop its members.`)) return;
    if (await call(`/api/studio/schedule/groups/${g.group_id}`, "DELETE")) {
      if (editingId === g.group_id) setEditingId(null);
      flash({ ok: true, text: "Group deleted." });
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-neutral-900">
        {isTeam ? "Team Roster" : "Company Roster"}
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        {isTeam
          ? "Everyone on your team, and how they're organized for scheduling."
          : "Everyone in your company, and how they're organized for scheduling."}
      </p>

      {/* ── 1. All dancers (the main roster) ── */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-neutral-800">
          {isTeam ? "All Team Dancers" : "All Company Dancers"} ({roster.length})
        </h3>
        {roster.length === 0 ? (
          <p className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
            {isTeam
              ? "No dancers yet. Share your team join code with your adult dancers — each one who joins shows up here."
              : "No dancers yet. Share your family join code with your competition families — each one who joins shows up here."}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {roster.map((s) => (
              <li
                key={s.student_id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <span className="font-medium text-neutral-900">{s.display_name}</span>
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <select
                    aria-label={`Age Division for ${s.display_name}`}
                    value={s.division ?? ""}
                    disabled={savingDivision === s.student_id}
                    onChange={(e) => setDivision(s.student_id, e.target.value)}
                    className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">— Division —</option>
                    {AGE_DIVISIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {s.age_range && <span>· Age {s.age_range}</span>}
                  <span
                    className={s.connection === "connected" ? "text-green-700" : "text-amber-700"}
                  >
                    ·{" "}
                    {s.connection === "connected"
                      ? isTeam
                        ? "Joined"
                        : "Parent connected"
                      : isTeam
                        ? "Not joined yet"
                        : "Invite pending"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 2. Groups & classes ── */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-800">Groups &amp; classes</h3>
          {!creating && (
            <button
              onClick={() => {
                setCreating(true);
                flash(null);
              }}
              className="rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              Create group
            </button>
          )}
        </div>

        {creating && (
          <form onSubmit={createGroup} className="mt-2 flex flex-wrap gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name (e.g. Jazz 3, Teen Company)"
              className="min-w-[16rem] flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              className="text-sm text-neutral-500 underline"
            >
              Cancel
            </button>
          </form>
        )}

        {groups.length === 0 ? (
          <p className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
            No groups yet. Create a group (like Jazz 3 or Teen Company) once, then schedule its
            events with one tap — no re-picking dancers each time.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {groups.map((g) => (
              <li key={g.group_id} className="p-3">
                {editingId === g.group_id ? (
                  <div>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
                    />
                    <p className="mt-2 text-xs font-medium text-neutral-600">
                      Members ({editMembers.size})
                    </p>
                    {roster.length === 0 ? (
                      <p className="mt-1 text-sm text-neutral-500">No dancers on your roster yet.</p>
                    ) : (
                      <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-neutral-200 bg-white">
                        {roster.map((r) => (
                          <label
                            key={r.student_id}
                            className="flex cursor-pointer items-center gap-2 border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0 hover:bg-neutral-50"
                          >
                            <input
                              type="checkbox"
                              checked={editMembers.has(r.student_id)}
                              onChange={() => toggleMember(r.student_id)}
                            />
                            <span className="text-neutral-800">{r.display_name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={saveGroup}
                        disabled={busy}
                        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                      >
                        {busy ? "Saving…" : "Save group"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-sm text-neutral-500 underline"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => removeGroup(g)}
                        disabled={busy}
                        className="ml-auto text-sm text-red-600 underline disabled:opacity-40"
                      >
                        Delete group
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-medium text-neutral-900">{g.name}</span>
                      <span className="ml-2 text-xs text-neutral-500">
                        {g.member_ids.length} {g.member_ids.length === 1 ? "member" : "members"}
                      </span>
                      {g.member_ids.length > 0 && (
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {g.member_ids
                            .map((id) => nameById.get(id))
                            .filter(Boolean)
                            .slice(0, 6)
                            .join(", ")}
                          {g.member_ids.length > 6 ? "…" : ""}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(g)}
                      className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700"
                    >
                      Edit members
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {notice && (
        <p className={`mt-3 text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>
      )}
    </section>
  );
}
