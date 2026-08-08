"use client";

// Smart Calendar — the studio's "What are you scheduling?" create flow (Slice 2),
// reused by the admin assist view and the studio self-serve area.
//
// Adding an entry opens with the TYPE MENU. The chosen type sets the family-facing
// label (the default title) AND drives the target-picker:
//   · dancers      → a searchable multi-select from the roster (class / team /
//                    duet / trio / private / competition / audition / performance)
//   · studio_wide  → no picker; the whole studio (Full Studio Event)
//   · choice       → whole studio OR a picked group (Parent Meeting)
//
// Storage never changes: one studio_class with an event_type; targeting is the
// enrollments of the picked dancers (+ studio_wide for whole-studio). Writes hit
// the gated endpoint; on success we refresh so the list reflects the change.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  WEEKDAY_TOKENS,
  WEEKDAY_LABELS,
  summarizeSchedule,
  type WeekdayToken,
} from "@/lib/studio/schedule";
import { EVENT_TYPES, EVENT_TYPE_BY_SLUG, familyLabelFor } from "@/lib/studio/event-types";
import type { ScheduleRow, TeacherOption, RosterEntry, GroupEntry } from "@/lib/studio/schedule-data";

export type { ScheduleRow, TeacherOption } from "@/lib/studio/schedule-data";

type Mode = "recurring" | "oneoff";
type Phase = "type" | "form";

