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

import { body, emailSiteUrl, sendEmail, type SendResult } from "./email/send";
import { orgCopy } from "./studio/org-copy";
import { memberLabelOf } from "./studio/team-types";
import { dollars } from "./membership/tiers";

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

// ===========================================================================
// Professional Services transaction rail, Phase 1 (2026-09-01). Two confirmation
// emails from ONE booking payment — buyer and Professional each see only their
// own side of the money (the buyer's total, the Professional's own transfer —
// never the other party's number, and never Relevé's cut named as a line item
// to either party beyond what the buyer's own receipt already shows).
// ===========================================================================

/**
 * EMAILS.md #17 — "Booking confirmed" (buyer). Fires from the
 * checkout.session.completed webhook once a service booking is paid.
 */
export async function sendServiceBookingConfirmedToBuyer(input: {
  to: string;
  offeringTitle: string;
  professionalName: string;
  whenLabel: string;
  /** The Professional's stated price, in cents — what the buyer sees as "for". */
  amountCents: number;
  /** The Relevé booking fee, in cents — shown as its own line, per policy
   *  (never folded silently into the Professional's price). */
  feeCents: number;
  profileUrl: string;
}): Promise<void> {
  const total = input.amountCents + input.feeCents;
  await sendEmail({
    to: input.to,
    template: "service-booking-confirmed-buyer.v1",
    subject: `Booked — ${input.offeringTitle} with ${input.professionalName}`,
    text: body(
      `You're confirmed for "${input.offeringTitle}" with ${input.professionalName}.`,
      `When: ${input.whenLabel}`,
      `Charged: ${dollars(total)} (${dollars(input.amountCents)} + ${dollars(input.feeCents)} Relevé booking fee)`,
      `View ${input.professionalName}'s profile: ${input.profileUrl}`,
      "Need to reschedule or cancel? Reply to this email or reach out through Relevé.",
    ),
  });
}

/**
 * EMAILS.md #18 — "New booking" (Professional). Fires from the same webhook
 * event, to the Professional whose service was just booked and paid.
 */
