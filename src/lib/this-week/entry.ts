// This Week — the WRITE path for a professional's own entries.
//
// ── What this is ──
// Until now nothing in the product wrote `personal_events`. This Week rendered
// an empty week for every professional. This module is the pure half of the fix:
// validation, normalization, and — most importantly — the PROJECTION that
// decides what a published window is allowed to say.
//
// No React, no Supabase, no clock of its own. The caller supplies everything and
// this decides. Search and gates get this discipline (CLAUDE.md guardrail #6);
// so does anything that can leak a private calendar.
//
// ── The three-part model this serves (ratified 2026-08-18) ──
//   My Services  = what I offer         → professional_offerings
//   Availability = where/how I work     → availability_tags, kind = 'general'
//   This Week    = WHEN I am available for the services I already offer
//
// The last line is why `offeringId` is validated against the member's OWN My
// Services and never free text: a professional declares what they offer once,
// and This Week reads it. Nothing here lets someone invent a service inline.
//
// ── The privacy firewall (ratified 2026-08-18) ──
//   "Only publish when the member explicitly marks a window public."
//   "A private event may make someone unavailable, but Relevé must never expose
//    the reason."
//
// `toPersonalEventRow` builds the PRIVATE row. `toPublicWindow` builds the
// PUBLIC one, and it is deliberately written as an explicit whitelist of four
// fields — it cannot copy a title, a note, a category or a location, because it
// never reads them. That property is asserted in entry.test.ts by walking the
// output keys, so a future edit that adds `title` to the public row fails the
// build rather than shipping.

import { zonedWallTimeToInstant } from "./week";

/* ─────────────────────────────  Vocabulary  ─────────────────────────────── */

/** The `personal_event_category` enum, exactly as the database declares it. */
export const PERSONAL_EVENT_CATEGORIES = [
  "taking",
  "rehearsing",
  "auditioning",
  "coaching",
  "performance",
  "personal",
  "deadline",
  "availability",
] as const;

export type PersonalEventCategory = (typeof PERSONAL_EVENT_CATEGORIES)[number];

export function isPersonalEventCategory(v: string): v is PersonalEventCategory {
  return (PERSONAL_EVENT_CATEGORIES as readonly string[]).includes(v);
}

/**
 * The ONLY category that may be published.
 *
 * A studio needs to know when someone is free. It has no business knowing that
 * the reason they are busy is an audition, a doctor's appointment or a funeral.
 * Restricting publication to `availability` means the worst privacy failure is
 * impossible BY CONSTRUCTION rather than by careful UI: there is no code path
 * that can publish an audition, because this function refuses it.
 */
export const PUBLISHABLE_CATEGORY: PersonalEventCategory = "availability";

/** Sensible ceiling so a typo can't create a decade-long window. */
export const MAX_ENTRY_HOURS = 24;

/* ───────────────────────────────  Input  ────────────────────────────────── */

export type EntryInput = {
  category: string;
  title: string;
  /** Wall-clock calendar date in the member's timezone, `YYYY-MM-DD`. */
  date: string;
  /** Wall-clock start, `HH:MM` (24h). */
  startTime: string;
  /** Wall-clock end, `HH:MM`. Optional — a deadline is a moment, not a span. */
  endTime?: string | null;
  timezone?: string | null;
  location?: string | null;
  note?: string | null;
  /** The member ticked "make this public". */
  publish?: boolean;
  /** Which My Service the published window is for. */
  offeringId?: string | null;
};

export type FieldError = { field: string; message: string };

/** The private row, ready for `personal_events`. */
export type PersonalEventValues = {
  category: PersonalEventCategory;
  title: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  location: string | null;
  note: string | null;
};

/**
 * The public row, ready for `service_availability`.
 *
 * FOUR FIELDS. Deliberately not "the event, minus some bits" — a whitelist, so
 * nothing private can arrive here by being added upstream.
 */
export type PublicWindow = {
  starts_at: string;
  ends_at: string;
  timezone: string;
  offering_id: string;
};

export type ValidatedEntry = {
  event: PersonalEventValues;
  /** Null unless the member explicitly asked to publish. */
  publish: PublicWindow | null;
};

export type EntryResult =
  | { ok: true; value: ValidatedEntry }
  | { ok: false; errors: FieldError[] };

/* ────────────────────────────  Normalization  ───────────────────────────── */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

