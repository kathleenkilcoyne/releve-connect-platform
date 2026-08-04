// Tests for the per-family merge — the two family-safe guards that are pure
// enough to prove without a database:
//   1. No duplicate events (studio-wide once at the family level; sibling-shared
//      collapses to one) — de-duped by session id.
//   2. Whose is it — a per-child item names its child; a family item does not.

import { describe, expect, it } from "vitest";

import { mergeFamilyWeek, familyChildNames, type ChildStream } from "./family";
import type { SessionWithClass } from "./queries";

const NY = "America/New_York";

/** A session at a given id/time, so we can control de-dupe and ordering. */
function sess(
  session_id: string,
  title: string,
  startsAtIso: string,
  opts: {
    studioWide?: boolean;
    class_id?: string;
    status?: "scheduled" | "moved" | "canceled";
    note?: string | null;
  } = {},
): SessionWithClass {
  const class_id = opts.class_id ?? `class_${session_id}`;
  return {
    session: {
      session_id,
      class_id,
      starts_at: startsAtIso,
      ends_at: null,
      status: opts.status ?? "scheduled",
      note: opts.note ?? null,
    },
    klass: {
      class_id,
      employer_id: "emp_1",
      title,
      location: null,
      room: null,
      teacher_profile_id: null,
      recurrence: null,
      default_start: "18:00:00",
      default_end: null,
      timezone: NY,
      series_start: "2026-07-01",
      series_end: null,
      kind: "rehearsal",
      event_type: opts.studioWide ? "full_studio_event" : "company_rehearsal",
      studio_wide: Boolean(opts.studioWide),
      status: "active",
      employer_profiles: { name: "Tate Academy" },
    } as SessionWithClass["klass"],
    studioName: "Tate Academy",
  };
}

describe("mergeFamilyWeek — de-dupe + labeling", () => {
  it("surfaces a studio-wide event ONCE for a two-child family, unlabeled by child", () => {
    const wide = sess("wide_1", "Full Studio Event", "2026-07-30T22:00:00.000Z", { studioWide: true });
    const children: ChildStream[] = [
      { childId: "ryan", childName: "Ryan", sessions: [sess("ryan_1", "Jazz 2 Rehearsal", "2026-07-27T22:00:00.000Z")] },
      { childId: "sophie", childName: "Sophie", sessions: [sess("soph_1", "Solo Private", "2026-07-30T20:30:00.000Z")] },
    ];

    const merged = mergeFamilyWeek(children, [wide], NY);

    // The studio-wide event appears exactly once.
    const wideCards = merged.filter((e) => e.id === "wide_1");
    expect(wideCards).toHaveLength(1);
    // ...and is NOT tagged to a single child.
    expect(wideCards[0].who).toBeUndefined();
    // Total cards = 2 per-child + 1 studio-wide.
    expect(merged).toHaveLength(3);
  });

  it("names the child on each per-child item", () => {
    const children: ChildStream[] = [
      { childId: "ryan", childName: "Ryan", sessions: [sess("ryan_1", "Jazz 2 Rehearsal", "2026-07-27T22:00:00.000Z")] },
      { childId: "sophie", childName: "Sophie", sessions: [sess("soph_1", "Solo Private", "2026-07-30T20:30:00.000Z")] },
    ];

    const merged = mergeFamilyWeek(children, [], NY);
    expect(merged.find((e) => e.id === "ryan_1")?.who).toBe("Ryan");
    expect(merged.find((e) => e.id === "soph_1")?.who).toBe("Sophie");
  });

  it("collapses a class BOTH siblings are enrolled in to one card, unlabeled by child", () => {
    // Same session id under both children (a shared roster class).
    const shared = sess("shared_1", "Company Rehearsal", "2026-07-31T22:00:00.000Z");
    const children: ChildStream[] = [
      { childId: "ryan", childName: "Ryan", sessions: [shared] },
      { childId: "sophie", childName: "Sophie", sessions: [shared] },
    ];

    const merged = mergeFamilyWeek(children, [], NY);
    const shares = merged.filter((e) => e.id === "shared_1");
    expect(shares).toHaveLength(1);
    // Shared by two children → a family item, not tagged to one.
    expect(shares[0].who).toBeUndefined();
  });

  it("orders the merged week by real start instant", () => {
    const children: ChildStream[] = [
      { childId: "ryan", childName: "Ryan", sessions: [sess("late", "Late", "2026-07-31T22:00:00.000Z")] },
      { childId: "sophie", childName: "Sophie", sessions: [sess("early", "Early", "2026-07-27T14:00:00.000Z")] },
    ];
    const wide = sess("mid", "Middle", "2026-07-29T18:00:00.000Z", { studioWide: true });

    const ids = mergeFamilyWeek(children, [wide], NY).map((e) => e.id);
    expect(ids).toEqual(["early", "mid", "late"]);
  });

  it("surfaces a CANCELED session in the merged week (never silently dropped)", () => {
    const children: ChildStream[] = [
      {
        childId: "ryan",
        childName: "Ryan",
        sessions: [sess("cx", "Jazz 2 Rehearsal", "2026-07-29T22:00:00.000Z", { status: "canceled" })],
      },
    ];
    const merged = mergeFamilyWeek(children, [], NY);
    const card = merged.find((e) => e.id === "cx");
    expect(card).toBeDefined();
    expect(card!.detail).toContain("CANCELED"); // shown, not removed
    expect(card!.who).toBe("Ryan"); // still named to the affected child
  });

  it("surfaces a single MOVED occurrence in the merged week", () => {
    const children: ChildStream[] = [
      {
        childId: "sophie",
        childName: "Sophie",
        sessions: [sess("mv", "Jazz 2 Rehearsal", "2026-07-29T22:30:00.000Z", { status: "moved" })],
      },
    ];
    const merged = mergeFamilyWeek(children, [], NY);
    expect(merged.find((e) => e.id === "mv")?.detail).toContain("moved this week");
  });

  it("de-dupes and orders child names for the family header", () => {
    const children: ChildStream[] = [
      { childId: "a", childName: "Ryan", sessions: [] },
      { childId: "b", childName: "Sophie", sessions: [] },
      { childId: "a2", childName: "Ryan", sessions: [] },
    ];
    expect(familyChildNames(children)).toEqual(["Ryan", "Sophie"]);
  });
});