export async function sendServiceBookingConfirmedToProfessional(input: {
  to: string;
  offeringTitle: string;
  whenLabel: string;
  buyerEmail: string;
  /** What settles to the Professional (their full stated price — Stripe's own
   *  processing fee comes out of this at settlement, per existing policy). */
  transferCents: number;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    template: "service-booking-confirmed-professional.v1",
    subject: `New booking — ${input.offeringTitle}`,
    text: body(
      `You have a new paid booking for "${input.offeringTitle}".`,
      `When: ${input.whenLabel}`,
      `Booked by: ${input.buyerEmail}`,
      `Your payout: ${dollars(input.transferCents)} (before Stripe's own processing fee).`,
      "Manage your bookings any time by signing in to Relevé.",
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

  await sendEmail({
    to: input.to,
    // v3 — Kathleen's wording, 2026-07-21. Note there is no invitation to reply:
    // this address is not monitored, and telling an applicant to "just reply"
    // sent their update into a void. Anything they need to change, they change
    // in the application itself while it is still a draft.
    template: "application-received.v3",
    subject: "We've received your Relevé application",
    text: body(
      input.firstName ? `Dear ${input.firstName},` : "Dear applicant,",
      "Your Relevé Connect application has been received. You can expect to hear back within 7 business days.",
      "Until then, know that your submission is a vote for the person you are, and the artist you are becoming.",
      ...(input.feeNote ? [input.feeNote] : []),
      "Together we rise.",
    ),
  });
}

/**
 * EMAILS.md #3 — "Save-and-resume link".
 *
 * Fires ONCE, the first time a draft is auto-saved — never again for that
 * application (the caller stamps `resume_email_sent_at` before sending). Autosave
 * runs every few seconds, so "once" is load-bearing, not a nicety.
 */
export async function sendApplicationResumeLink(input: {
  to: string;
  firstName: string | null;
  token: string;
  expiresInDays: number;
}): Promise<void> {
  const hello = input.firstName ? `Hi ${input.firstName},` : "Hi,";
  const link = `${emailSiteUrl()}/apply?resume=${encodeURIComponent(input.token)}`;

  await sendEmail({
    to: input.to,
    template: "application-resume-link.v1",
    subject: "Your Relevé application — saved, pick up any time",
    text: body(
      hello,
      "We've saved your application in progress, so you can stop and come back " +
        "to it. Nothing has been submitted yet.",
      `Pick up where you left off: ${link}`,
      `This link works for the next ${input.expiresInDays} days. You'll need to be ` +
        "signed in with this email address.",
      "We'll only send this once — your progress keeps saving automatically as you write.",
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
 * Welcomes the applicant onto the Professional Roster. Approval alone no longer
 * grants a complimentary membership (2026-08-23) — that is a separate, explicit
 * admin action ("grant_complimentary"), so `foundingUntil` is only ever passed
 * when that later action actually granted one.
 */
export async function sendApplicationApproved(input: {
  to: string;
  firstName: string | null;
  tierLabel: string | null; // e.g. "Established" for a choreographer; null otherwise
  /** Set only when a complimentary founding membership has ALREADY been granted. */
  foundingUntil?: string | null;
}): Promise<void> {
  const site = emailSiteUrl();

  // No end date, by design (2026-07-21). See the note in /subscribe.
  const foundingLine = input.foundingUntil
    ? "As a founding member, your membership is complimentary. There's nothing to pay and nothing to enter."
    : null;

  await sendEmail({
    to: input.to,
    // v3 — "Welcome BraveHeart", Kathleen's founder letter, verbatim. The letter
    // is the email; the practical lines follow it, separated, so the welcome is
    // never interrupted by housekeeping. A branded HTML version can be added
    // later without touching this text — it stays the plain-text part.
    template: "application-approved.v3",
    subject: "Welcome, BraveHeart",
    text: body(
      "My fellow brave heart,",
      "From the deepest part of me, thank you for joining Relevé. This is my labor of love — " +
        "built on thirty years inside this industry. I see you, I hear you, and I know that what " +
        "you have done — and what you will do — matters. Every step of your process holds value, " +
        "and every dream you chassé toward is just on the other side.",
      "We stand behind you, with you, and most importantly, for you. It is my intention that you " +
        "use this platform as an opportunity — and as a co-creator of our craft.",
      "At Relevé, this is not your rehearsal. This is your stage. Together, we rise.",
      "With loyalty, reverence, and respect,\nKathleen McAree\nFounder, Relevé Connect LLC",
      "—",
      ...(foundingLine ? [foundingLine] : []),
      ...(input.tierLabel
        ? [`Your choreographer standing has been set to ${input.tierLabel}.`]
        : []),
      // Membership is no longer guaranteed at approval time (2026-08-23) — only
      // link straight to the profile builder when it's actually open to them.
      // Otherwise send them to /subscribe, which explains exactly where they
      // stand and what happens next.
      input.foundingUntil
        ? `Start here — build your profile: ${site}/profile/edit`
        : `See where you stand: ${site}/subscribe`,
    ),
  });
}

/** EMAILS.md #5 — "Request more information". MANUAL. */
export async function sendApplicationMoreInfo(input: {
  to: string;
  firstName: string | null;
  note: string | null;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    // v2 — Kathleen's letter, verbatim. `note` is the {{requested_items}} slot:
    // whatever the reviewer typed in the admin console. If it is somehow empty
    // we fall back to a general ask rather than send a letter whose central
    // sentence — "we need a little more from you:" — is followed by nothing.
    template: "application-more-info.v2",
    subject: "A little more from you — your Relevé Connect application",
    text: body(
      input.firstName ? `Dear ${input.firstName},` : "Dear applicant,",
      "Thank you for applying to Relevé Connect. We've read your application, and we're glad you're here.",
      "Before we can move it forward, we need a little more from you:",
      input.note?.trim() ||
        "Could you tell us a little more about your experience and the work you've been doing?",
      "Once we have that, your application goes right back into active review. If anything is " +
        "unclear, just reply to this email — it reaches us directly.",
      "We're grateful you've stepped into this work with us.",
      "Together, we rise.\nThe Relevé Connect Team",
    ),
  });
}

/** EMAILS.md #6 — "Application declined" ("not now" framing). MANUAL. */
export async function sendApplicationDeclined(input: {
  to: string;
  firstName: string | null;
  refunded: boolean;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    // v2 — Kathleen's "not yet" letter, verbatim. This is the email most worth
    // getting right: it is the last thing a rejected applicant reads, and it
    // decides whether they ever come back.
    template: "application-declined.v2",
    subject: "Your Relevé Connect application",
    text: body(
      input.firstName ? `Dear ${input.firstName},` : "Dear applicant,",
      "Thank you for submitting your application to join Relevé Connect — and for the passion and " +
        "the work you shared with us.",
      "After careful review, we aren't able to move your application forward at this time. Please " +
        "know this reflects only where things stand in this moment — not your worth, and not your " +
        "potential.",
      'A "not yet" is never a "no." It\'s never about falling — we all do — it\'s about how we rise ' +
        "after the fall. We truly hope you'll build, grow, and reapply when the time feels right. " +
        "We would love to see you come through our doors again.",
      "Until then, stay steadfast — and keep dancing.",
      "Warmly,\nThe Relevé Connect Team",
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

// ===========================================================================
// The Studios path — "Become a Founding Studio" interest form.
// ===========================================================================

/**
 * EMAILS.md #11 — "New studio interest". ONE internal email to the admin
 * (ADMIN_ALERT_EMAIL) when a studio submits the founding-studio interest form.
 *
 * Studios are onboarded MANUALLY / white-glove in V1 — there is no self-serve
 * signup — so this alert IS the pipeline: it tells Kathleen a studio raised its
 * hand so she can reach out and onboard them personally. Best-effort like every
 * other send (sendEmail never throws), so a mail failure can't lose a submission
 * that is already saved to studio_interest.
 */
export async function sendStudioInterestAlert(input: {
  studioName: string;
  contactName: string;
  email: string;
  phone: string | null;
  location: string | null;
  studentCountLabel: string | null;
  message: string | null;
}): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    console.warn(
      "[notifications] ADMIN_ALERT_EMAIL unset — nobody will be told this studio is interested:",
      { studio: input.studioName, contact: input.email },
    );
    return;
  }

  await sendEmail({
    to,
    template: "studio-interest.v1",
    replyTo: input.email,
    subject: `New Founding Studio interest — ${input.studioName}`,
    text: body(
      `${input.contactName} from ${input.studioName} is interested in becoming a Founding Studio.`,
      [
        `Studio: ${input.studioName}`,
        `Contact: ${input.contactName}`,
        `Email: ${input.email}`,
        ...(input.phone ? [`Phone: ${input.phone}`] : []),
        ...(input.location ? [`Location: ${input.location}`] : []),
        ...(input.studentCountLabel ? [`Students: ${input.studentCountLabel}`] : []),
      ].join("\n"),
      ...(input.message ? [`Message:\n${input.message}`] : []),
      "Reach out to onboard them personally — there is no self-serve signup.",
    ),
  });
}

// ===========================================================================
// The Studios path — invite-only founding-studio onboarding
// (spec: STUDIO-ONBOARDING-ONE-FLOW-FROM-KATHLEEN.md). The interest form is
// retired; #11 above is historical. These are the live studio emails.
// ===========================================================================

/**
 * EMAILS.md #12 — "Founding Studio invitation" (studio) / "Dance Team
 * invitation" (dance_team). Sent when Kathleen creates an invitation in
 * /admin/studios. Carries the ONE secure setup link; the invited email signs
 * in (Email OTP) and lands directly in setup. Branches on `orgType` via the
 * SAME `orgCopy()` helper the setup page/editor already use (2026-08-28), so
 * studio and team wording can never drift from each other or from the rest of
 * the product. The studio copy below is BYTE-IDENTICAL to before this
 * branch — only the dance-team path is new.
 *
 * A dance-team invitation is a private invited pilot: it never mentions the
 * $30 application fee, the public Professional application, or any vetting
 * process — none of that applies to an org invite.
 */
export async function sendStudioInvitation(input: {
  to: string;
  setupUrl: string;
  orgType?: string | null;
  memberLabel?: string | null;
}): Promise<SendResult> {
  const copy = orgCopy(input.orgType);

  if (copy.isTeam) {
    const members = memberLabelOf(input.memberLabel).toLowerCase();
    return sendEmail({
      to: input.to,
      template: "dance-team-invitation.v1",
      subject: "You're invited to bring your Dance Team to Relevé",
      text: body(
        `You've been personally invited to Relevé Connect as your Dance Team's ${copy.owner}.`,
        `This link creates and claims your team's own Relevé page. From there, you'll build your ` +
          `team's Relevé page, add your team information and branding, and invite your ${members} to join.`,
        `Set up your team here — sign in with this email address (${input.to}) when asked:`,
        input.setupUrl,
        "This link is just for you. You can save your progress and come back any time; " +
          "nothing is public until you're ready.",
      ),
    });
  }

  return sendEmail({
    to: input.to,
    template: "studio-invitation.v1",
    subject: "You're invited to become a Relevé Founding Studio",
    text: body(
      "You've been personally invited to join Relevé Connect as a Founding Studio.",
      "Founding Studios help shape what Relevé becomes — a vetted roster of teachers " +
        "and choreographers to hire from, one calendar for your faculty and families, " +
        "and a hand to hold through setup.",
      `Set up your studio here — sign in with this email address (${input.to}) when asked:`,
      input.setupUrl,
      "This link is just for you. You can save your progress and come back any time; " +
        "nothing is public until we review it together.",
    ),
  });
}

/**
 * EMAILS.md #13 — "Studio submitted for review". ONE internal alert to the admin
 * (ADMIN_ALERT_EMAIL) when a studio flips its profile to `submitted`.
 */
export async function sendStudioSubmittedAlert(input: {
  studioName: string;
  contactEmail: string | null;
  reviewUrl: string;
}): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    console.warn(
      "[notifications] ADMIN_ALERT_EMAIL unset — nobody will be told this studio submitted:",
      { studio: input.studioName },
    );
    return;
  }
  await sendEmail({
    to,
    template: "studio-submitted.v1",
    ...(input.contactEmail ? { replyTo: input.contactEmail } : {}),
    subject: `Studio submitted for review — ${input.studioName}`,
    text: body(
      `${input.studioName} has finished its profile and submitted it for review.`,
      ...(input.contactEmail ? [`Contact: ${input.contactEmail}`] : []),
      `Review, approve, and publish it here: ${input.reviewUrl}`,
    ),
  });
}

/**
 * EMAILS.md #14 — "Your studio is live" (optional). Sent when Kathleen publishes
 * a studio (`approved` → `live`). Branches on `orgType` via the SAME `orgCopy()`
 * helper `sendStudioInvitation` above already uses (fix, 2026-09-01): this
 * template previously said "studio page" unconditionally, including to Dance
 * Teams — inconsistent with every other Dance-Team-reachable surface.
 */
export async function sendStudioLive(input: {
  to: string;
  studioName: string;
  profileUrl: string;
  orgType?: string | null;
}): Promise<void> {
  const { noun } = orgCopy(input.orgType);
  await sendEmail({
    to: input.to,
    template: "studio-live.v1",
    subject: `${input.studioName} is live on Relevé`,
    text: body(
      `Congratulations — ${input.studioName} is now live on Relevé Connect.`,
      `Your ${noun} page: ${input.profileUrl}`,
      "You can keep your details current any time by signing in with this email address.",
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

// ===========================================================================
// The onboarding gateway — Dance Team & Industry Partner inquiries.
// Both are short interest captures worked by hand later (like the studio path),
// so each fires exactly ONE internal admin alert and NO applicant email. The
// on-page confirmation is the applicant's acknowledgement.
// ===========================================================================

/** Human labels for the stored team_level slugs, for the alert body. */
const TEAM_LEVEL_LABELS: Record<string, string> = {
  middle_school: "Middle school",
  high_school: "High school",
  college: "College",
  professional: "Professional",
  independent: "Independent",
};

/**
 * EMAILS.md #15 — "New dance-team interest". ONE internal admin alert
 * (ADMIN_ALERT_EMAIL) when a Team Director submits the /welcome/team inquiry.
 * Best-effort like every send — the row is saved to team_interest regardless.
 */
export async function sendTeamInterestAlert(input: {
  teamName: string;
  schoolOrg: string | null;
  teamLevel: string | null;
  coachName: string | null;
  email: string;
  cityState: string | null;
  useCase: string | null;
  message: string | null;
}): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    console.warn(
      "[notifications] ADMIN_ALERT_EMAIL unset — nobody will be told this dance team is interested:",
      { team: input.teamName, contact: input.email },
    );
    return;
  }

  const level = input.teamLevel ? TEAM_LEVEL_LABELS[input.teamLevel] ?? input.teamLevel : null;

  await sendEmail({
    to,
    template: "team-interest.v1",
    replyTo: input.email,
    subject: `New dance-team interest — ${input.teamName}`,
    text: body(
      `${input.coachName ?? "A director"} is interested in bringing ${input.teamName} onto Relevé.`,
      [
        `Team: ${input.teamName}`,
        ...(input.schoolOrg ? [`School / org: ${input.schoolOrg}`] : []),
        ...(level ? [`Level: ${level}`] : []),
        ...(input.coachName ? [`Coach / director: ${input.coachName}`] : []),
        `Email: ${input.email}`,
        ...(input.cityState ? [`Location: ${input.cityState}`] : []),
      ].join("\n"),
      ...(input.useCase ? [`Wants to use Relevé for:\n${input.useCase}`] : []),
      ...(input.message ? [`Message:\n${input.message}`] : []),
      "Reach out to onboard them personally — there is no self-serve team signup yet.",
    ),
  });
}

/**
 * EMAILS.md #16 — "New industry-partner interest". ONE internal admin alert
 * (ADMIN_ALERT_EMAIL) when an organization submits the /welcome/partner inquiry.
 */
export async function sendPartnerInterestAlert(input: {
  orgName: string;
  orgType: string | null;
  contactName: string;
  contactTitle: string | null;
  websiteOrSocial: string | null;
  participation: string | null;
  message: string | null;
  email: string | null;
}): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to) {
    console.warn(
      "[notifications] ADMIN_ALERT_EMAIL unset — nobody will be told this partner is interested:",
      { org: input.orgName, contact: input.contactName },
    );
    return;
  }

  await sendEmail({
    to,
    template: "partner-interest.v1",
    ...(input.email ? { replyTo: input.email } : {}),
    subject: `New industry-partner interest — ${input.orgName}`,
    text: body(
      `${input.contactName}${input.contactTitle ? `, ${input.contactTitle},` : ""} from ${input.orgName} wants to partner with Relevé.`,
      [
        `Organization: ${input.orgName}`,
        ...(input.orgType ? [`Type: ${input.orgType}`] : []),
        `Contact: ${input.contactName}${input.contactTitle ? ` (${input.contactTitle})` : ""}`,
        ...(input.email ? [`Email: ${input.email}`] : []),
        ...(input.websiteOrSocial ? [`Website / social: ${input.websiteOrSocial}`] : []),
      ].join("\n"),
      ...(input.participation ? [`How they want to participate:\n${input.participation}`] : []),
      ...(input.message ? [`Message:\n${input.message}`] : []),
      "Reach out to talk through how to work together.",
    ),
  });
}
