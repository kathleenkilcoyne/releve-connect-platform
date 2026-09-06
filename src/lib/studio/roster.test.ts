// The roster / "families joined" reads — proving the fix for
// BLOCKER-FAMILY-JOIN-ROSTER.md: a student linked to a studio via an active
// `affiliations` row (what the /join flow writes) MUST appear in both the studio
// roster and the admin "families joined" count, from the same source of truth.
//
// The DB read is a thin wrapper (affiliations JOIN students); the join/count
// semantics live in the pure core, which is what these tests exercise.

import { describe, expect, it } from "vitest";

import { buildRoster, countFamilies, selfManagedMemberIds } from "./roster";

// The exact preserved retest records from the blocker doc, so the assertion maps
// one-to-one to the manual retest ("1 family / 1 dancer 'test'").
const STUDIO = "696d53cc-604b-42a2-a5c0-e4d81442e206";
const FAMILY = "b650402a-f6a9-4d00-b5ff-2dc0800f216c";
const STUDENT = "aeca1e93-42c7-410f-b369-1879c44b62c6";

describe("buildRoster — affiliation is the source of truth for the roster", () => {
  it("puts an actively-affiliated student on the roster (the 'test' dancer)", () => {
    // What the canonical read returns for STUDIO: one active affiliation + its student.
    const roster = buildRoster(
      [{ subject_id: STUDENT, division: null }],
      [{ student_id: STUDENT, display_name: "test", age_range: "7_9", family_id: FAMILY }],
    );
    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({ student_id: STUDENT, display_name: "test", family_id: FAMILY });
  });

  it("counts that dancer's family in 'families joined'", () => {
    const roster = buildRoster(
      [{ subject_id: STUDENT, division: null }],
      [{ student_id: STUDENT, display_name: "test", age_range: "7_9", family_id: FAMILY }],
    );
    expect(countFamilies(roster)).toBe(1);
  });

  it("only includes students that have a matching affiliation row", () => {
    // A student with no affiliation to this studio must NOT appear, even if its
    // row is fetched — the affiliation set is the gate.
    const roster = buildRoster(
      [{ subject_id: STUDENT, division: "Petite" }],
      [
        { student_id: STUDENT, display_name: "test", age_range: null, family_id: FAMILY },
        { student_id: "unaffiliated", display_name: "someone-else", age_range: null, family_id: "fam-x" },
      ],
    );
    expect(roster.map((s) => s.student_id)).toEqual([STUDENT]);
    expect(roster[0].division).toBe("Petite");
  });

  it("counts DISTINCT families and sorts the roster by display name", () => {
    const roster = buildRoster(
      [
        { subject_id: "s1", division: null },
        { subject_id: "s2", division: null },
        { subject_id: "s3", division: null },
      ],
      [
        { student_id: "s1", display_name: "Zoe", age_range: null, family_id: "famA" },
        { student_id: "s2", display_name: "Ava", age_range: null, family_id: "famA" }, // sibling
        { student_id: "s3", display_name: "Mia", age_range: null, family_id: "famB" },
      ],
    );
    expect(roster.map((s) => s.display_name)).toEqual(["Ava", "Mia", "Zoe"]);
    expect(countFamilies(roster)).toBe(2); // two families, three dancers
  });

  it("keeps a self-managed adult (no family_id) on the roster but not in the family count", () => {
    const roster = buildRoster(
      [{ subject_id: "adult", division: null }],
      [{ student_id: "adult", display_name: "College Dancer", age_range: "18_24", family_id: null }],
    );
    expect(roster).toHaveLength(1);
    expect(countFamilies(roster)).toBe(0);
  });
});

/* ───────────────────  Self-managed members (dance team)  ─────────────────── */
// A dance team's dancers are adults with NO family account: team-join writes the
// students row with `family_id: null`. countFamilies therefore returns 0 for a
// team — correct, but it is the wrong denominator for the coach's "Got it"
// readout, which needs the MEMBERS. These two functions partition the roster.

const MEMBER_A = "1c4f0a2e-7d4b-4c2c-9a1e-0c1f7b2b3d40";
const MEMBER_B = "2c4f0a2e-7d4b-4c2c-9a1e-0c1f7b2b3d41";

describe("selfManagedMemberIds — the roster's family-less adults", () => {
  it("returns the self-managed members of a dance team, and countFamilies stays 0", () => {
    const roster = buildRoster(
      [{ subject_id: MEMBER_A, division: null }, { subject_id: MEMBER_B, division: null }],
      [
        { student_id: MEMBER_A, display_name: "Avery", age_range: null, family_id: null },
        { student_id: MEMBER_B, display_name: "Blair", age_range: null, family_id: null },
      ],
    );
    expect(selfManagedMemberIds(roster).sort()).toEqual([MEMBER_A, MEMBER_B].sort());
    expect(countFamilies(roster)).toBe(0);
  });

  it("returns nothing for a studio roster where every dancer has a family", () => {
    const roster = buildRoster(
      [{ subject_id: STUDENT, division: null }],
      [{ student_id: STUDENT, display_name: "test", age_range: "7_9", family_id: FAMILY }],
    );
    expect(selfManagedMemberIds(roster)).toEqual([]);
    expect(countFamilies(roster)).toBe(1);
  });

  it("partitions a mixed roster: every dancer is counted exactly once", () => {
    const roster = buildRoster(
      [
        { subject_id: STUDENT, division: null },
        { subject_id: MEMBER_A, division: null },
      ],
      [
        { student_id: STUDENT, display_name: "test", age_range: "7_9", family_id: FAMILY },
        { student_id: MEMBER_A, display_name: "Avery", age_range: null, family_id: null },
      ],
    );
    expect(countFamilies(roster) + selfManagedMemberIds(roster).length).toBe(roster.length);
  });
});
