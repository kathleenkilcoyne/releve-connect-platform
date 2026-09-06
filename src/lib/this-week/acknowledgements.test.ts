// The "Got it" pure core — family stamping + the studio readout math, proven
// without a database (the DB reads/writes are thin wrappers over these).

import { describe, expect, it } from "vitest";

import { markFamilyAcks, summarizeClassAcks, type AckRow } from "./acknowledgements";
import type { CalendarEvent } from "./types";

/** A minimal family card carrying ack context, enough for the stamper. */
function card(id: string, ack: CalendarEvent["ack"]): CalendarEvent {
  return {
    id,
    day: "mon",
    category: "rehearsing",
    title: "Event",
    time: { start: "5:00 PM" },
    detail: [],
    ack,
  };
}

describe("markFamilyAcks — family view grey → green", () => {
  it("marks a TARGETED card done when its dancer has an ack row", () => {
    const events = [
      card("sess1", { sessionId: "sess1", scope: "targeted", studentIds: ["stuA"], familyId: "famA", acknowledgedAt: null }),
    ];
    const rows: AckRow[] = [
      { session_id: "sess1", student_id: "stuA", family_id: "famA", acknowledged_at: "2026-08-08T12:00:00Z" },
    ];
    markFamilyAcks(events, rows);
    expect(events[0].ack?.acknowledgedAt).toBe("2026-08-08T12:00:00Z");
  });

  it("leaves a targeted card grey (null) when there is no matching row", () => {
    const events = [
      card("sess1", { sessionId: "sess1", scope: "targeted", studentIds: ["stuA"], familyId: "famA", acknowledgedAt: null }),
    ];
    markFamilyAcks(events, []);
    expect(events[0].ack?.acknowledgedAt).toBeNull();
  });

  it("marks a STUDIO-WIDE card done via the family-level row (student_id null)", () => {
    const events = [
      card("sessW", { sessionId: "sessW", scope: "studio_wide", studentIds: [], familyId: "famA", acknowledgedAt: null }),
    ];
    const rows: AckRow[] = [
      { session_id: "sessW", student_id: null, family_id: "famA", acknowledged_at: "2026-08-08T13:00:00Z" },
    ];
    markFamilyAcks(events, rows);
    expect(events[0].ack?.acknowledgedAt).toBe("2026-08-08T13:00:00Z");
  });

  it("does not let a targeted row satisfy a studio-wide card (and vice-versa)", () => {
    const events = [
      card("sessW", { sessionId: "sessW", scope: "studio_wide", studentIds: [], familyId: "famA", acknowledgedAt: null }),
    ];
    // A per-student row for the same session must NOT mark the family-level card.
    markFamilyAcks(events, [
      { session_id: "sessW", student_id: "stuA", family_id: "famA", acknowledged_at: "2026-08-08T13:00:00Z" },
    ]);
    expect(events[0].ack?.acknowledgedAt).toBeNull();
  });

  it("marks a sibling-shared targeted card done if ANY of its dancers acked", () => {
    const events = [
      card("sessS", { sessionId: "sessS", scope: "targeted", studentIds: ["stuA", "stuB"], familyId: "famA", acknowledgedAt: null }),
    ];
    markFamilyAcks(events, [
      { session_id: "sessS", student_id: "stuB", family_id: "famA", acknowledged_at: "2026-08-08T14:00:00Z" },
    ]);
    expect(events[0].ack?.acknowledgedAt).toBe("2026-08-08T14:00:00Z");
  });
});

