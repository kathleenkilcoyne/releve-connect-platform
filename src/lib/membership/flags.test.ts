// The rollout flag must default OFF, so merging Slice 2 changes nothing in
// production until it is deliberately enabled.

import { afterEach, describe, expect, it } from "vitest";

import { isProfessionalActivationEnabled } from "./flags";

const PREV = process.env.PROFESSIONAL_ACTIVATION_ENABLED;

describe("isProfessionalActivationEnabled — default OFF", () => {
  afterEach(() => {
    if (PREV === undefined) delete process.env.PROFESSIONAL_ACTIVATION_ENABLED;
    else process.env.PROFESSIONAL_ACTIVATION_ENABLED = PREV;
  });

  it("is false when unset", () => {
    delete process.env.PROFESSIONAL_ACTIVATION_ENABLED;
    expect(isProfessionalActivationEnabled()).toBe(false);
  });

  it("is true ONLY for exactly 'true'", () => {
    process.env.PROFESSIONAL_ACTIVATION_ENABLED = "true";
    expect(isProfessionalActivationEnabled()).toBe(true);
    process.env.PROFESSIONAL_ACTIVATION_ENABLED = "1";
    expect(isProfessionalActivationEnabled()).toBe(false);
    process.env.PROFESSIONAL_ACTIVATION_ENABLED = "TRUE";
    expect(isProfessionalActivationEnabled()).toBe(false);
  });
});
