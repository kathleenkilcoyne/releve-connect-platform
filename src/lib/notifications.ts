// Outbound side-effects for the Signature Experience — email + MailerLite.
//
// These are deliberately SEAMS, not finished integrations, because two decisions
// are still open (see DECISIONS.md):
//   • Email vendor is undecided (Resend vs Postmark) — EMAIL_API_KEY unset.
//   • MailerLite ("The Climb") key/group aren't wired yet.
//
// So each function does the real thing IF configured, and otherwise logs exactly
// what it *would* send and returns quietly. That keeps the payment webhook
// reliable (a missing email vendor must never fail a paid purchase) while making
// the pending work obvious. Every email here is registered in EMAILS.md first
// (Guardrail #5 — no hidden triggers).

type BuyerConfirmationInput = {
  to: string;
  workTitle: string;
  experienceUrl: string; // the gated page they now have access to
  founderWelcomeUrl: string | null;
  checkinUrl: string | null;
};

/**
 * EMAILS.md #9 — "Signature Experience — access & booking links".
 * Fires once from the checkout.session.completed webhook. One email to the buyer.
 */
export async function sendBuyerExperienceConfirmation(
  input: BuyerConfirmationInput,
): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;

  if (!apiKey || !from) {
    console.warn(
      "[notifications] Email vendor not configured (EMAIL_API_KEY / EMAIL_FROM_ADDRESS). " +
        "Would send Signature Experience confirmation:",
      {
        to: input.to,
        subject: `Your Signature Experience — ${input.workTitle}`,
        access: input.experienceUrl,
        welcome: input.founderWelcomeUrl,
        checkin: input.checkinUrl,
      },
    );
    return;
  }

  // TODO(email-vendor): once Resend/Postmark is chosen, send the templated,
  // versioned email here (single sender, per EMAILS.md). Intentionally not
  // guessing the vendor SDK before the decision is made.
  console.warn(
    "[notifications] Email vendor selected but sender not yet implemented — " +
      "add the Resend/Postmark call in sendBuyerExperienceConfirmation.",
    { to: input.to },
  );
}

/**
 * Add the buyer to the MailerLite "The Climb" group. Best-effort: never throws
 * into the webhook. No-op (with a log) until the key + group id are set.
 */
export async function addBuyerToClimb(email: string): Promise<void> {
  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_CLIMB_GROUP_ID;

  if (!apiKey || !groupId) {
    console.warn(
      "[notifications] MailerLite not configured — would add buyer to The Climb:",
      email,
    );
    return;
  }

  try {
    const res = await fetch(
      `https://connect.mailerlite.com/api/subscribers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ email, groups: [groupId] }),
      },
    );
    if (!res.ok) {
      console.error("[notifications] MailerLite add failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[notifications] MailerLite add threw (ignored):", err);
  }
}

/** Booking links surfaced after purchase (env-configured; null when unset). */
export function bookingLinks() {
  return {
    founderWelcomeUrl: process.env.FOUNDER_WELCOME_BOOKING_URL || null,
    checkinUrl: process.env.DEFAULT_CHECKIN_BOOKING_URL || null,
  };
}
