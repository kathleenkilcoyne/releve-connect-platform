// Outbound side-effects — the transactional emails, and the MailerLite seams.
//
// Every email Relevé sends is defined here and registered in EMAILS.md first
// (Guardrail #5 — no hidden triggers). The actual delivery happens in one place,
// `lib/email/send.ts`, which never throws: a missing or failing email vendor must
// never fail a paid Stripe webhook or an admin action.
//
// Templates carry a version in their id ("application-received.v1"). Bump the
// version when the copy materially changes, so logs and Resend tags stay
// meaningful.
//
// ⚠️ FREE FOUNDING PERIOD (launch decision, 2026-07-20): the $30 application fee
// is switched OFF. Copy that referenced it is now behind `feeNote`, which the
// live flow leaves undefined. The fee wording is preserved in APPLICATION_FEE_NOTE
// for when payment is switched back on — do not delete it.

import { body, emailSiteUrl, sendEmail } from "./email/send";

/**
 * The ONLY approved wording for the $30 fee (pricing SSOT + CLAUDE.md §4G):
 * always lead with credited/refunded, never "pay $30 to apply". Unused during
 * the free founding period; kept so the rule survives the gap.
 */
export const APPLICATION_FEE_NOTE =
  "Your $30 is held as a commitment and credited in full toward your membership " +
  "when you're accepted — or refunded if you're not accepted.";

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
  const links = [
    `View your experience: ${input.experienceUrl}`,
    input.founderWelcomeUrl ? `Book your welcome call: ${input.founderWelcomeUrl}` : null,
    input.checkinUrl ? `Book your check-in: ${input.checkinUrl}` : null,
  ].filter(Boolean) as string[];

  await sendEmail({
    to: input.to,
    template: "buyer-experience-confirmation.v1",
    subject: `Your Signature Experience — ${input.workTitle}`,
    text: body(
      "Thank you — your Signature Experience is confirmed.",
      `You now have access to “${input.workTitle}”.`,
      links.join("\n"),
      "An account has been created for you with this email address. Sign in any " +
        `time at ${emailSiteUrl()}/login to return to your experience.`,
    ),
  });
}

/**
 * Add the buyer to the MailerLite "The Climb" group.
 *
 * ⚠️ OPEN DECISION — this subscribes a buyer to a MARKETING list with no opt-in
 * checkbox anywhere in the purchase flow, and no unsubscribe surface in the app.
 * It is inert only because MAILERLITE_API_KEY / MAILERLITE_CLIMB_GROUP_ID are
 * unset. Setting those env vars turns it on for every buyer — get an explicit
 * consent decision (and add an opt-in) BEFORE doing so. See EMAILS.md, which
 * states "no newsletter auto-subscribe".
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
    const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, groups: [groupId] }),
    });
    if (!res.ok) {
      console.error("[notifications] MailerLite subscribe failed:", res.status);
    }
  } catch (err) {
    console.error("[notifications] MailerLite subscribe error:", err);
  }
}

// ===========================================================================
// The vetting gate — the ONLY two automatic emails on the apply flow
// (EMAILS.md #1 + #2, Guardrail #5). During the free founding period both fire
// once from submitApplication; when the $30 fee is switched back on they move
// back to the fee-paid webhook branch. Approval / more-info / decline emails
// (#4/#5/#6) are MANUAL-only and are sent from the admin actions.
// ===========================================================================

/**
 * EMAILS.md #1 — "Application received (confirmation)". One email to the
 * applicant when their application enters review.
 *
 * `feeNote` is the fee wording when a fee applies. Leave it undefined during the
 * free founding period; pass APPLICATION_FEE_NOTE (or the waived line) when the
 * fee is switched back on.
 */
