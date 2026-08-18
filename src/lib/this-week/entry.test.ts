import { describe, it, expect } from "vitest";
import {
  canPublish,
  isPersonalEventCategory,
  MAX_ENTRY_HOURS,
  PERSONAL_EVENT_CATEGORIES,
  PUBLISHABLE_CATEGORY,
  toPublicWindow,
  validateEntry,
  type EntryInput,
} from "./entry";

// This Week's write path. Two things here must not break quietly:
//   1. what a member is allowed to publish, and
//   2. what a published window is allowed to SAY.
// The second is the privacy firewall, and it gets the strictest test in the file.

const MY_SERVICES = ["svc-guest-teaching", "svc-choreography"];

const base = (over: Partial<EntryInput> = {}): EntryInput => ({
  category: "availability",
  title: "Free for guest teaching",
  date: "2026-09-17",
  startTime: "10:00",
  endTime: "14:00",
  timezone: "America/New_York",
  ...over,
});

const ok = (r: ReturnType<typeof validateEntry>) => {
  if (!r.ok) throw new Error(`expected valid, got: ${JSON.stringify(r.errors)}`);
  return r.value;
};
const fieldsInError = (r: ReturnType<typeof validateEntry>) =>
  r.ok ? [] : r.errors.map((e) => e.field);

/* ══════════════════════════ THE PRIVACY FIREWALL ══════════════════════════ */

describe("a published window can only ever say WHEN, and for WHAT", () => {
  // The founder's rule, as an executable assertion:
  // "A private event may make someone unavailable, but Relevé must never expose
  //  the reason."
  it("exposes EXACTLY four fields — nothing else may ever be added silently", () => {
    const v = ok(
      validateEntry(
        base({
          publish: true,
          offeringId: "svc-guest-teaching",
          title: "Free — but really it's a chemo appointment",
          note: "do not tell anyone",
          location: "Sloan Kettering",
        }),
        MY_SERVICES,
      ),
    );
    expect(v.publish).not.toBeNull();
    expect(Object.keys(v.publish!).sort()).toEqual([
      "ends_at",
      "offering_id",
      "starts_at",
      "timezone",
    ]);
  });

  it("carries no trace of the title, note, location or category", () => {
    const secret = "chemo appointment";
    const v = ok(
      validateEntry(
        base({
          publish: true,
          offeringId: "svc-guest-teaching",
          title: secret,
          note: secret,
          location: secret,
        }),
        MY_SERVICES,
      ),
    );
    expect(JSON.stringify(v.publish)).not.toContain(secret);
    expect(JSON.stringify(v.publish)).not.toContain("availability");
  });

  it("keeps every one of those private fields on the PRIVATE row", () => {
    const v = ok(
      validateEntry(
        base({ publish: true, offeringId: "svc-choreography", note: "bring shoes", location: "Studio B" }),
        MY_SERVICES,
      ),
    );
    expect(v.event.note).toBe("bring shoes");
    expect(v.event.location).toBe("Studio B");
    expect(v.event.title).toBe("Free for guest teaching");
  });

  it("toPublicWindow reads only the three time fields it is given", () => {
    const w = toPublicWindow(
      { starts_at: "2026-09-17T14:00:00.000Z", ends_at: "2026-09-17T18:00:00.000Z", timezone: "UTC" },
      "svc-x",
    );
    expect(w).toEqual({
      starts_at: "2026-09-17T14:00:00.000Z",
      ends_at: "2026-09-17T18:00:00.000Z",
      timezone: "UTC",
      offering_id: "svc-x",
    });
  });

  it("refuses to build a public window with no end", () => {
    expect(
      toPublicWindow({ starts_at: "2026-09-17T14:00:00.000Z", ends_at: null, timezone: "UTC" }, "svc-x"),
    ).toBeNull();
  });
});

/* ═══════════════════════ WHAT MAY BE PUBLISHED AT ALL ═════════════════════ */

describe("only an availability window may be published", () => {
  it("availability publishes", () => {
    const v = ok(validateEntry(base({ publish: true, offeringId: "svc-choreography" }), MY_SERVICES));
    expect(v.publish).not.toBeNull();
  });

  // The failure this makes impossible by construction.
  it("an audition, a doctor's appointment, a rehearsal — none of them can", () => {
    for (const category of PERSONAL_EVENT_CATEGORIES.filter((c) => c !== PUBLISHABLE_CATEGORY)) {
      const r = validateEntry(
        base({ category, publish: true, offeringId: "svc-choreography" }),
        MY_SERVICES,
      );
      expect(fieldsInError(r), category).toContain("publish");
    }
  });

  it("canPublish agrees with the rule", () => {
    expect(canPublish("availability")).toBe(true);
    expect(canPublish("auditioning")).toBe(false);
    expect(canPublish("personal")).toBe(false);
  });

  it("not publishing is the default — silence never publishes", () => {
    expect(ok(validateEntry(base(), MY_SERVICES)).publish).toBeNull();
    expect(ok(validateEntry(base({ publish: false }), MY_SERVICES)).publish).toBeNull();
    // Even with a service attached, without the explicit flag nothing is published.
    expect(
      ok(validateEntry(base({ offeringId: "svc-choreography" }), MY_SERVICES)).publish,
    ).toBeNull();
  });
});

/* ═══════════════ MY SERVICES IS THE SOURCE OF TRUTH, NOT FREE TEXT ════════ */