describe("summarizeClassAcks — studio readout 'M of N'", () => {
  it("targeted: counts distinct enrolled dancers who acknowledged (1 of 1)", () => {
    const out = summarizeClassAcks(
      [{ classId: "c1", studioWide: false, sessionIds: ["s1"], enrolledStudentIds: ["stuA"] }],
      [{ session_id: "s1", student_id: "stuA", family_id: "famA", acknowledged_at: "t" }],
      /* totalFamilies */ 1,
    );
    expect(out.get("c1")).toEqual({ acked: 1, total: 1 });
  });

  it("targeted: 1 of 2 when only one of two enrolled dancers acked", () => {
    const out = summarizeClassAcks(
      [{ classId: "c1", studioWide: false, sessionIds: ["s1"], enrolledStudentIds: ["stuA", "stuB"] }],
      [{ session_id: "s1", student_id: "stuA", family_id: "famA", acknowledged_at: "t" }],
      2,
    );
    expect(out.get("c1")).toEqual({ acked: 1, total: 2 });
  });

  it("targeted: an ack from a non-enrolled dancer does not count", () => {
    const out = summarizeClassAcks(
      [{ classId: "c1", studioWide: false, sessionIds: ["s1"], enrolledStudentIds: ["stuA"] }],
      [{ session_id: "s1", student_id: "ghost", family_id: "famX", acknowledged_at: "t" }],
      1,
    );
    expect(out.get("c1")).toEqual({ acked: 0, total: 1 });
  });

  it("studio-wide: counts distinct FAMILIES against the studio's family total (10 of 15)", () => {
    const rows: AckRow[] = Array.from({ length: 10 }, (_, i) => ({
      session_id: "sw",
      student_id: null,
      family_id: `fam${i}`,
      acknowledged_at: "t",
    }));
    const out = summarizeClassAcks(
      [{ classId: "cw", studioWide: true, sessionIds: ["sw"], enrolledStudentIds: [] }],
      rows,
      /* totalFamilies */ 15,
    );
    expect(out.get("cw")).toEqual({ acked: 10, total: 15 });
  });

  it("de-dupes a family that acked across two occurrences of the same class", () => {
    const out = summarizeClassAcks(
      [{ classId: "cw", studioWide: true, sessionIds: ["sw1", "sw2"], enrolledStudentIds: [] }],
      [
        { session_id: "sw1", student_id: null, family_id: "famA", acknowledged_at: "t" },
        { session_id: "sw2", student_id: null, family_id: "famA", acknowledged_at: "t" },
      ],
      3,
    );
    expect(out.get("cw")).toEqual({ acked: 1, total: 3 });
  });
});

/* ───────────────────  Self-managed members (dance team)  ─────────────────── */
// A dance team's dancers are ADULTS: no guardian, no family_account
// (students.family_id is null), their own account (transferred_to_user_id). They
// have no family to acknowledge with, so a studio-wide ack is recorded against
// their OWN student row — and the coach's denominator counts MEMBERS, not
// families. These are the two halves of the broken "Got it" loop for a team.

describe("markFamilyAcks — a self-managed member's studio-wide card", () => {
  it("marks the card done from the member's OWN student row", () => {
    const events = [
      card("sessW", { sessionId: "sessW", scope: "studio_wide", studentIds: ["selfA"], familyId: null, acknowledgedAt: null }),
    ];
    markFamilyAcks(events, [
      { session_id: "sessW", student_id: "selfA", family_id: null, acknowledged_at: "2026-09-05T12:00:00Z" },
    ]);
    expect(events[0].ack?.acknowledgedAt).toBe("2026-09-05T12:00:00Z");
  });

  it("leaves it grey when the member has not acknowledged", () => {
    const events = [
      card("sessW", { sessionId: "sessW", scope: "studio_wide", studentIds: ["selfA"], familyId: null, acknowledgedAt: null }),
    ];
    markFamilyAcks(events, [
      { session_id: "sessW", student_id: "selfB", family_id: null, acknowledged_at: "2026-09-05T12:00:00Z" },
    ]);
    expect(events[0].ack?.acknowledgedAt).toBeNull();
  });

  it("is NOT satisfied by someone else's family-level row for the same session", () => {
    // Belt and braces: RLS never shows a member another party's ack, but the
    // stamper must not cross the lanes even if one leaked in.
    const events = [
      card("sessW", { sessionId: "sessW", scope: "studio_wide", studentIds: ["selfA"], familyId: null, acknowledgedAt: null }),
    ];
    markFamilyAcks(events, [
      { session_id: "sessW", student_id: null, family_id: "famA", acknowledged_at: "2026-09-05T12:00:00Z" },
    ]);
    expect(events[0].ack?.acknowledgedAt).toBeNull();
  });

  it("does not change the guardian-family lane (studio-wide card with no student ids)", () => {
    const events = [
      card("sessW", { sessionId: "sessW", scope: "studio_wide", studentIds: [], familyId: "famA", acknowledgedAt: null }),
    ];
    markFamilyAcks(events, [
      { session_id: "sessW", student_id: null, family_id: "famA", acknowledged_at: "2026-09-05T13:00:00Z" },
    ]);
    expect(events[0].ack?.acknowledgedAt).toBe("2026-09-05T13:00:00Z");
  });
});

