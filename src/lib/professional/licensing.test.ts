// Licensing — the status lifecycle is the load-bearing rule (only approved work
// is public; artists can't publish themselves; admins move works through states).
// These pin the pure machine so a UI change can never quietly loosen it.

import { describe, expect, it } from "vitest";

import {
  adminTransition,
  artistTransition,
  canArtistEdit,
  canArtistSubmit,
  canArtistWithdraw,
  isAdminActionable,
  isPubliclyVisible,
  workTypeLabel,
  WORK_STATUS_LABEL,
  type WorkStatus,
} from "./licensing";

const ALL_STATUSES: WorkStatus[] = [
  "draft",
  "submitted",
  "in_review",
  "returned",
  "approved",
  "declined",
];

describe("isPubliclyVisible — only approved is public", () => {
  it("is true ONLY for approved", () => {
    for (const s of ALL_STATUSES) {
      expect(isPubliclyVisible(s)).toBe(s === "approved");
    }
  });
});

describe("canArtistEdit — draft or returned only", () => {
  it("allows editing a draft or a returned work", () => {
    expect(canArtistEdit("draft")).toBe(true);
    expect(canArtistEdit("returned")).toBe(true);
  });
  it("locks a work once it's out of the artist's hands", () => {
    expect(canArtistEdit("submitted")).toBe(false);
    expect(canArtistEdit("in_review")).toBe(false);
    expect(canArtistEdit("approved")).toBe(false);
    expect(canArtistEdit("declined")).toBe(false);
  });
});

describe("artistTransition — the artist-side machine", () => {
  it("submits from draft and from returned", () => {
    expect(artistTransition("draft", "submit")).toBe("submitted");
    expect(artistTransition("returned", "submit")).toBe("submitted");
  });

  it("refuses to submit from any non-editable state", () => {
    for (const s of ["submitted", "in_review", "approved", "declined"] as WorkStatus[]) {
      expect(artistTransition(s, "submit")).toBeNull();
    }
  });

  it("withdraws only a submitted work back to draft", () => {
    expect(artistTransition("submitted", "withdraw")).toBe("draft");
    for (const s of ["draft", "in_review", "returned", "approved", "declined"] as WorkStatus[]) {
      expect(artistTransition(s, "withdraw")).toBeNull();
    }
  });

  it("an artist can NEVER reach approved on their own", () => {
    for (const s of ALL_STATUSES) {
      expect(artistTransition(s, "submit")).not.toBe("approved");
      expect(artistTransition(s, "withdraw")).not.toBe("approved");
    }
    expect(canArtistSubmit("approved")).toBe(false);
    expect(canArtistWithdraw("approved")).toBe(false);
  });
});

describe("adminTransition — the admin-side machine", () => {
  it("starts review only from submitted", () => {
    expect(adminTransition("submitted", "start_review")).toBe("in_review");
    for (const s of ["draft", "in_review", "returned", "approved", "declined"] as WorkStatus[]) {
      expect(adminTransition(s, "start_review")).toBeNull();
    }
  });

  it("approves / returns / declines from submitted or in_review", () => {
    for (const s of ["submitted", "in_review"] as WorkStatus[]) {
      expect(adminTransition(s, "approve")).toBe("approved");
      expect(adminTransition(s, "return")).toBe("returned");
      expect(adminTransition(s, "decline")).toBe("declined");
    }
  });

  it("cannot act on works that aren't in the queue", () => {
    for (const s of ["draft", "returned", "approved", "declined"] as WorkStatus[]) {
      expect(isAdminActionable(s)).toBe(false);
      expect(adminTransition(s, "approve")).toBeNull();
      expect(adminTransition(s, "return")).toBeNull();
      expect(adminTransition(s, "decline")).toBeNull();
    }
  });
});

describe("labels", () => {
  it("has a human label for every status", () => {
    for (const s of ALL_STATUSES) {
      expect(WORK_STATUS_LABEL[s]).toBeTruthy();
    }
    expect(WORK_STATUS_LABEL.returned).toBe("Returned for Changes");
  });

  it("humanizes work types and falls back to the raw value", () => {
    expect(workTypeLabel("duet_trio")).toBe("Duet / Trio");
    expect(workTypeLabel("musical_theatre")).toBe("Musical Theatre");
    expect(workTypeLabel("something_new")).toBe("something_new");
    expect(workTypeLabel(null)).toBeNull();
    expect(workTypeLabel("  ")).toBeNull();
  });
});