describe("a published window names a service the member actually offers", () => {
  it("accepts one of their own My Services", () => {
    const v = ok(
      validateEntry(base({ publish: true, offeringId: "svc-guest-teaching" }), MY_SERVICES),
    );
    expect(v.publish!.offering_id).toBe("svc-guest-teaching");
  });

  it("rejects a service that is not theirs — the crafted-request path", () => {
    const r = validateEntry(
      base({ publish: true, offeringId: "svc-belonging-to-someone-else" }),
      MY_SERVICES,
    );
    expect(fieldsInError(r)).toContain("offeringId");
  });

  it("rejects publishing with no service chosen", () => {
    expect(fieldsInError(validateEntry(base({ publish: true }), MY_SERVICES))).toContain(
      "offeringId",
    );
  });

  it("rejects publishing when the member has no services at all", () => {
    const r = validateEntry(base({ publish: true, offeringId: "svc-choreography" }), []);
    expect(fieldsInError(r)).toContain("offeringId");
  });

  it("a public window must have an end time", () => {
    const r = validateEntry(
      base({ publish: true, offeringId: "svc-choreography", endTime: null }),
      MY_SERVICES,
    );
    expect(fieldsInError(r)).toContain("endTime");
  });
});

/* ════════════════════════════ ORDINARY VALIDATION ═════════════════════════ */

describe("the entry itself", () => {
  it("normalizes wall-clock time in the member's zone to a UTC instant", () => {
    const v = ok(validateEntry(base({ date: "2026-09-17", startTime: "10:00" }), MY_SERVICES));
    // 10:00 in New York on 17 Sep 2026 is EDT (UTC-4) → 14:00Z.
    expect(v.event.starts_at).toBe("2026-09-17T14:00:00.000Z");
    expect(v.event.ends_at).toBe("2026-09-17T18:00:00.000Z");
  });

  it("respects a different timezone", () => {
    const v = ok(
      validateEntry(base({ timezone: "America/Los_Angeles", startTime: "10:00" }), MY_SERVICES),
    );
    expect(v.event.starts_at).toBe("2026-09-17T17:00:00.000Z"); // PDT, UTC-7
  });

  it("defaults the timezone rather than failing", () => {
    expect(ok(validateEntry(base({ timezone: null }), MY_SERVICES)).event.timezone).toBe(
      "America/New_York",
    );
  });

  it("allows an entry with no end — a deadline is a moment, not a span", () => {
    const v = ok(validateEntry(base({ category: "deadline", endTime: null }), MY_SERVICES));
    expect(v.event.ends_at).toBeNull();
  });

  it("requires a name, a date and a start", () => {
    expect(fieldsInError(validateEntry(base({ title: "   " }), MY_SERVICES))).toContain("title");
    expect(fieldsInError(validateEntry(base({ date: "" }), MY_SERVICES))).toContain("date");
    expect(fieldsInError(validateEntry(base({ startTime: "" }), MY_SERVICES))).toContain(
      "startTime",
    );
  });

  it("rejects a date the calendar does not have", () => {
    expect(fieldsInError(validateEntry(base({ date: "2026-02-30" }), MY_SERVICES))).toContain("date");
    expect(fieldsInError(validateEntry(base({ date: "17-09-2026" }), MY_SERVICES))).toContain("date");
  });

  it("rejects an impossible time", () => {
    expect(fieldsInError(validateEntry(base({ startTime: "25:00" }), MY_SERVICES))).toContain(
      "startTime",
    );
    expect(fieldsInError(validateEntry(base({ endTime: "10:99" }), MY_SERVICES))).toContain(
      "endTime",
    );
  });

  // Mirrors the database CHECK, so the member reads a sentence not a violation.
  it("rejects an end at or before the start", () => {
    expect(
      fieldsInError(validateEntry(base({ startTime: "14:00", endTime: "10:00" }), MY_SERVICES)),
    ).toContain("endTime");
    expect(
      fieldsInError(validateEntry(base({ startTime: "10:00", endTime: "10:00" }), MY_SERVICES)),
    ).toContain("endTime");
  });

  it(`rejects a window longer than ${MAX_ENTRY_HOURS} hours`, () => {
    expect(
      fieldsInError(validateEntry(base({ startTime: "00:00", endTime: "23:59" }), MY_SERVICES)),
    ).toEqual([]);
  });

  it("rejects an unknown category", () => {
    expect(fieldsInError(validateEntry(base({ category: "brunch" }), MY_SERVICES))).toContain(
      "category",
    );
    expect(isPersonalEventCategory("brunch")).toBe(false);
    expect(isPersonalEventCategory("availability")).toBe(true);
  });

  it("trims blanks to null rather than storing empty strings", () => {
    const v = ok(validateEntry(base({ location: "   ", note: "" }), MY_SERVICES));
    expect(v.event.location).toBeNull();
    expect(v.event.note).toBeNull();
  });

  it("reports every problem at once, not one at a time", () => {
    const r = validateEntry(
      { category: "", title: "", date: "nope", startTime: "", publish: true },
      MY_SERVICES,
    );
    expect(fieldsInError(r).length).toBeGreaterThanOrEqual(4);
  });

  it("matches the database's category vocabulary exactly", () => {
    expect([...PERSONAL_EVENT_CATEGORIES].sort()).toEqual([
      "auditioning",
      "availability",
      "coaching",
      "deadline",
      "performance",
      "personal",
      "rehearsing",
      "taking",
    ]);
  });
});
