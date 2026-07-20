// The one place Relevé actually sends email.
//
// Vendor: Resend (ratified 2026-07-11). Called over plain `fetch` rather than the
// `resend` npm package — the REST call is three lines, and keeping it dependency-
// free means the vendor can be swapped by editing this file alone. Every caller
// goes through `sendEmail`, so there is exactly one outbound path to audit.
//
// ── Two properties this module must never lose ──
//
// 1. IT NEVER THROWS. These sends happen inside Stripe webhooks and admin
//    actions. A bounced email must never fail a paid webhook (Stripe would retry
//    the whole fulfilment) or blow up an admin click. Every failure is caught,
//    logged, and reported in the return value for the caller to ignore or act on.
//
// 2. IT NEVER GOES QUIET. When the vendor is unconfigured it logs the FULL
//    message it would have sent. The previous seam logged less once the env vars
//    were set than before, which meant configuring email reduced observability.
//    Here, configured or not, you can always see what was meant to go out.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. Always required — it is the accessible, deliverable form. */
  text: string;
  /** Optional HTML. When omitted the text body is sent on its own. */
  html?: string;
  /** Template identity for the log + EMAILS.md register, e.g. "application-received.v1". */
  template: string;
  replyTo?: string;
}

export type SendResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: "not_configured" | "rejected" | "error"; detail?: string };

/**
 * Send one transactional email. Returns a result; never throws.
 *
 * `EMAIL_API_KEY` + `EMAIL_FROM_ADDRESS` must both be set for anything to leave
 * the building. Until then this is a loud no-op.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;

  if (!apiKey || !from) {
    console.warn(
      `[email] NOT CONFIGURED (set EMAIL_API_KEY + EMAIL_FROM_ADDRESS). Would have sent "${message.template}":`,
      { to: message.to, subject: message.subject, text: message.text },
    );
    return { sent: false, reason: "not_configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        tags: [{ name: "template", value: message.template.replace(/[^a-zA-Z0-9_-]/g, "_") }],
      }),
    });

    if (!res.ok) {
      // Read the body for the log — a 4xx from Resend is nearly always an
      // unverified sending domain or a malformed address, and the message says which.
      const detail = await res.text().catch(() => "(no body)");
      console.error(
        `[email] REJECTED "${message.template}" to ${message.to} — HTTP ${res.status}: ${detail}`,
      );
      return { sent: false, reason: "rejected", detail: `HTTP ${res.status}` };
    }

    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    console.info(`[email] sent "${message.template}" to ${message.to} (${body?.id ?? "no id"})`);
    return { sent: true, id: body?.id ?? null };
  } catch (err) {
    // Network failure, DNS, timeout. Logged, swallowed — see property 1 above.
    console.error(`[email] ERROR sending "${message.template}" to ${message.to}:`, err);
    return { sent: false, reason: "error", detail: (err as Error).message };
  }
}

/** Absolute URL for links inside emails. Mirrors the Stripe siteUrl() helper. */
export function emailSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Shared plain-text signature. Kept in one place so the sign-off, and the
 * brand line, cannot drift between templates.
 */
export const SIGNATURE = `
—
Relevé Connect
together we rise · nous nous levons · relevé
`.trim();

/** Compose a body with the standard signature appended. */
export function body(...paragraphs: string[]): string {
  return [...paragraphs, "", SIGNATURE].join("\n\n").trim();
}
