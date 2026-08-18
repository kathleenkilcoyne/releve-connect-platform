import { describe, it, expect } from "vitest";
import {
  canonicalServiceSlug,
  canonicalServiceSlugs,
  LEGACY_AVAILABILITY_SLUGS,
  LEGACY_AVAILABILITY_TO_SERVICE,
  LEGACY_SERVICE_ALIASES,
  legacyAvailabilityAsServices,
  serviceSlug,
  toServiceOptions,
} from "./services";

// The Roster discovers people through MY SERVICES (the 2026-08-18 principle:
// one fact, one source of truth). Search returning correct filtered results is
// a flow that MUST NOT break (CLAUDE.md guardrail #6), and this facet has an
// extra way to break silently: the slug is computed in TWO places — here, and
// in the SQL that builds `roster_profiles.service_slugs`. If they drift, the
// facet matches nothing and raises no error.

describe("serviceSlug — must stay identical to the SQL in migration 20260818152849", () => {
  // Each of these was run through the live SQL expression
  //   lower(btrim(regexp_replace(btrim(title), '[^a-zA-Z0-9]+', '-', 'g'), '-'))
  // and produced exactly the value on the right.
  const SHARED_WITH_SQL: ReadonlyArray<[string, string]> = [
    ["Choreography", "choreography"],
    ["Master Classes", "master-classes"],
    ["Private Coaching", "private-coaching"],
    ["Adjudication", "adjudication"],
    ["Guest Teaching", "guest-teaching"],
    ["Private Audition Coaching", "private-audition-coaching"],
    ["  Competition  Cleaning! ", "competition-cleaning"],
    ["Jazz & Tap", "jazz-tap"],
  ];

  for (const [title, expected] of SHARED_WITH_SQL) {
    it(`${JSON.stringify(title)} → ${expected}`, () => {
      expect(serviceSlug(title)).toBe(expected);
    });
  }

  it("collapses any run of non-alphanumerics to a single dash", () => {
    expect(serviceSlug("Ballet -- Pointe")).toBe("ballet-pointe");
    expect(serviceSlug("A___B")).toBe("a-b");
  });

  it("never leaves a leading or trailing dash", () => {
    expect(serviceSlug("!Choreography!")).toBe("choreography");
    expect(serviceSlug("---Tap---")).toBe("tap");
  });

  it("is idempotent — slugging a slug changes nothing", () => {
    for (const [, slug] of SHARED_WITH_SQL) expect(serviceSlug(slug)).toBe(slug);
  });

  it("returns empty for a title with nothing sluggable in it", () => {
    expect(serviceSlug("!!!")).toBe("");
    expect(serviceSlug("   ")).toBe("");
  });
});

// The four retired `kind = 'currently'` tags. These MUST keep working: a studio
// may have bookmarked /roster?avail=accepting-choreography.
describe("legacy availability tags still find people", () => {
  it("maps every retired tag to the service that replaced it", () => {
    expect(LEGACY_AVAILABILITY_TO_SERVICE).toEqual({
      "accepting-choreography": "choreography",
      "accepting-master-classes": "master-classes",
      "available-for-adjudication": "adjudication",
      "available-for-guest-teaching": "guest-teaching",
    });
  });

  it("every mapped target is a real slug of its label", () => {
    expect(serviceSlug("Choreography")).toBe(LEGACY_AVAILABILITY_TO_SERVICE["accepting-choreography"]);
    expect(serviceSlug("Master Classes")).toBe(LEGACY_AVAILABILITY_TO_SERVICE["accepting-master-classes"]);
    expect(serviceSlug("Adjudication")).toBe(LEGACY_AVAILABILITY_TO_SERVICE["available-for-adjudication"]);
    expect(serviceSlug("Guest Teaching")).toBe(LEGACY_AVAILABILITY_TO_SERVICE["available-for-guest-teaching"]);
  });

  it("expands a retired tag to its service", () => {
    expect(legacyAvailabilityAsServices(["accepting-choreography"])).toEqual(["choreography"]);
  });

  it("expands several at once, without duplicates", () => {
    expect(
      legacyAvailabilityAsServices([...LEGACY_AVAILABILITY_SLUGS, "accepting-choreography"]).sort(),
    ).toEqual(["adjudication", "choreography", "guest-teaching", "master-classes"]);
  });

  // The common case: a plain availability filter must behave exactly as before.
  it("expands a general availability tag to nothing", () => {
    expect(legacyAvailabilityAsServices(["weekends", "willing-to-travel"])).toEqual([]);
    expect(legacyAvailabilityAsServices([])).toEqual([]);
  });

  it("ignores slugs it does not recognise", () => {
    expect(legacyAvailabilityAsServices(["not-a-tag"])).toEqual([]);
  });
});