export async function sendApplicationReceived(input: {
  to: string;
  firstName: string | null;
  feeNote?: string | null;
}): Promise<void> {
  const hello = input.firstName ? `Hi ${input.firstName},` : "Hi,";

  await sendEmail({
    to: input.to,
    template: "application-received.v2",
    subject: "We've received your Relevé application",
    text: body(
      hello,
      "Thank you for applying to Relevé Connect. Your application is in review.",
      "Every application is read by a person, not a filter. We'll be in touch " +
        "once it has been reviewed — there's nothing else you need to do right now.",
      ...(input.feeNote ? [input.feeNote] : []),
      "If anything in your application changes in the meantime, just reply to this email.",
    ),
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
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    console.warn(
      "[notifications] ADMIN_ALERT_EMAIL unset — nobody will be told this application arrived:",
      { applicant: input.applicantEmail, roles: input.roles },
    );
    return;
  }

  await sendEmail({
    to,
    template: "admin-new-application.v1",
    replyTo: input.applicantEmail,
    subject: `New Relevé application — ${input.applicantName ?? input.applicantEmail}`,
    text: body(
      `${input.applicantName ?? "A new applicant"} has applied.`,
      [
        `Email: ${input.applicantEmail}`,
        `Roles: ${input.roles.length ? input.roles.join(", ") : "(none given)"}`,
      ].join("\n"),
      `Review it here: ${input.reviewUrl}`,
    ),
  });
}

// ===========================================================================
// The vetting gate — the MANUAL decision emails (#4/#5/#6). These NEVER fire
// automatically: they are sent only when the admin clicks Approve / Request
// info / Decline.
// ===========================================================================

/**
 * Fire a MailerLite tag/group for a lifecycle moment (approved / declined / …).
 * Still a seam: no tag→group map exists yet. Never throws into an admin action.
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

/**
 * EMAILS.md #4 — "Approved — welcome". MANUAL (admin clicks Approve).
 *
 * FREE FOUNDING PERIOD: approval now grants a complimentary founding membership
 * outright, so this is a welcome email, not a "next step is payment" email.
 */
export async function sendApplicationApproved(input: {
  to: string;
  firstName: string | null;
  tierLabel: string | null; // e.g. "Established" for a choreographer; null otherwise
  /** Set when a complimentary founding membership was granted. */
  foundingUntil?: string | null;
}): Promise<void> {
  const hello = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const site = emailSiteUrl();

  const foundingLine = input.foundingUntil
    ? `As a founding member, your membership is complimentary for your first year — through ${input.foundingUntil}. ` +
      "There's nothing to pay and nothing to enter."
    : null;

  await sendEmail({
    to: input.to,
    template: "application-approved.v2",
    subject: "You're in — welcome to Relevé",
    text: body(
      hello,
      "You've been accepted to Relevé Connect. Welcome.",
      ...(foundingLine ? [foundingLine] : []),
      ...(input.tierLabel
        ? [`Your choreographer standing has been set to ${input.tierLabel}.`]
        : []),
      `Start here — build your profile: ${site}/profile/edit`,
      "Your profile is the product. The fuller it is, the more findable you are.",
    ),
  });
}

/** EMAILS.md #5 — "Request more information". MANUAL. */
export async function sendApplicationMoreInfo(input: {
  to: string;
  firstName: string | null;
  note: string | null;
}): Promise<void> {
  const hello = input.firstName ? `Hi ${input.firstName},` : "Hi,";

  await sendEmail({
    to: input.to,
    template: "application-more-info.v1",
    subject: "One more thing on your Relevé application",
    text: body(
      hello,
      "Thanks for your application — we'd like a little more before we finish reviewing it.",
      ...(input.note ? [input.note] : ["Just reply to this email and we'll pick it up from there."]),
      "Your application stays open in the meantime.",
    ),
  });
}

/** EMAILS.md #6 — "Application declined" ("not now" framing). MANUAL. */
export async function sendApplicationDeclined(input: {
  to: string;
  firstName: string | null;
  refunded: boolean;
}): Promise<void> {
  const hello = input.firstName ? `Hi ${input.firstName},` : "Hi,";

  await sendEmail({
    to: input.to,
    template: "application-declined.v1",
    subject: "An update on your Relevé application",
    text: body(
      hello,
      "Thank you for applying to Relevé Connect. We're not able to move forward " +
        "with your application at this time.",
      "This is a not-right-now, not a judgment of your work. The industry changes, " +
        "and so do careers — you're welcome to apply again.",
      ...(input.refunded
        ? ["Your $30 application fee has been refunded in full — allow a few days for it to appear."]
        : []),
    ),
  });
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
  await sendEmail({
    to: input.to,
    template: "membership-active.v1",
    subject: `Your Relevé ${input.tierLabel} membership is live`,
    text: body(
      `Your ${input.tierLabel} membership is active.`,
      `${input.priceLabel}, renewing annually. You can manage or cancel it any ` +
        `time here: ${input.manageUrl}`,
      `Build or update your profile: ${emailSiteUrl()}/profile/edit`,
    ),
  });
}

/**
 * EMAILS.md #10 — "Membership renewal reminder". Fires from the Stripe
 * `invoice.upcoming` webhook (~2 weeks before the annual charge).
 */
export async function sendRenewalReminder(input: {
  to: string;
  amountLabel: string; // e.g. "$149.00"
  renewalDate: string; // human date
  manageUrl: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    template: "membership-renewal-reminder.v1",
    subject: "Your Relevé membership renews soon",
    text: body(
      `This is a heads-up that your Relevé membership renews on ${input.renewalDate}.`,
      `We'll charge ${input.amountLabel} to the card on file.`,
      `Manage or cancel any time: ${input.manageUrl}`,
    ),
  });
}

// ===========================================================================
// The Roster hiring rail.
// ===========================================================================

/**
 * EMAILS.md #8 — "New intro request". ONE email to the talent, on an explicit
 * user action. No contact details are revealed (Open Decision 2: private by
 * default) — the recipient signs in to see and answer it.
 */
export async function sendIntroRequestNotification(input: {
  to: string;
  talentName: string;
  requesterName: string;
  profileSlug: string;
}): Promise<void> {
  const site = emailSiteUrl();

  await sendEmail({
    to: input.to,
    template: "intro-request.v1",
    subject: "Someone wants to connect with you on Relevé",
    text: body(
      `Hi ${input.talentName},`,
      `${input.requesterName} sent you an intro request on Relevé.`,
      `Sign in to read it and respond: ${site}/profile/requests`,
      "Your contact details stay private — nothing is shared unless you choose to reply.",
    ),
  });
}

/** Booking links surfaced after purchase (env-configured; null when unset). */
export function bookingLinks() {
  return {
    founderWelcomeUrl: process.env.FOUNDER_WELCOME_BOOKING_URL || null,
    checkinUrl: process.env.DEFAULT_CHECKIN_BOOKING_URL || null,
  };
}
