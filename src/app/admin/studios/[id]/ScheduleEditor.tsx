"use client";

// Admin — the schedule editor for one studio/team (Brick B2). Concierge tool:
// Kathleen enters a comp/college team's rehearsals, competitions, auditions,
// workshops, performances and deadlines here. Each entry is a row in the
// EXISTING studio_classes table; the existing recurrence expander + This Week
// read path turn it into the calendar the team's families and teachers see.
//
// Every write hits the gated /classes route; on success we refresh the server
// component so the list reflects the change (and the roster re-reconciles).

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  COMP_COLLEGE_KINDS,
  KIND_LABELS,
  WEEKDAY_TOKENS,
  WEEKDAY_LABELS,
  summarizeSchedule,
  type CompCollegeKind,
  type WeekdayToken,
} from "@/lib/studio/schedule";

export type ScheduleRow = {
  class_id: string;
  title: string;
  kind: string;
  recurrence: string | null;
  default_start: string | null;
  default_end: string | null;
  series_start: string | null;
  series_end: string | null;
  room: string | null;
  location: string | null;
  teacher_profile_id: string | null;
  teacher_name: string | null;
};

export type TeacherOption = { profile_id: string; display_name: string };

type Mode = "recurring" | "oneoff";
type FormState = {
  title: string;
  kind: CompCollegeKind;
  mode: Mode;
  weekdays: Set<WeekdayToken>;
  everyOther: boolean;
  seriesStart: string;
  seriesEnd: string;
  date: string;
  startTime: string;
  endTime: string;
  teacher: string;
  room: string;
  location: string;
};

const EMPTY: FormState = {
  title: "",
  kind: "rehearsal",
  mode: "recurring",
  weekdays: new Set(),
  everyOther: false,
  seriesStart: "",
  seriesEnd: "",
  date: "",
  startTime: "",
  endTime: "",
  teacher: "",
  room: "",
  location: "",
};

/** "16:00:00" → "16:00" for an <input type=time>. */
function hhmm(t: string | null): string {
  if (!t) return "";
  const m = /^(\d{2}:\d{2})/.exec(t);
  return m ? m[1] : "";
}

function byDayTokens(recurrence: string | null): WeekdayToken[] {
  if (!recurrence) return [];
  const m = /BYDAY=([A-Z,]+)/i.exec(recurrence);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter((t): t is WeekdayToken => (WEEKDAY_TOKENS as readonly string[]).includes(t));
}