describe("toServiceOptions — the filter pick-list is derived, never curated", () => {
  it("builds one option per distinct service", () => {
    expect(toServiceOptions(["Choreography", "Master Classes"])).toEqual([
      { slug: "choreography", label: "Choreography" },
      { slug: "master-classes", label: "Master Classes" },
    ]);
  });

  it("collapses titles that slugify identically, keeping the first label", () => {
    const out = toServiceOptions(["Guest Teaching", "guest teaching", "GUEST  TEACHING"]);
    expect(out).toEqual([{ slug: "guest-teaching", label: "Guest Teaching" }]);
  });

  it("sorts alphabetically by label, so the bar is stable between renders", () => {
    const out = toServiceOptions(["Master Classes", "Adjudication", "Choreography"]);
    expect(out.map((o) => o.label)).toEqual(["Adjudication", "Choreography", "Master Classes"]);
  });

  it("drops blank and unsluggable titles rather than offering a dead filter", () => {
    expect(toServiceOptions(["", "   ", "!!!", "Tap"])).toEqual([
      { slug: "tap", label: "Tap" },
    ]);
  });

  it("handles an empty roster", () => {
    expect(toServiceOptions([])).toEqual([]);
  });

  // The five the founder asked to be discoverable, in the order they were given.
  it("makes all five founder-specified services available as filters", () => {
    const titles = [
      "Choreography",
      "Master Classes",
      "Private Coaching",
      "Adjudication",
      "Guest Teaching",
    ];
    const slugs = toServiceOptions(titles).map((o) => o.slug).sort();
    expect(slugs).toEqual([
      "adjudication",
      "choreography",
      "guest-teaching",
      "master-classes",
      "private-coaching",
    ]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   The Private Audition Coaching → Private Coaching merge (founder, 2026-08-18).

   The canonical top-level set is FIVE. Audition Prep is a specialization of
   Private Coaching, not a service of its own — promoting every specialization
   would turn My Services into twenty near-identical buttons.
   ══════════════════════════════════════════════════════════════════════════ */

describe("retired service slugs still find the right people", () => {
  it("maps private-audition-coaching to private-coaching", () => {
    expect(LEGACY_SERVICE_ALIASES).toEqual({
      "private-audition-coaching": "private-coaching",
    });
  });

  it("the alias source and target are both real slugs of their titles", () => {
    expect(serviceSlug("Private Audition Coaching")).toBe("private-audition-coaching");
    expect(serviceSlug("Private Coaching")).toBe("private-coaching");
  });

  it("resolves a retired slug to the canonical one", () => {
    expect(canonicalServiceSlug("private-audition-coaching")).toBe("private-coaching");
  });

  it("passes an unknown or already-canonical slug straight through", () => {
    expect(canonicalServiceSlug("private-coaching")).toBe("private-coaching");
    expect(canonicalServiceSlug("choreography")).toBe("choreography");
    expect(canonicalServiceSlug("something-invented")).toBe("something-invented");
  });

  it("is idempotent — resolving twice changes nothing", () => {
    const once = canonicalServiceSlug("private-audition-coaching");
    expect(canonicalServiceSlug(once)).toBe(once);
  });

  it("resolves a whole filter list, de-duped", () => {
    expect(
      canonicalServiceSlugs(["private-audition-coaching", "private-coaching"]),
    ).toEqual(["private-coaching"]);
  });

  it("leaves the other four canonical services untouched", () => {
    expect(
      canonicalServiceSlugs([
        "choreography",
        "master-classes",
        "adjudication",
        "guest-teaching",
      ]),
    ).toEqual(["choreography", "master-classes", "adjudication", "guest-teaching"]);
  });

  it("handles an empty filter", () => {
    expect(canonicalServiceSlugs([])).toEqual([]);
  });
});

describe("the canonical top-level service set is five", () => {
  // A guard on the product decision, not just the code: if a sixth top-level
  // service is ever added here, that is a deliberate act, not a drift.
  it("Choreography · Master Classes · Private Coaching · Adjudication · Guest Teaching", () => {
    const canonical = [
      "Choreography",
      "Master Classes",
      "Private Coaching",
      "Adjudication",
      "Guest Teaching",
    ];
    expect(canonical).toHaveLength(5);
    expect(canonical.map(serviceSlug)).toEqual([
      "choreography",
      "master-classes",
      "private-coaching",
      "adjudication",
      "guest-teaching",
    ]);
  });

  it("no canonical slug is itself a retired alias", () => {
    for (const title of [
      "Choreography",
      "Master Classes",
      "Private Coaching",
      "Adjudication",
      "Guest Teaching",
    ]) {
      expect(LEGACY_SERVICE_ALIASES[serviceSlug(title)]).toBeUndefined();
    }
  });
});
