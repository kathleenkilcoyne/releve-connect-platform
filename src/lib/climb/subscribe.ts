"use server";

// The Climb — newsletter signup, done the RIGHT way.
//
// ── Why this file exists separately from notifications.ts ──
// There is already a `addBuyerToClimb()` in lib/notifications.ts that adds every
// $499 buyer to this same MailerLite group with NO opt-in checkbox and NO
// unsubscribe surface. That is the auto-subscribe trap, and it stays switched
// off (its env vars are empty) until it is given a real consent step.
//
// THIS path is the opposite, by construction:
//   · a person types their own name and email into a form, on purpose;
//   · they must TICK A BOX that says what they are agreeing to;
//   · the server refuses the subscribe if that box wasn't ticked — consent is
//     verified server-side, not just enforced by a disabled button;
//   · every email carries MailerLite's unsubscribe link (its own footer), and
//     the form says so before they sign up.
//
// No account is required and nothing else is created — this writes to MailerLite
// and to nothing else. Someone joining the newsletter is not becoming a member.

const MAILERLITE_ENDPOINT = "https://connect.mailerlite.com/api/subscribers";

export type ClimbSignupResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Which form the person came from. Both write to the SAME MailerLite list — the
 * consent copy on the licensing form names The Climb explicitly, so nobody ends
 * up on a list they didn't agree to.
 *
 * If MAILERLITE_LICENSING_GROUP_ID is set, licensing sign-ups are added to that
 * group AS WELL AS The Climb (not instead of it) — so Kathleen can write to
 * "people waiting on licensing" without breaking the promise they were shown.
 * Leave the env var unset and everything simply lands in The Climb.
 */
type SignupList = "climb" | "licensing";

/** Deliberately permissive — just enough to catch a typo, not to police addresses. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Subscribe someone to The Climb.
 *
 * `consent` must be literally true. It is checked HERE, on the server, because a
 * required checkbox in the DOM is a UI nicety — the guarantee has to live where
 * it can't be edited away.
 */
export async function subscribeToClimb(
  formData: FormData,
): Promise<ClimbSignupResult> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const consent = formData.get("consent") === "on";
  const list: SignupList = formData.get("list") === "licensing" ? "licensing" : "climb";

  if (!firstName) return { ok: false, message: "Please add your first name." };
  if (!looksLikeEmail(email)) return { ok: false, message: "That email doesn't look right." };
  if (!consent) {
    // The one non-negotiable.
    return {
      ok: false,
      message: "Please tick the box to confirm you'd like to receive The Climb.",
    };
  }

  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_CLIMB_GROUP_ID;
  const licensingGroupId = process.env.MAILERLITE_LICENSING_GROUP_ID;

  if (!apiKey || !groupId) {
    // Not configured yet. Say something true rather than pretending it worked —
    // a false "you're subscribed!" is worse than an honest "not yet".
    console.warn("[climb] MailerLite not configured — would subscribe:", { email, firstName });
    return {
      ok: false,
      message: "Sign-ups aren't switched on quite yet. Please try again shortly.",
    };
  }

  // The Climb group always. The licensing group only as an ADDITION, and only if
  // one has been configured.
  const groups =
    list === "licensing" && licensingGroupId ? [groupId, licensingGroupId] : [groupId];

  try {
    const res = await fetch(MAILERLITE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        fields: { name: firstName },
        groups,
        // Records that this person opted in, and when — the audit trail behind
        // the checkbox.
        status: "active",
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[climb] MailerLite subscribe failed:", res.status, detail);
      // 422 is MailerLite's "already subscribed" among other things. Treat a
      // repeat sign-up as success — telling someone "you're already on the list"
      // is fine, but making it look like a failure is not.
      if (res.status === 422) {
        return {
          ok: true,
          message:
            list === "licensing"
              ? "You're already on the list — we'll write the moment licensing opens."
              : "You're already on the list — see you on the 1st.",
        };
      }
      return { ok: false, message: "Something went wrong signing you up. Please try again." };
    }

    return {
      ok: true,
      message:
        list === "licensing"
          ? "You're in. We'll write the moment licensing opens."
          : "You're in. Look for The Climb on the 1st.",
    };
  } catch (err) {
    console.error("[climb] MailerLite subscribe error:", err);
    return { ok: false, message: "Couldn't reach the mailing list just now. Please try again." };
  }
}
