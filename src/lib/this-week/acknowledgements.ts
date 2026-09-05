// "Got it" acknowledgements — the PURE core (no Supabase, no I/O), so the family
// stamping and the studio readout math can be proven without a database. The DB
// reads/writes live in queries.ts (family fill), lib/studio/acknowledgements.ts
// (studio readout), and app/this-week/actions.ts (the write). See the
// event_acknowledgements migration for the storage + RLS.

import type { CalendarEvent } from "./types";

/** One row of event_acknowledgements, in read shape. */
export interface AckRow {
  session_id: string;
  /** Set for a targeted (per-dancer) ack; null for a studio-wide family ack. */
  student_id: string | null;
  family_id: string | null;
  acknowledged_at: string;
}

/* ─────────────────────────────  Family view  ─────────────────────────────── */

/**
 * Stamp `acknowledgedAt` onto each family event's `ack` from the ack rows the
 * family can see. A TARGETED card is acknowledged when any of its dancers has a
 * row for that occurrence (one tap writes a row per enrolled dancer, so any row
 * present ⇒ done). A STUDIO-WIDE card is acknowledged by its family-level row
 * (student_id null) for that occurrence — or, for a SELF-MANAGED adult (dance
 * team) who has no family_account, by the row against their own student id, which
 * the card carries in `studentIds`. Idempotent; mutates in place and returns
 * the same array for convenience.
 */
export function markFamilyAcks(events: CalendarEvent[], rows: AckRow[]): CalendarEvent[] {
  // (session_id, student_id) → at, and (session_id | family) → at for studio-wide.
  const targeted = new Map<string, string>(); // `${session}::${student}`
  const studioWide = new Map<string, string>(); // session_id (student null)
  for (const r of rows) {
    if (r.student_id) targeted.set(`${r.session_id}::${r.student_id}`, r.acknowledged_at);
    else studioWide.set(r.session_id, r.acknowledged_at);
  }

  for (const e of events) {
    if (!e.ack) continue;
    // Studio-wide with NO student ids = the guardian-family lane: the ack is the
    // family-level row (student_id null). Everything else matches per student —
    // targeted cards, and a SELF-MANAGED member's studio-wide card, which carries
    // their own student id because they have no family_account to ack with. A
    // guardian family's studio-wide card never carries student ids, so that lane is
    // untouched.
    if (e.ack.scope === "studio_wide" && e.ack.studentIds.length === 0) {
      e.ack.acknowledgedAt = studioWide.get(e.ack.sessionId) ?? null;
    } else {
      let at: string | null = null;
      for (const sid of e.ack.studentIds) {
        const hit = targeted.get(`${e.ack.sessionId}::${sid}`);
        // Earliest ack wins, so a partially-acked shared card still reads "done".
        if (hit && (at === null || hit < at)) at = hit;
      }
      e.ack.acknowledgedAt = at;
    }
  }
  return events;
}

/* ─────────────────────────────  Studio readout  ──────────────────────────── */

/** What the studio needs to size the denominator + match acks for one class. */
export interface ClassAckInput {
  classId: string;
  studioWide: boolean;
  /** The class's dated occurrences (all its session ids). */
  sessionIds: string[];
  /** Targeted denominator: the dancers enrolled in this class. */
  enrolledStudentIds: string[];
}

export interface AckTally {
  acked: number;
  total: number;
}

/**
 * Per-class "M of N acknowledged". For a TARGETED class, N = enrolled dancers and
 * M = distinct enrolled dancers who acknowledged any of its occurrences. For a
 * STUDIO-WIDE class, N = the org's ACKNOWLEDGERS — one per family account plus one
 * per self-managed member (a dance team's adults have no family account) — and M =
 * how many of those acknowledged any of its occurrences. Pure — the caller supplies
 * the numbers.
 *
 * `selfMemberStudentIds` defaults to empty, so a studio with no self-managed
 * members gets exactly the previous numbers.
 */
export function summarizeClassAcks(
  classes: ClassAckInput[],
  rows: AckRow[],
  totalFamilies: number,
  selfMemberStudentIds: string[] = [],
): Map<string, AckTally> {
  const bySession = new Map<string, AckRow[]>();
  for (const r of rows) {
    const list = bySession.get(r.session_id) ?? [];
    list.push(r);
    bySession.set(r.session_id, list);
  }

  const selfMembers = new Set(selfMemberStudentIds);

  const out = new Map<string, AckTally>();
  for (const c of classes) {
    if (c.studioWide) {
      // One "acknowledger" per family account (student_id null) and one per
      // self-managed member (their own student row). Namespaced so a family id and
      // a student id can never collide in the same set.
      const acknowledgers = new Set<string>();
      for (const sid of c.sessionIds) {
        for (const r of bySession.get(sid) ?? []) {
          if (r.student_id === null && r.family_id) acknowledgers.add(`fam:${r.family_id}`);
          else if (r.student_id && selfMembers.has(r.student_id)) {
            acknowledgers.add(`self:${r.student_id}`);
          }
        }
      }
      out.set(c.classId, {
        acked: acknowledgers.size,
        total: totalFamilies + selfMembers.size,
      });
    } else {
      const enrolled = new Set(c.enrolledStudentIds);
      const acked = new Set<string>();
      for (const sid of c.sessionIds) {
        for (const r of bySession.get(sid) ?? []) {
          if (r.student_id && enrolled.has(r.student_id)) acked.add(r.student_id);
        }
      }
      out.set(c.classId, { acked: acked.size, total: enrolled.size });
    }
  }
  return out;
}
