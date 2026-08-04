// Slice 4 — the pure targeting core, proving two of the three family-safe
// safeguards without a database:
//   #1 No duplicate events (at the enrollment-set level): a dancer in two
//      targeted groups, or added on top of a group they're already in, resolves
//      to ONE enrollment.
//   #3 Audience changes reach ONLY affected families: the add/remove diff moves
//      the roster to exactly the new set — removed stop, added start, everyone
//      already targeted is left untouched.

import { describe, expect, it } from "vitest";

import { diffEnrollments, unionTargetedDancers } from "./targeting";

describe("unionTargetedDancers — safeguard #1 (enrollment-set de-dupe)", () => {
  it("de-dupes a dancer who is in two targeted groups to one enrollment", () => {
    const jazz = ["ava", "noah", "mia"];
    const company = ["mia", "liam"]; // mia is in both
    expect(unionTargetedDancers([jazz, company])).toEqual(["ava", "noah", "mia", "liam"]);
  });

  it("de-dupes a dancer added individually on top of a group they're already in", () => {
    expect(unionTargetedDancers([["ava", "noah"]], ["noah", "mia"])).toEqual(["ava", "noah", "mia"]);
  });

  it("resolves a whole-studio (no groups, no dancers) event to an empty roster", () => {
    expect(unionTargetedDancers([], [])).toEqual([]);
  });

  it("resolves a duet (individuals only, no groups) to exactly those dancers", () => {
    expect(unionTargetedDancers([], ["ava", "mia"])).toEqual(["ava", "mia"]);
  });

  it("keeps first-appearance order stable and de-dupes within a single group", () => {
    expect(unionTargetedDancers([["ava", "ava", "noah"]], [])).toEqual(["ava", "noah"]);
  });
});

describe("diffEnrollments — safeguard #3 (audience-change isolation)", () => {
  it("ADD a dancer to a duet: only the new dancer is added, the other untouched", () => {
    const d = diffEnrollments(["ava"], ["ava", "mia"]);
    expect(d.toAdd).toEqual(["mia"]);
    expect(d.toRemove).toEqual([]);
    expect(d.unchanged).toEqual(["ava"]);
  });

  it("REMOVE a dancer from a duet: only that dancer is removed, the other untouched", () => {
    const d = diffEnrollments(["ava", "mia"], ["ava"]);
    expect(d.toRemove).toEqual(["mia"]);
    expect(d.toAdd).toEqual([]);
    expect(d.unchanged).toEqual(["ava"]);
  });

  it("swap the roster entirely: old all removed, new all added, nothing kept", () => {
    const d = diffEnrollments(["ava", "noah"], ["mia", "liam"]);
    expect(new Set(d.toRemove)).toEqual(new Set(["ava", "noah"]));
    expect(new Set(d.toAdd)).toEqual(new Set(["mia", "liam"]));
    expect(d.unchanged).toEqual([]);
  });

  it("no change: an unchanged roster produces no writes (nobody re-enrolled)", () => {
    const d = diffEnrollments(["ava", "mia"], ["mia", "ava"]);
    expect(d.toAdd).toEqual([]);
    expect(d.toRemove).toEqual([]);
    expect(new Set(d.unchanged)).toEqual(new Set(["ava", "mia"]));
  });

  it("clearing the roster (whole-studio conversion) removes everyone, adds none", () => {
    const d = diffEnrollments(["ava", "mia"], []);
    expect(new Set(d.toRemove)).toEqual(new Set(["ava", "mia"]));
    expect(d.toAdd).toEqual([]);
  });

  it("tolerates duplicate ids in either input without duplicating an action", () => {
    const d = diffEnrollments(["ava", "ava"], ["ava", "mia", "mia"]);
    expect(d.toAdd).toEqual(["mia"]);
    expect(d.toRemove).toEqual([]);
    expect(d.unchanged).toEqual(["ava"]);
  });
});
