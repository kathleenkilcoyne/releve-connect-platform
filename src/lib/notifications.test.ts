import { beforeEach, describe, expect, it, vi } from "vitest";

// Real `body()`/`emailSiteUrl()` run unmocked — only `sendEmail` is replaced,
// so we can inspect the exact composed subject/text without ever hitting
// Resend (matching `src/app/apply/actions.test.ts`'s vi.hoisted/vi.mock style).
const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true, id: "test" }),
}));
vi.mock("./email/send", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./email/send")>();
  return { ...actual, sendEmail };
});

import { sendStudioLive, sendFoundingProfessionalInvitation } from "./notifications";

beforeEach(() => {
  sendEmail.mockClear();
  process.env.NEXT_PUBLIC_SITE_URL = "https://releveconnect.com";
});

describe("sendStudioLive — studio-live.v2 next-steps list", () => {
  it("Dance Team: walks the coach through dashboard → Team Join Code → share → build This Week, in order, never 'manage'", async () => {
    await sendStudioLive({
      to: "madeline@example.edu",
      studioName: "Manhattan University Dance Team",
      profileUrl: "https://releveconnect.com/studios/manhattan-university-dance-team",
      orgType: "dance_team",
      memberLabel: "Dancers",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [msg] = sendEmail.mock.calls[0];
    expect(msg.template).toBe("studio-live.v2");
    expect(msg.subject).toBe("Manhattan University Dance Team is live on Relevé");
    expect(msg.text).toContain(
      "Your team page: https://releveconnect.com/studios/manhattan-university-dance-team",
    );
    expect(msg.text).toContain("1. Open your team dashboard: https://releveconnect.com/studio/schedule");
    expect(msg.text).toContain("2. Generate your Team Join Code");
    expect(msg.text).toContain("3. Share the code or link with your dancers");
    expect(msg.text).toContain("4. Build This Week");
    // The four steps stay in that order.
    const steps = ["1. Open your team dashboard", "2. Generate your Team Join Code", "3. Share the code", "4. Build This Week"];
    const positions = steps.map((s) => msg.text.indexOf(s));
    expect(positions.every((p: number) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(msg.text).not.toMatch(/manage your team/i);
  });

  it("Dance Team: falls back to the default member label when none is set on the org", async () => {
    await sendStudioLive({
      to: "director@example.com",
      studioName: "Example Dance Team",
      profileUrl: "https://releveconnect.com/studios/example-dance-team",
      orgType: "dance_team",
      memberLabel: null,
    });

    const [msg] = sendEmail.mock.calls[0];
    expect(msg.text).toContain("Share the code or link with your team members");
  });

  it("Studio: builds This Week and opens the dashboard, with no invite line and no 'manage' wording", async () => {
    await sendStudioLive({
      to: "owner@example.com",
      studioName: "Example Studio",
      profileUrl: "https://releveconnect.com/studios/example-studio",
      orgType: "studio",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [msg] = sendEmail.mock.calls[0];
    expect(msg.template).toBe("studio-live.v2");
    expect(msg.text).toContain("Your studio page: https://releveconnect.com/studios/example-studio");
    expect(msg.text).toContain("Build This Week: https://releveconnect.com/studio/schedule");
    expect(msg.text).toContain("Open your studio dashboard: https://releveconnect.com/studio/schedule");
    expect(msg.text).not.toMatch(/invite/i);
    expect(msg.text).not.toMatch(/manage your studio/i);
  });
});

describe("sendStudioLive — returns sendEmail's SendResult (2026-09-06 diagnostic)", () => {
  const input = {
    to: "madeline@example.edu",
    studioName: "Example Dance Team",
    profileUrl: "https://releveconnect.com/studios/example-dance-team",
    orgType: "dance_team",
  };

  it("returns the exact success result sendEmail produced, including its message id", async () => {
    sendEmail.mockResolvedValueOnce({ sent: true, id: "resend-msg-123" });

    const result = await sendStudioLive(input);

    expect(result).toEqual({ sent: true, id: "resend-msg-123" });
  });

  it("returns the exact failure result sendEmail produced — not_configured", async () => {
    sendEmail.mockResolvedValueOnce({ sent: false, reason: "not_configured" });

    const result = await sendStudioLive(input);

    expect(result).toEqual({ sent: false, reason: "not_configured" });
  });

  it("returns the exact failure result sendEmail produced — vendor rejection", async () => {
    sendEmail.mockResolvedValueOnce({ sent: false, reason: "rejected", detail: "HTTP 401" });

    const result = await sendStudioLive(input);

    expect(result).toEqual({ sent: false, reason: "rejected", detail: "HTTP 401" });
  });

  it("returns the exact failure result sendEmail produced — network/send error", async () => {
    sendEmail.mockResolvedValueOnce({ sent: false, reason: "error", detail: "fetch failed" });

    const result = await sendStudioLive(input);

    expect(result).toEqual({ sent: false, reason: "error", detail: "fetch failed" });
  });
});

describe("sendFoundingProfessionalInvitation — warm, personal copy (2026-09-07 revision)", () => {
  it("sends Kathleen's exact wording, carrying the exact link it was given", async () => {
    await sendFoundingProfessionalInvitation({
      to: "founder@example.com",
      inviteLink: "https://releveconnect.com/login?next=%2Fprofile%2Fedit&email=founder%40example.com",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [msg] = sendEmail.mock.calls[0];
    expect(msg.to).toBe("founder@example.com");
    expect(msg.template).toBe("founding-professional-invitation.v1");
    expect(msg.subject).toBe("You're invited to Relevé Connect as a Founding Professional");
    expect(msg.text).toContain(
      "You're invited to join Relevé Connect as one of our Founding Professionals.",
    );
    expect(msg.text).toContain(
      "I'm bringing together a small group of respected people across the dance industry",
    );
    expect(msg.text).toContain("Your membership is complimentary. There is no application or payment required.");
    expect(msg.text).toContain("Build your Relevé profile here:");
    expect(msg.text).toContain(
      "https://releveconnect.com/login?next=%2Fprofile%2Fedit&email=founder%40example.com",
    );
    expect(msg.text).toContain("Sign in using this email address.");
    expect(msg.text).toContain(
      "Once published, your profile will carry the Founding Professional designation and Verified Member badge.",
    );
  });

  it("is warmer/first-person now, by design, but still signed only 'Relevé Connect' — never a named admin", async () => {
    await sendFoundingProfessionalInvitation({
      to: "founder@example.com",
      inviteLink: "https://releveconnect.com/login?next=%2Fprofile%2Fedit&email=founder%40example.com",
    });

    const [msg] = sendEmail.mock.calls[0];
    expect(msg.text).toMatch(/\bI['’]m\b/); // deliberately personal voice now
    expect(msg.text).not.toMatch(/with love and respect/i);
    expect(msg.text).not.toMatch(/,\s*Kathleen\s*$/im);
    // Exactly one sign-off — the copy must not repeat its own closing line on
    // top of the shared body() signature (that would read as a duplicate).
    // "Relevé Connect" itself appears twice by design (once mid-copy, once in
    // the signature); "together we rise" is signature-only, so it's the
    // reliable signal that there's exactly one close, not two.
    const signOffCount = (msg.text.match(/together we rise/gi) ?? []).length;
    expect(signOffCount).toBe(1);
  });

  it("returns the exact SendResult sendEmail produced, unmodified", async () => {
    sendEmail.mockResolvedValueOnce({ sent: false, reason: "rejected", detail: "HTTP 403" });

    const result = await sendFoundingProfessionalInvitation({
      to: "founder@example.com",
      inviteLink: "https://releveconnect.com/login?next=%2Fprofile%2Fedit&email=founder%40example.com",
    });

    expect(result).toEqual({ sent: false, reason: "rejected", detail: "HTTP 403" });
  });
});
