// "This Week" — the per-family merge (Slice 3).
//
// A guardian's week is ONE personalized week assembled from everything targeted
// at their child(ren): each child's enrolled sessions PLUS the family-level
// studio-wide events at the studio(s) their children belong to.
//
// This module is the pure, testable heart of the two family-safe guards:
//   1. NO DUPLICATE EVENTS — de-dupe by session id across the merged week. A
//      studio-wide event (resolved ONCE at the family level) surfaces once, never
//      once per child; two siblings enrolled in the same shared class collapse to
//      one card too.
//   2. WHOSE IS IT — a session only one child is in names that child (`who`); a
//      studio-wide or sibling-shared item is left for the family (no child tag).
//
// It takes already-resolved session lists (the SQL lives in queries.ts) so it can
// be unit-tested without a database, like recurrence.ts / adapters.ts.

import { toCalendarEvent } from "./adapters";
import type { SessionWithClass } from "./queries";
import type { CalendarEvent } from "./types";

/** One child's resolved sessions, tagged with who they belong to. */
export interface ChildStream {
  childId: string;
  childName: string;
  sessions: SessionWithClass[];
}

/**
 * Merge a family's per-child enrolled sessions and the family-level studio-wide
 * sessions into one week's worth of cards, de-duped by session id and labeled.
 *
 * `studioWide` MUST be resolved once at the family level (not per child) — see
 * queries.fetchFamilyStudioWide. Passing it per child would defeat the de-dupe.
 */
export function mergeFamilyWeek(
  children: ChildStream[],
  studioWide: SessionWithClass[],
  timeZone: string,
): CalendarEvent[] {
  interface Agg {
    item: SessionWithClass;
    childNames: string[];
    studioWide: boolean;
  }
  const bySession = new Map<string, Agg>();

  for (const child of children) {
    for (const s of child.sessions) {
      const id = s.session.session_id;
      const agg = bySession.get(id) ?? { item: s, childNames: [], studioWide: false };
      if (!agg.childNames.includes(child.childName)) agg.childNames.push(child.childName);
      bySession.set(id, agg);
    }
  }

  for (const s of studioWide) {
    const id = s.session.session_id;
    const agg = bySession.get(id) ?? { item: s, childNames: [], studioWide: false };
    agg.studioWide = true; // resolved once at the family level
    bySession.set(id, agg);
  }

  const withInstant: { event: CalendarEvent; at: number }[] = [];
  for (const agg of bySession.values()) {
    const event = toCalendarEvent(agg.item, "student", timeZone);
    // A per-child item names its child; a studio-wide item, or one shared by two
    // siblings, is for the family (no single child tag).
    if (!agg.studioWide && agg.childNames.length === 1) {
      event.who = agg.childNames[0];
    }
    withInstant.push({ event, at: new Date(agg.item.session.starts_at).getTime() });
  }

  // One calendar, ordered by real start instant.
  return withInstant.sort((a, b) => a.at - b.at).map((x) => x.event);
}

/** The child display names in a merged family week, de-duped and ordered. */
export function familyChildNames(children: ChildStream[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const c of children) {
    if (!seen.has(c.childName)) {
      seen.add(c.childName);
      names.push(c.childName);
    }
  }
  return names;
}