/** Pre-fill the form from an existing entry (for editing). */
function fromRow(row: ScheduleRow): FormState {
  const recurring = Boolean(row.recurrence);
  return {
    title: row.title,
    kind: (COMP_COLLEGE_KINDS as readonly string[]).includes(row.kind)
      ? (row.kind as CompCollegeKind)
      : "rehearsal",
    mode: recurring ? "recurring" : "oneoff",
    weekdays: new Set(byDayTokens(row.recurrence)),
    everyOther: /INTERVAL=2/i.test(row.recurrence ?? ""),
    seriesStart: recurring ? row.series_start ?? "" : "",
    seriesEnd: row.series_end ?? "",
    date: recurring ? "" : row.series_start ?? "",
    startTime: hhmm(row.default_start),
    endTime: hhmm(row.default_end),
    teacher: row.teacher_profile_id ?? "",
    room: row.room ?? "",
    location: row.location ?? "",
  };
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none";

export default function ScheduleEditor({
  endpointBase,
  classes,
  teachers,
  roster,
}: {
  /** The classes collection endpoint, e.g. "/api/studio/schedule/classes" (studio
   *  self-serve) or "/api/admin/studios/<id>/classes" (admin assist). POST here
   *  to create; PATCH/DELETE "<endpointBase>/<classId>" to edit/remove. */
  endpointBase: string;
  classes: ScheduleRow[];
  teachers: TeacherOption[];
  roster: { students: number; classes: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  function startAdd() {
    setForm(EMPTY);
    setEditingId(null);
    setNotice(null);
    setOpen(true);
  }
  function startEdit(row: ScheduleRow) {
    setForm(fromRow(row));
    setEditingId(row.class_id);
    setNotice(null);
    setOpen(true);
  }
  function cancel() {
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  function toggleDay(d: WeekdayToken) {
    setForm((f) => {
      const next = new Set(f.weekdays);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return { ...f, weekdays: next };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);

    const body = {
      title: form.title,
      kind: form.kind,
      mode: form.mode,
      weekdays: [...form.weekdays],
      every_other: form.everyOther,
      series_start: form.seriesStart || null,
      series_end: form.seriesEnd || null,
      date: form.date || null,
      start_time: form.startTime || null,
      end_time: form.endTime || null,
      teacher_profile_id: form.teacher || null,
      room: form.room || null,
      location: form.location || null,
    };

    const url = editingId ? `${endpointBase}/${editingId}` : endpointBase;
    try {
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ ok: false, text: data.error ?? "Could not save the entry." });
      } else {
        setNotice({ ok: true, text: editingId ? "Entry updated." : "Entry added." });
        setOpen(false);
        setEditingId(null);
        setForm(EMPTY);
        router.refresh();
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: ScheduleRow) {
    if (!window.confirm(`Remove "${row.title}"? It will disappear from This Week for this team.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${endpointBase}/${row.class_id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNotice({ ok: false, text: data.error ?? "Could not remove the entry." });
      else {
        setNotice({ ok: true, text: "Entry removed." });
        router.refresh();
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mt-1 text-sm text-neutral-600">
        Enter this team&apos;s rehearsals, competitions, auditions, workshops, performances and
        deadlines. Everyone enrolled at this studio ({roster.students}{" "}
        {roster.students === 1 ? "dancer" : "dancers"}) is automatically on these team entries, so
        they show up in each family&apos;s <span className="italic">This Week</span>. Comp/college
        teams only — not weekly rec classes.
      </p>

      {/* Existing entries */}
      <div className="mt-4">
        {classes.length === 0 ? (
          <p className="text-sm text-neutral-500">No schedule entries yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {classes.map((row) => (
              <li key={row.class_id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      {KIND_LABELS[row.kind as CompCollegeKind] ?? row.kind}
                    </span>
                    <span className="font-medium text-neutral-900">{row.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{summarizeSchedule(row)}</p>
                  {(row.room || row.location || row.teacher_name) && (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {[row.location, row.room, row.teacher_name ? `with ${row.teacher_name}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => startEdit(row)}
                    disabled={busy}
                    className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 disabled:opacity-40"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(row)}
                    disabled={busy}
                    className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-red-600 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!open && (
        <button
          onClick={startAdd}
          className="mt-4 rounded-lg border border-neutral-900 bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
        >
          Add schedule entry
        </button>
      )}

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Title</span>
              <input
                className={inputCls}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Senior Team Rehearsal, Regionals — Showstopper"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Kind</span>
              <select
                className={inputCls}
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as CompCollegeKind })}
              >
                {COMP_COLLEGE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>

            <div className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Repeats</span>
              <div className="flex gap-4 pt-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="mode"
                    checked={form.mode === "recurring"}
                    onChange={() => setForm({ ...form, mode: "recurring" })}
                  />
                  Weekly
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="mode"
                    checked={form.mode === "oneoff"}
                    onChange={() => setForm({ ...form, mode: "oneoff" })}
                  />
                  One-off date
                </label>
              </div>
            </div>
          </div>

          {form.mode === "recurring" ? (
            <div className="space-y-3">
              <div>
                <span className="mb-1 block text-xs font-medium text-neutral-600">On these days</span>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_TOKENS.map((d) => (
                    <label
                      key={d}
                      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                        form.weekdays.has(d) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"
                      }`}
                    >
                      <input type="checkbox" className="sr-only" checked={form.weekdays.has(d)} onChange={() => toggleDay(d)} />
                      {WEEKDAY_LABELS[d]}
                    </label>
                  ))}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={form.everyOther}
                  onChange={(e) => setForm({ ...form, everyOther: e.target.checked })}
                />
                Every other week
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-600">Starts on</span>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.seriesStart}
                    onChange={(e) => setForm({ ...form, seriesStart: e.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-600">Ends on (optional)</span>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.seriesEnd}
                    onChange={(e) => setForm({ ...form, seriesEnd: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ) : (
            <label className="block sm:w-1/2">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Date</span>
              <input
                type="date"
                className={inputCls}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Start time</span>
              <input
                type="time"
                className={inputCls}
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">End time (optional)</span>
              <input
                type="time"
                className={inputCls}
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Teacher (optional)</span>
              <select
                className={inputCls}
                value={form.teacher}
                onChange={(e) => setForm({ ...form, teacher: e.target.value })}
              >
                <option value="">— none —</option>
                {teachers.map((t) => (
                  <option key={t.profile_id} value={t.profile_id}>
                    {t.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Room (optional)</span>
              <input
                className={inputCls}
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                placeholder="Studio A"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Location (optional)</span>
              <input
                className={inputCls}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Address or venue"
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : editingId ? "Save changes" : "Add entry"}
            </button>
            <button type="button" onClick={cancel} className="text-sm text-neutral-500 underline">
              Cancel
            </button>
          </div>
        </form>
      )}

      {notice && (
        <p className={`mt-3 text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>
      )}
    </div>
  );
}
