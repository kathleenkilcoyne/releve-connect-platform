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

import { sendStudioLive } from "./notifications";

beforeEach(() => {
  sendEmail.mockClear();
  process.env.NEXT_PUBLIC_SITE_URL = "https://releveconnect.com";
});

describe("sendStudioLive — studio-live.v2 next-steps list", () => {
  it("Dance Team: invites members by their own label, links to /studio/schedule three times, never 'manage'", async () => {
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
    expect(msg.text).toContain("Invite your dancers: https://releveconnect.com/studio/schedule");
    expect(msg.text).toContain("Build This Week: https://releveconnect.com/studio/schedule");
    expect(msg.text).toContain("Open your team dashboard: https://releveconnect.com/studio/schedule");
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
    expect(msg.text).toContain("Invite your team members: https://releveconnect.com/studio/schedule");
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