type FormState = {
  eventType: string;
  title: string;
  titleTouched: boolean;
  wholeStudio: boolean; // only meaningful for the "choice" type (Parent Meeting)
  selectedGroups: Set<string>; // targeted group_ids
  selected: Set<string>; // individually-added student_ids
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
  eventType: "",
  title: "",
  titleTouched: false,
  wholeStudio: true,
  selectedGroups: new Set(),
  selected: new Set(),
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

function fromRow(row: ScheduleRow): FormState {
  const recurring = Boolean(row.recurrence);
  return {
    eventType: row.event_type ?? "company_rehearsal",
    title: row.title,
    titleTouched: true,
    wholeStudio: row.studio_wide,
    selectedGroups: new Set(row.target_group_ids),
    selected: new Set(row.target_dancer_ids),
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
  groups,
}: {
  endpointBase: string;
  classes: ScheduleRow[];
  teachers: TeacherOption[];
  roster: RosterEntry[];
  groups: GroupEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("type");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Set a notice; a success one clears itself after ~4s so nothing lingers. */
  function flash(next: { ok: boolean; text: string } | null) {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(next);
    if (next && next.ok) noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }

  const nameById = new Map(roster.map((r) => [r.student_id, r.display_name]));
  const groupById = new Map(groups.map((g) => [g.group_id, g]));
  const def = form.eventType ? EVENT_TYPE_BY_SLUG[form.eventType] : undefined;
  const groupsAllowed = Boolean(def?.groupsAllowed);

  function startAdd() {
    setForm({ ...EMPTY, selectedGroups: new Set(), selected: new Set() });
    setEditingId(null);
    setPhase("type");
    setSearch("");
    setNotice(null);
    setOpen(true);
  }
  function pickType(slug: string) {
    const d = EVENT_TYPE_BY_SLUG[slug];
    setForm((f) => ({
      ...f,
      eventType: slug,
      title: f.titleTouched && f.title ? f.title : familyLabelFor(slug, 0),
      wholeStudio: d?.target === "studio_wide" ? true : d?.target === "choice" ? true : false,
    }));
    setPhase("form");
  }
  function startEdit(row: ScheduleRow) {
    setForm(fromRow(row));
    setEditingId(row.class_id);
    setPhase("form");
    setSearch("");
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

  function toggleGroup(id: string) {
    setForm((f) => {
      const next = new Set(f.selectedGroups);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...f, selectedGroups: next };
    });
  }

  function toggleStudent(id: string) {
    setForm((f) => {
      const next = new Set(f.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Keep the default title in step with the count for a duet/trio.
      const title =
        f.titleTouched || f.eventType !== "duet_trio"
          ? f.title
          : familyLabelFor("duet_trio", next.size);
      return { ...f, selected: next, title };
    });
  }

  /** Whether the current type targets specific dancers (needs a selection). */
  const targetsDancers =
    def?.target === "dancers" || (def?.target === "choice" && !form.wholeStudio);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (targetsDancers && form.selected.size === 0 && form.selectedGroups.size === 0) {
      setNotice({ ok: false, text: "Pick a group or at least one dancer for this event." });
      return;
    }
    setBusy(true);
    setNotice(null);

    const studioWide = def?.target === "studio_wide" ? true : def?.target === "choice" ? form.wholeStudio : false;

    const body = {
      title: form.title,
      event_type: form.eventType,
      studio_wide: studioWide,
      group_ids: studioWide || !groupsAllowed ? [] : [...form.selectedGroups],
      student_ids: studioWide ? [] : [...form.selected],
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
        flash({ ok: true, text: editingId ? "Entry updated." : "Entry added." });
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
    if (!window.confirm(`Remove "${row.title}"? It will disappear from This Week for the families it was assigned to.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`${endpointBase}/${row.class_id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNotice({ ok: false, text: data.error ?? "Could not remove the entry." });
      else {
        flash({ ok: true, text: "Entry removed." });
        router.refresh();
      }
    } catch {
      setNotice({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  /** Who an entry is for, in words: its groups + individually-added dancers, and
   *  how many families it actually reaches (the resolved, de-duped enrollments). */
  function audienceOf(row: ScheduleRow): string {
    if (row.studio_wide) return "Whole studio";
    const parts: string[] = [];
    for (const gid of row.target_group_ids) {
      const g = groupById.get(gid);
      if (g) parts.push(`${g.name} (group)`);
    }
    for (const sid of row.target_dancer_ids) {
      const n = nameById.get(sid);
      if (n) parts.push(n);
    }
    if (parts.length === 0) return "No one assigned yet";
    const reach = row.target_student_ids.length;
    const label =
      parts.length <= 3 ? parts.join(", ") : `${parts.slice(0, 3).join(", ")} +${parts.length - 3} more`;
    return `${label} · reaches ${reach} ${reach === 1 ? "dancer" : "dancers"}`;
  }

  /** The "Got it" readout for an entry: "M of N acknowledged", green when all in,
   *  amber while some are outstanding. Studio-wide counts families; targeted
   *  counts dancers. */
  function ackReadout(row: ScheduleRow) {
    const noun = row.studio_wide ? "family" : "dancer";
    const nounPl = row.studio_wide ? "families" : "dancers";
    const { ack_acked: acked, ack_total: total } = row;
    if (total === 0) {
      return <span className="text-neutral-400">Got it: no recipients yet</span>;
    }
    if (acked >= total) {
      return (
        <span className="font-medium text-green-700">
          ✓ Got it: all {total} {total === 1 ? noun : nounPl} acknowledged
        </span>
      );
    }
    return (
      <span className="text-amber-700">
        Got it: {acked} of {total} {total === 1 ? noun : nounPl} acknowledged · {total - acked} not yet
      </span>
    );
  }

  const filteredRoster = roster.filter((r) =>
    r.display_name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
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
                      {EVENT_TYPE_BY_SLUG[row.event_type ?? ""]?.studioLabel ?? row.kind}
                    </span>
                    <span className="font-medium text-neutral-900">{row.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{summarizeSchedule(row)}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    <span className="font-medium">For:</span> {audienceOf(row)}
                    {(row.location || row.room || row.teacher_name) &&
                      " · " +
                        [row.location, row.room, row.teacher_name ? `with ${row.teacher_name}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                  </p>
                  <p className="mt-0.5 text-xs">{ackReadout(row)}</p>
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

      {/* Step 1 — "What are you scheduling?" */}
      {open && phase === "type" && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="text-base font-semibold text-neutral-900">What are you scheduling?</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Pick a type. We&apos;ll ask who it&apos;s for and put the right label on each
            family&apos;s week.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {EVENT_TYPES.map((t) => (
              <button
                key={t.slug}
                onClick={() => pickType(t.slug)}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left hover:border-neutral-900"
              >
                <span className="block text-sm font-medium text-neutral-900">{t.studioLabel}</span>
                <span className="mt-0.5 block text-xs text-neutral-500">{t.hint}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={cancel} className="mt-4 text-sm text-neutral-500 underline">
            Cancel
          </button>
        </div>
      )}

      {/* Step 2 — the form for the chosen type */}
      {open && phase === "form" && def && (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white">
              {def.studioLabel}
            </span>
            {!editingId && (
              <button
                type="button"
                onClick={() => setPhase("type")}
                className="text-xs text-neutral-500 underline"
              >
                ← Change type
              </button>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">
              What families will see (title)
            </span>
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value, titleTouched: true })}
              placeholder={def.familyLabel}
              required
            />
          </label>

          {/* ── Who is it for? (type-driven) ── */}
          {def.target === "studio_wide" ? (
            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
              <span className="font-medium text-neutral-900">Everyone at your studio</span> ({roster.length}{" "}
              {roster.length === 1 ? "dancer" : "dancers"}) will see this. No need to pick dancers.
            </div>
          ) : (
            <div>
              {def.target === "choice" && (
                <div className="mb-3 flex flex-wrap gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.wholeStudio}
                      onChange={() => setForm({ ...form, wholeStudio: true })}
                    />
                    Whole studio
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!form.wholeStudio}
                      onChange={() => setForm({ ...form, wholeStudio: false })}
                    />
                    Just these families
                  </label>
                </div>
              )}

              {targetsDancers && (
                <div className="space-y-3">
                  <span className="block text-xs font-medium text-neutral-600">Who should receive this?</span>

                  {groupsAllowed && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-500">Groups &amp; classes (one tap targets everyone in it)</span>
                        <span className="text-xs text-neutral-400">{form.selectedGroups.size} selected</span>
                      </div>
                      {groups.length === 0 ? (
                        <p className="mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500">
                          No groups yet — create them in <span className="font-medium">Studio roster</span> above.
                        </p>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {groups.map((g) => {
                            const on = form.selectedGroups.has(g.group_id);
                            return (
                              <label
                                key={g.group_id}
                                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"}`}
                              >
                                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleGroup(g.group_id)} />
                                {g.name}{" "}
                                <span className={on ? "text-neutral-300" : "text-neutral-400"}>
                                  ({g.member_ids.length})
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">
                      {groupsAllowed ? "Also individual dancers" : "Dancers"}
                      {def.minDancers != null && (
                        <span className="ml-1 text-neutral-400">
                          ({def.minDancers === def.maxDancers ? `pick ${def.minDancers}` : `pick ${def.minDancers}–${def.maxDancers}`})
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-neutral-500">{form.selected.size} selected</span>
                  </div>
                  {roster.length === 0 ? (
                    <p className="mt-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500">
                      No dancers on your roster yet — share your family join code first.
                    </p>
                  ) : (
                    <>
                      <input
                        className={`${inputCls} mt-2`}
                        placeholder="Search dancers…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-neutral-200 bg-white">
                        {filteredRoster.map((r) => (
                          <label
                            key={r.student_id}
                            className="flex cursor-pointer items-center gap-2 border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0 hover:bg-neutral-50"
                          >
                            <input
                              type="checkbox"
                              checked={form.selected.has(r.student_id)}
                              onChange={() => toggleStudent(r.student_id)}
                            />
                            <span className="text-neutral-800">{r.display_name}</span>
                          </label>
                        ))}
                        {filteredRoster.length === 0 && (
                          <p className="px-3 py-2 text-sm text-neutral-400">No match.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── When? ── */}
          <div className="border-t border-neutral-200 pt-4">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Repeats</span>
            <div className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="radio" checked={form.mode === "recurring"} onChange={() => setForm({ ...form, mode: "recurring" })} />
                Weekly
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" checked={form.mode === "oneoff"} onChange={() => setForm({ ...form, mode: "oneoff" })} />
                One time event
              </label>
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
                <input type="checkbox" checked={form.everyOther} onChange={(e) => setForm({ ...form, everyOther: e.target.checked })} />
                Every other week
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-600">Starts on</span>
                  <input type="date" className={inputCls} value={form.seriesStart} onChange={(e) => setForm({ ...form, seriesStart: e.target.value })} required />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-neutral-600">Ends on (optional)</span>
                  <input type="date" className={inputCls} value={form.seriesEnd} onChange={(e) => setForm({ ...form, seriesEnd: e.target.value })} />
                </label>
              </div>
            </div>
          ) : (
            <label className="block sm:w-1/2">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Event Date</span>
              <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Start time</span>
              <input type="time" className={inputCls} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">End time (optional)</span>
              <input type="time" className={inputCls} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Teacher (optional)</span>
              <select className={inputCls} value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })}>
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
              <input className={inputCls} value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Studio A" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Location (optional)</span>
              <input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Address or venue" />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40">
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
