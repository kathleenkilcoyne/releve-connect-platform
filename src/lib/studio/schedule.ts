// Admin schedule entry — shared helpers for building a studio_classes row from
// the admin form (Brick B2). Comp/college teams only: the six event kinds below
// are the wedge, and a plain rec "class" is deliberately NOT offered here.
//
// The recurrence engine (src/lib/this-week/recurrence.ts) understands
// FREQ=WEEKLY · BYDAY · INTERVAL, plus a null recurrence = a one-off dated on
// series_start. This builder produces exactly those shapes and nothing outside
// them, so every entry it creates is expandable.

/** The comp/college kinds the admin may create. No rec "class". */
export const COMP_COLLEGE_KINDS = [
  "rehearsal",
  "competition",
  "audition",
  "workshop",
  "performance",
  "deadline",
] as const;
export type CompCollegeKind = (typeof COMP_COLLEGE_KINDS)[number];

/** Human labels for the kinds (UI + summaries). */
export const KIND_LABELS: Record<CompCollegeKind, string> = {
  rehearsal: "Rehearsal",
  competition: "Competition",
  audition: "Audition",
  workshop: "Workshop / masterclass",
  performance: "Performance",
  deadline: "Deadline / reminder",
};

/** RFC-5545 weekday tokens, Monday-first (matches the recurrence expander). */
export const WEEKDAY_TOKENS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type WeekdayToken = (typeof WEEKDAY_TOKENS)[number];
export const WEEKDAY_LABELS: Record<WeekdayToken, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/; // HH:MM 24h
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD

export type ScheduleInput = {
  title?: string;
  kind?: string;
  mode?: "recurring" | "oneoff";
  // recurring
  weekdays?: string[];
  every_other?: boolean;
  series_start?: string | null;
  series_end?: string | null;
  // one-off
  date?: string | null;
  // both
  start_time?: string | null;
  end_time?: string | null;
  // optional
  teacher_profile_id?: string | null;
  room?: string | null;
  location?: string | null;
};

/** The studio_classes columns this builder writes. */
export type ClassFields = {
  title: string;
  kind: CompCollegeKind;
  recurrence: string | null;
  default_start: string | null;
  default_end: string | null;
  series_start: string | null;
  series_end: string | null;
  teacher_profile_id: string | null;
  room: string | null;
  location: string | null;
};

const clean = (v: string | null | undefined): string | null => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

/**
 * Validate the admin form and produce the studio_classes column values, or a
 * human error. Used by both create (POST) and edit (PATCH).
 */
export function buildClassFields(
  input: ScheduleInput,
): { fields: ClassFields } | { error: string } {
  const title = (input.title ?? "").trim();
  if (!title) return { error: "Give the entry a title." };
  if (title.length > 200) return { error: "That title is too long." };

  const kind = input.kind as CompCollegeKind;
  if (!COMP_COLLEGE_KINDS.includes(kind)) {
    return { error: "Choose a valid kind (rehearsal, competition, audition, workshop, performance, or deadline)." };
  }

  const startTime = clean(input.start_time);
  if (!startTime || !TIME_RE.test(startTime)) {
    return { error: "Enter a start time (for example 4:00 PM)." };
  }
  const endTime = clean(input.end_time);
  if (endTime && !TIME_RE.test(endTime)) {
    return { error: "That end time isn't a valid time." };
  }

  const teacher = clean(input.teacher_profile_id);
  const room = clean(input.room);
  const location = clean(input.location);

  const common = {
    title,
    kind,
    default_start: startTime,
    default_end: endTime,
    teacher_profile_id: teacher,
    room,
    location,
  };

  if (input.mode === "oneoff") {
    const date = clean(input.date);
    if (!date || !DATE_RE.test(date)) {
      return { error: "Pick a date for this one-off entry." };
    }
    return {
      fields: { ...common, recurrence: null, series_start: date, series_end: null },
    };
  }

  if (input.mode === "recurring") {
    const days = (input.weekdays ?? [])
      .map((d) => String(d).toUpperCase().trim())
      .filter((d): d is WeekdayToken => (WEEKDAY_TOKENS as readonly string[]).includes(d));
    if (days.length === 0) {
      return { error: "Pick at least one weekday for a recurring entry." };
    }
    const seriesStart = clean(input.series_start);
    if (!seriesStart || !DATE_RE.test(seriesStart)) {
      return { error: "Pick a start date for the recurring entry (when the weeks begin)." };
    }
    const seriesEnd = clean(input.series_end);
    if (seriesEnd && !DATE_RE.test(seriesEnd)) {
      return { error: "That end date isn't valid." };
    }
    // Keep BYDAY in Monday-first order for a tidy, canonical rule.
    const ordered = (WEEKDAY_TOKENS as readonly string[]).filter((t) => days.includes(t as WeekdayToken));
    const recurrence =
      `FREQ=WEEKLY;BYDAY=${ordered.join(",")}` + (input.every_other ? ";INTERVAL=2" : "");
    return {
      fields: { ...common, recurrence, series_start: seriesStart, series_end: seriesEnd },
    };
  }

  return { error: "Choose whether this repeats weekly or is a one-off date." };
}

/** A short human summary of a stored entry, for the admin list. */
export function summarizeSchedule(row: {
  recurrence: string | null;
  default_start: string | null;
  default_end: string | null;
  series_start: string | null;
  series_end: string | null;
}): string {
  const time =
    row.default_start
      ? row.default_end
        ? `${to12h(row.default_start)}–${to12h(row.default_end)}`
        : to12h(row.default_start)
      : "";

  if (!row.recurrence) {
    const d = row.series_start ? formatDate(row.series_start) : "date TBD";
    return [d, time].filter(Boolean).join(" · ");
  }
  const days = parseByDay(row.recurrence);
  const every = /INTERVAL=2/i.test(row.recurrence) ? "every other week" : "weekly";
  const bounds =
    row.series_start || row.series_end
      ? ` (${row.series_start ? formatDate(row.series_start) : "…"}${
          row.series_end ? ` – ${formatDate(row.series_end)}` : " onward"
        })`
      : "";
  return `${days}, ${every}${time ? ` · ${time}` : ""}${bounds}`;
}

function parseByDay(rrule: string): string {
  const m = /BYDAY=([A-Z,]+)/i.exec(rrule);
  if (!m) return "Weekly";
  return m[1]
    .split(",")
    .map((t) => WEEKDAY_LABELS[t.trim().toUpperCase() as WeekdayToken] ?? t)
    .join(" · ");
}

function to12h(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  let h = Number(m[1]);
  const min = m[2];
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ap}`;
}

function formatDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
