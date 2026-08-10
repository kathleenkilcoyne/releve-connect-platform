// Slice 0 — the adult-to-adult safety wall, proven at the primitive level.
//
// The wall's whole job: a professional or a studio may participate in the
// discovery/messaging graph; a family guardian or a student's user may NOT. These
// tests pin that semantics on the pure classifier (the app mirror of the SQL
// `is_professional_actor()` the database enforces).

import { describe, expect, it } from "vitest";

import { classifyActor } from "./actor";

describe("classifyActor — who may enter the professional graph", () => {
  it("a professional (talent profile) IS an actor", () => {
    const c = classifyActor({ hasTalentProfile: true, ownsEmployer: false });
    expect(c).toEqual({ isProfessional: true, isStudio: false, isActor: true });
  });

  it("a studio/employer IS an actor", () => {
    const c = classifyActor({ hasTalentProfile: false, ownsEmployer: true });
    expect(c).toEqual({ isProfessional: false, isStudio: true, isActor: true });
  });

  it("a multi-role person (professional AND studio owner) IS an actor", () => {
    const c = classifyActor({ hasTalentProfile: true, ownsEmployer: true });
    expect(c.isActor).toBe(true);
  });

  it("a family guardian / student user (NEITHER) is NOT an actor — the wall", () => {
    // A guardian owns a family_account and holds guardianships, but has no
    // talent_profiles and no employer_profiles → not a participant. Likewise a
    // self-managed college-team adult is a `students` row, not a talent profile.
    const c = classifyActor({ hasTalentProfile: false, ownsEmployer: false });
    expect(c).toEqual({ isProfessional: false, isStudio: false, isActor: false });
  });
});
