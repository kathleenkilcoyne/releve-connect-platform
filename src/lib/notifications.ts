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

// ===========================================================================
// The vetting gate — the ONLY two automatic emails on the apply flow
// (EMAILS.md #1 + #2, Guardrail #5). Both fire once, from the fee-paid webhook
// branch. Approval / more-info / decline emails (#4/#5/#6) are MANUAL-only and
// are sent from the admin actions, not here.
// ===========================================================================

/**
 * EMAILS.md #1 — "Application received (confirmation)". One email to the
 * applicant once their $30 application fee is paid (or waived) and the
 * application enters review. Copy MUST lead with "credited toward your
 * membership / refunded if not accepted" — never "you paid $30" (pricing SSOT).
 */
export async function sendApplicationReceived(input: {
  to: string;
  firstName: string | null;
  feeWaived: boolean;
}): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  const hello = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const feeLine = input.feeWaived
    ? "As a Founding honoree, your application fee is waived."
    : "Your $30 is held as a commitment and credited in full toward your membership when you're accepted — or refunded if you're not accepted.";

  if (!apiKey || !from) {
    console.warn("[notifications] Email vendor not configured — would send Application received:", {
      to: input.to,
      subject: "We've received your Relevé application",
      body: { hello, feeLine },
    });
    return;
  }
  // TODO(email-vendor=Resend): send the templated, versioned email here.
  console.warn("[notifications] Resend chosen but sender not yet implemented — sendApplicationReceived.", {
    to: input.to,
  });
}

/**
 * EMAILS.md #2 — "New application alert". One internal email to the admin
 * (ADMIN_ALERT_EMAIL) on the same event as #1.
 */
export async function sendAdminNewApplicationAlert(input: {
  applicantEmail: string;
  applicantName: string | null;
  roles: string[];
  reviewUrl: string;
}): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  const to = process.env.ADMIN_ALERT_EMAIL;

  if (!apiKey || !from || !to) {
    console.warn("[notifications] Email vendor/admin address not configured — would send New application alert:", {
      to: to ?? "(ADMIN_ALERT_EMAIL unset)",
      subject: `New Relevé application — ${input.applicantName ?? input.applicantEmail}`,
      body: { from: input.applicantEmail, roles: input.roles, review: input.reviewUrl },
    });
    return;
  }
  // TODO(email-vendor=Resend): send the templated, versioned email here.
  console.warn("[notifications] Resend chosen but sender not yet implemented — sendAdminNewApplicationAlert.", {
    to,
  });
}

// ===========================================================================
// The vetting gate — the MANUAL decision emails (#4/#5/#6). These NEVER fire
// automatically: they are sent only when the admin clicks Approve / Request
// info / Decline (EMAILS.md). Each also fires the matching MailerLite tag so
// the right lifecycle sequence can pick it up.
// ===========================================================================

/**
 * Fire a MailerLite tag/group for a lifecycle moment (approved / declined / …).
 * Best-effort seam: no-op with a log until MAILERLITE_API_KEY + a tag→group map
 * are wired. Never throws into an admin action.
 */
export async function fireMailerLiteTag(email: string, tag: string): Promise<void> {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    console.warn(`[notifications] MailerLite not configured — would tag ${email} as "${tag}".`);
    return;
  }
  // TODO(mailerlite): map `tag` → a group id and POST the subscriber into it.
  console.warn(`[notifications] MailerLite tag seam — would tag ${email} as "${tag}".`);
}

/** EMAILS.md #4 — "Approved — next step is payment". MANUAL (admin clicks Approve). */
export async function sendApplicationApproved(input: {
  to: string;
  firstName: string | null;
  tierLabel: string | null; // e.g. "Established" for a choreographer; null otherwise
}): Promise<void> {
  const ready = process.env.EMAIL_API_KEY && process.env.EMAIL_FROM_ADDRESS;
  if (!ready) {
    console.warn("[notifications] Would send Application APPROVED:", {
      to: input.to,
      subject: "You're in — welcome to Relevé",
      tier: input.tierLabel,
      next: "activate membership (Professional $149)",
    });
    return;
  }
  console.warn("[notifications] Resend chosen but sender not yet implemented — sendApplicationApproved.", { to: input.to });
}