function parseDate(v: string): { y: number; m: number; d: number } | null {
  const m = DATE_RE.exec(v.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Reject a date the calendar does not have (Feb 30), which would otherwise
  // roll silently into March.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

function parseTime(v: string): { h: number; min: number } | null {
  const m = TIME_RE.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

/* ────────────────────────────  Validation  ──────────────────────────────── */

/**
 * Validate and normalize one This Week entry.
 *
 * @param input      the raw form values
 * @param myServices the ids of the member's OWN active My Services. An
 *   `offeringId` outside this list is rejected — that is what stops a crafted
 *   request publishing a window against somebody else's service.
 */
export function validateEntry(
  input: EntryInput,
  myServices: readonly string[] = [],
): EntryResult {
  const errors: FieldError[] = [];

  // ---- Category ------------------------------------------------------------
  const category = (input.category ?? "").trim();
  if (!category) {
    errors.push({ field: "category", message: "Choose what kind of entry this is." });
  } else if (!isPersonalEventCategory(category)) {
    errors.push({ field: "category", message: "That isn't a kind of entry we recognise." });
  }

  // ---- Title ---------------------------------------------------------------
  const title = clean(input.title);
  if (!title) {
    errors.push({ field: "title", message: "Give this entry a name." });
  } else if (title.length > 120) {
    errors.push({ field: "title", message: "Keep the name under 120 characters." });
  }

  // ---- When ----------------------------------------------------------------
  const timezone = clean(input.timezone) ?? "America/New_York";
  const date = parseDate(input.date ?? "");
  if (!date) errors.push({ field: "date", message: "Pick a date." });

  const start = parseTime(input.startTime ?? "");
  if (!start) errors.push({ field: "startTime", message: "Pick a start time." });

  const rawEnd = clean(input.endTime);
  const end = rawEnd ? parseTime(rawEnd) : null;
  if (rawEnd && !end) errors.push({ field: "endTime", message: "That end time isn't valid." });

  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  if (date && start) {
    startsAt = zonedWallTimeToInstant(timezone, date.y, date.m, date.d, start.h, start.min);
    if (end) {
      endsAt = zonedWallTimeToInstant(timezone, date.y, date.m, date.d, end.h, end.min);
      if (endsAt.getTime() <= startsAt.getTime()) {
        // Mirrors the database's own personal_events_ends_after_starts CHECK, so
        // the member gets a sentence instead of a constraint violation.
        errors.push({ field: "endTime", message: "The end time has to be after the start time." });
      } else if (endsAt.getTime() - startsAt.getTime() > MAX_ENTRY_HOURS * 3_600_000) {
        errors.push({
          field: "endTime",
          message: `A single entry can't run longer than ${MAX_ENTRY_HOURS} hours.`,
        });
      }
    }
  }

  // ---- Publishing ----------------------------------------------------------
  const wantsPublish = input.publish === true;
  const offeringId = clean(input.offeringId);

  if (wantsPublish) {
    // Only availability may ever be published. See PUBLISHABLE_CATEGORY.
    if (category && category !== PUBLISHABLE_CATEGORY) {
      errors.push({
        field: "publish",
        message:
          "Only an availability window can be made public. Everything else on your " +
          "calendar stays private.",
      });
    }
    if (!offeringId) {
      errors.push({
        field: "offeringId",
        message: "Choose which of your services you're available for.",
      });
    } else if (!myServices.includes(offeringId)) {
      // Not a user-facing mistake in normal use — this is the crafted-request path.
      errors.push({ field: "offeringId", message: "That isn't one of your services." });
    }
    if (!endsAt) {
      // service_availability requires both ends; an open-ended public window is
      // not something a studio can act on.
      errors.push({
        field: "endTime",
        message: "A public window needs an end time so a studio knows the hours.",
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const event: PersonalEventValues = {
    category: category as PersonalEventCategory,
    title: title!,
    starts_at: startsAt!.toISOString(),
    ends_at: endsAt ? endsAt.toISOString() : null,
    timezone,
    location: clean(input.location),
    note: clean(input.note),
  };

  return {
    ok: true,
    value: { event, publish: wantsPublish ? toPublicWindow(event, offeringId!) : null },
  };
}

/* ─────────────────────────  The privacy projection  ─────────────────────── */

/**
 * Project a private event into the public window.
 *
 * ⚠ THE FIREWALL. This returns FOUR fields and reads only three properties of
 * the event. It has no access to the title, note, category, or location — not
 * because it filters them out, but because it never asks for them.
 *
 * `entry.test.ts` asserts the exact key set of the result, so adding a field
 * here fails the build. If a future feature genuinely needs one more field to
 * cross over, that has to be a deliberate decision with the founder, not a
 * quiet edit.
 */
export function toPublicWindow(
  event: Pick<PersonalEventValues, "starts_at" | "ends_at" | "timezone">,
  offeringId: string,
): PublicWindow | null {
  if (!event.ends_at) return null;
  return {
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    timezone: event.timezone,
    offering_id: offeringId,
  };
}

/** True when this entry is eligible to be offered a "make public" control. */
export function canPublish(category: string): boolean {
  return category === PUBLISHABLE_CATEGORY;
}