describe("summarizeClassAcks — studio-wide denominator with self-managed members", () => {
  it("a DANCE TEAM: counts members, not families (3 of 5) — was 0 of 0", () => {
    const members = ["m1", "m2", "m3", "m4", "m5"];
    const rows: AckRow[] = ["m1", "m2", "m3"].map((m) => ({
      session_id: "sw",
      student_id: m,
      family_id: null,
      acknowledged_at: "t",
    }));
    const out = summarizeClassAcks(
      [{ classId: "cw", studioWide: true, sessionIds: ["sw"], enrolledStudentIds: [] }],
      rows,
      /* totalFamilies */ 0,
      /* selfMemberStudentIds */ members,
    );
    expect(out.get("cw")).toEqual({ acked: 3, total: 5 });
  });

  it("counts a member exactly once across two occurrences of the same event", () => {
    const out = summarizeClassAcks(
      [{ classId: "cw", studioWide: true, sessionIds: ["sw1", "sw2"], enrolledStudentIds: [] }],
      [
        { session_id: "sw1", student_id: "m1", family_id: null, acknowledged_at: "t" },
        { session_id: "sw2", student_id: "m1", family_id: null, acknowledged_at: "t" },
      ],
      0,
      ["m1", "m2"],
    );
    expect(out.get("cw")).toEqual({ acked: 1, total: 2 });
  });

  it("ignores an ack from someone who is not on the roster", () => {
    const out = summarizeClassAcks(
      [{ classId: "cw", studioWide: true, sessionIds: ["sw"], enrolledStudentIds: [] }],
      [{ session_id: "sw", student_id: "ghost", family_id: null, acknowledged_at: "t" }],
      0,
      ["m1", "m2"],
    );
    expect(out.get("cw")).toEqual({ acked: 0, total: 2 });
  });

  it("a MIXED org: families and members are one denominator, counted once each", () => {
    const out = summarizeClassAcks(
      [{ classId: "cw", studioWide: true, sessionIds: ["sw"], enrolledStudentIds: [] }],
      [
        { session_id: "sw", student_id: null, family_id: "famA", acknowledged_at: "t" },
        { session_id: "sw", student_id: "m1", family_id: null, acknowledged_at: "t" },
      ],
      /* totalFamilies */ 2,
      /* selfMemberStudentIds */ ["m1"],
    );
    expect(out.get("cw")).toEqual({ acked: 2, total: 3 });
  });

  it("a family dancer's TARGETED row still never counts toward a studio-wide tally", () => {
    const out = summarizeClassAcks(
      [{ classId: "cw", studioWide: true, sessionIds: ["sw"], enrolledStudentIds: [] }],
      [{ session_id: "sw", student_id: "stuA", family_id: "famA", acknowledged_at: "t" }],
      3,
      ["m1"],
    );
    expect(out.get("cw")).toEqual({ acked: 0, total: 4 });
  });

  it("a studio with no self-managed members is unchanged (10 of 15)", () => {
    const rows: AckRow[] = Array.from({ length: 10 }, (_, i) => ({
      session_id: "sw",
      student_id: null,
      family_id: `fam${i}`,
      acknowledged_at: "t",
    }));
    const out = summarizeClassAcks(
      [{ classId: "cw", studioWide: true, sessionIds: ["sw"], enrolledStudentIds: [] }],
      rows,
      15,
      [],
    );
    expect(out.get("cw")).toEqual({ acked: 10, total: 15 });
  });
});