/** EMAILS.md #5 — "Request more information". MANUAL. */
export async function sendApplicationMoreInfo(input: {
  to: string;
  firstName: string | null;
  note: string | null;
}): Promise<void> {
  const ready = process.env.EMAIL_API_KEY && process.env.EMAIL_FROM_ADDRESS;
  if (!ready) {
    console.warn("[notifications] Would send Application MORE-INFO:", {
      to: input.to,
      subject: "One more thing on your Relevé application",
      note: input.note,
    });
    return;
  }
  console.warn("[notifications] Resend chosen but sender not yet implemented — sendApplicationMoreInfo.", { to: input.to });
}

/** EMAILS.md #6 — "Application declined" ("not now" framing). MANUAL. */
export async function sendApplicationDeclined(input: {
  to: string;
  firstName: string | null;
  refunded: boolean;
}): Promise<void> {
  const ready = process.env.EMAIL_API_KEY && process.env.EMAIL_FROM_ADDRESS;
  if (!ready) {
    console.warn("[notifications] Would send Application DECLINED (not now):", {
      to: input.to,
      subject: "An update on your Relevé application",
      refunded: input.refunded, // the $30 is refunded in full when not accepted
    });
    return;
  }
  console.warn("[notifications] Resend chosen but sender not yet implemented — sendApplicationDeclined.", { to: input.to });
}

// ===========================================================================
// Membership lifecycle emails.
// ===========================================================================

/** EMAILS.md #7 — "Membership active — you're live". Fires from the webhook when a subscription is paid. */
export async function sendMembershipActive(input: {
  to: string;
  tierLabel: string;
  priceLabel: string; // e.g. "$149/year"
  manageUrl: string;
}): Promise<void> {
  const ready = process.env.EMAIL_API_KEY && process.env.EMAIL_FROM_ADDRESS;
  if (!ready) {
    console.warn("[notifications] Would send Membership ACTIVE:", {
      to: input.to,
      subject: `Your Relevé ${input.tierLabel} membership is live`,
      renews: `${input.priceLabel}, auto-renews annually — cancel anytime: ${input.manageUrl}`,
    });
    return;
  }
  console.warn("[notifications] Resend chosen but sender not yet implemented — sendMembershipActive.", { to: input.to });
}

/**
 * EMAILS.md #10 — "Membership renewal reminder". Fires from the Stripe
 * `invoice.upcoming` webhook (~2 weeks before the annual charge; the exact lead
 * time is set in Stripe → Billing → "Upcoming invoice" events).
 */
export async function sendRenewalReminder(input: {
  to: string;
  amountLabel: string; // e.g. "$149.00"
  renewalDate: string; // human date
  manageUrl: string;
}): Promise<void> {
  const ready = process.env.EMAIL_API_KEY && process.env.EMAIL_FROM_ADDRESS;
  if (!ready) {
    console.warn("[notifications] Would send Membership RENEWAL REMINDER:", {
      to: input.to,
      subject: "Your Relevé membership renews soon",
      body: `We'll charge ${input.amountLabel} on ${input.renewalDate}. Manage or cancel anytime: ${input.manageUrl}`,
    });
    return;
  }
  console.warn("[notifications] Resend chosen but sender not yet implemented — sendRenewalReminder.", { to: input.to });
}

/** Booking links surfaced after purchase (env-configured; null when unset). */
export function bookingLinks() {
  return {
    founderWelcomeUrl: process.env.FOUNDER_WELCOME_BOOKING_URL || null,
    checkinUrl: process.env.DEFAULT_CHECKIN_BOOKING_URL || null,
  };
}
