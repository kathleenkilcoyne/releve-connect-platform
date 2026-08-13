// Membership family / role mapping — the definition that decides who follows the
// Professional activation track. Professional is EXPLICIT talent roles; a studio
// owner who also teaches is a professional (membership follows the role used);
// studio-only stays untouched by the professional change.

import { describe, expect, it } from "vitest";

import {
  isApprovedNotActivated,
  isProfessionalApplicant,
  isStudioOnlyApplicant,
  membershipFamilyForApplicant,
} from "./families";

describe("isProfessionalApplicant — defined by talent roles", () => {
  it("true for any talent role, incl. a studio owner who also teaches", () => {
    expect(isProfessionalApplicant(["teacher"])).toBe(true);
    expect(isProfessionalApplicant(["choreographer"])).toBe(true);
    expect(isProfessionalApplicant(["working_dancer"])).toBe(true);
    expect(isProfessionalApplicant(["studio_owner", "teacher"])).toBe(true);
  });
  it("false for studio-only, empty, or null", () => {
    expect(isProfessionalApplicant(["studio_owner"])).toBe(false);
    expect(isProfessionalApplicant([])).toBe(false);
    expect(isProfessionalApplicant(null)).toBe(false);
    expect(isProfessionalApplicant(undefined)).toBe(false);
  });
});

describe("isStudioOnlyApplicant — the untouched case", () => {
  it("true ONLY for studio_owner with no talent role", () => {
    expect(isStudioOnlyApplicant(["studio_owner"])).toBe(true);
    expect(isStudioOnlyApplicant(["studio_owner", "teacher"])).toBe(false);
    expect(isStudioOnlyApplicant(["teacher"])).toBe(false);
    expect(isStudioOnlyApplicant([])).toBe(false);
  });
});

describe("membershipFamilyForApplicant — the role decides the family", () => {
  it("professional wins when a talent role is present", () => {
    expect(membershipFamilyForApplicant(["studio_owner", "teacher"])).toBe("professional");
    expect(membershipFamilyForApplicant(["choreographer"])).toBe("professional");
  });
  it("studio for studio_owner only", () => {
    expect(membershipFamilyForApplicant(["studio_owner"])).toBe("studio");
  });
  it("null when neither applies", () => {
    expect(membershipFamilyForApplicant([])).toBeNull();
    expect(membershipFamilyForApplicant(null)).toBeNull();
  });
});

describe("isApprovedNotActivated", () => {
  it("true when approved but no active access", () => {
    expect(isApprovedNotActivated({ isApproved: true, hasActiveAccess: false })).toBe(true);
  });
  it("false otherwise", () => {
    expect(isApprovedNotActivated({ isApproved: true, hasActiveAccess: true })).toBe(false);
    expect(isApprovedNotActivated({ isApproved: false, hasActiveAccess: false })).toBe(false);
  });
});