// Safeguard #3, proven at the DELIVERED-WEEK layer (what a family actually sees).
//
// The audience-change math is the pure diff (targeting.test.ts). Here we prove
// its consequence end-to-end: each family's This Week is an INDEPENDENT merge of
// only that family's children's enrolled streams. When the studio re-targets a
// duet, resolveEventEnrollments drops/adds exactly the affected enrollment, so
// the removed family's stream loses the session, the remaining family's keeps
// it, and an unrelated family — merged from its own streams — never had it.
//
// A duet is ONE studio_class (session id "duet_1"); Ava and Mia are in DIFFERENT
// families, so each reads the same session in its own independent merge.
describe("audience-change isolation — safeguard #3 at the delivered week", () => {
  const duet = () => sess("duet_1", "Contemporary Duet", "2026-07-29T22:00:00.000Z");

  it("REMOVE from a duet: the removed family stops seeing it; the partner keeps it; an unrelated family never had it", () => {
    // Before the change: Ava (family A) and Mia (family B) are both enrolled.
    const avaBefore = mergeFamilyWeek([{ childId: "ava", childName: "Ava", sessions: [duet()] }], [], NY);
    expect(avaBefore.some((e) => e.id === "duet_1")).toBe(true);

    // Studio removes Ava → her enrollment is gone → her stream no longer has it.
    const avaAfter = mergeFamilyWeek([{ childId: "ava", childName: "Ava", sessions: [] }], [], NY);
    expect(avaAfter.some((e) => e.id === "duet_1")).toBe(false);

    // Mia's family is a separate merge — still enrolled, still sees it.
    const miaAfter = mergeFamilyWeek([{ childId: "mia", childName: "Mia", sessions: [duet()] }], [], NY);
    expect(miaAfter.find((e) => e.id === "duet_1")?.who).toBe("Mia");

    // An unrelated family (Noah) is built from its OWN streams — never had it.
    const noah = mergeFamilyWeek([{ childId: "noah", childName: "Noah", sessions: [] }], [], NY);
    expect(noah.some((e) => e.id === "duet_1")).toBe(false);
  });

  it("ADD to a duet: the newly-added family starts seeing it; an unrelated family is untouched", () => {
    // Mia was already in the duet; the studio now adds Ava.
    const avaBefore = mergeFamilyWeek([{ childId: "ava", childName: "Ava", sessions: [] }], [], NY);
    expect(avaBefore.some((e) => e.id === "duet_1")).toBe(false);

    const avaAfter = mergeFamilyWeek([{ childId: "ava", childName: "Ava", sessions: [duet()] }], [], NY);
    expect(avaAfter.find((e) => e.id === "duet_1")?.who).toBe("Ava");

    // Unrelated family never enters either merge.
    const noah = mergeFamilyWeek([{ childId: "noah", childName: "Noah", sessions: [] }], [], NY);
    expect(noah.some((e) => e.id === "duet_1")).toBe(false);
  });
});
