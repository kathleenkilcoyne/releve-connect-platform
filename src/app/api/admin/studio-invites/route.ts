// Admin — create (or resend) a Founding Studio invitation.
//
// POST /api/admin/studio-invites   body: { email }
//   • Generates a secure token and the ONE empty employer_profiles row (status
//     'invited', unowned) this invite binds to.
//   • Re-inviting the same email REUSES its existing invite + profile (idempotent,
//     and doubles as "resend") rather than minting a duplicate.
//   • Sends the invitation email (Resend pipeline) with the secure setup link.
//
// POST /api/admin/studio-invites   body: { email, employer_id }
//   • ATTACH mode (2026-09-06, Manhattan Dance Team pilot) — targets an
//     ALREADY-EXISTING, ALREADY-CREATED org (e.g. one populated ahead of the
//     coach ever signing in) instead of minting a new one. Refuses if that org
//     already has an owner — this never reassigns a claimed org. Redirects the
//     org's existing unclaimed invite to the given email (regenerating the
//     token) if one exists, or creates the missing invite row if it somehow
//     doesn't — either way, exactly one founding_studio_invites row per
//     unclaimed org, pointed at the given email. org_type/member_label are read
//     from the EXISTING org row, never re-guessed from form input, so the email
//     copy can never mismatch what the org actually is.
//
// Gated on a signed-in admin (lib/admin-auth). Writes via the service role —
// founding_studio_invites is default-deny to every user, and the invited profile
// has no owner yet.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSiteUrl } from "@/lib/email/send";
import { sendStudioInvitation } from "@/lib/notifications";
import { isTeamType } from "@/lib/studio/team-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * ATTACH mode: point (or repoint) an invitation at an org that already exists
 * — e.g. Manhattan University Dance Team, populated ahead of Madeline ever
 * signing in. Never creates a second employer_profiles row for the same org,
 * and never touches an org that already has an owner.
 */
async function attachInviteToExistingOrg(
  employerId: string,
  email: string,
  createdBy: string,
): Promise<NextResponse> {
  const db = createAdminClient();

  const { data: orgRow, error: orgErr } = await db
    .from("employer_profiles")
    .select("employer_id, owner_user_id, org_type, member_label")
    .eq("employer_id", employerId)
    .maybeSingle();
  if (orgErr) {
    return NextResponse.json({ error: `Could not load the org: ${orgErr.message}` }, { status: 500 });
  }
  const org = orgRow as
    | { employer_id: string; owner_user_id: string | null; org_type: string | null; member_label: string | null }
    | null;
  if (!org) {
    return NextResponse.json({ error: "No org exists with that id." }, { status: 404 });
  }
  if (org.owner_user_id) {
    return NextResponse.json(
      { error: "This org already has an owner — an invitation can't reassign it. Use a different flow if the owner needs to change." },
      { status: 409 },
    );
  }

  // A different email is already using this exact address for ANOTHER org's
  // invite — the table's unique index is on lower(email), so this must be
  // resolved by hand rather than silently stealing that other invite.
  const { data: emailCollision } = await db
    .from("founding_studio_invites")
    .select("invite_id, employer_id")
    .ilike("email", email)
    .maybeSingle();
  const collision = emailCollision as { invite_id: string; employer_id: string } | null;
  if (collision && collision.employer_id !== employerId) {
    return NextResponse.json(
      { error: `${email} is already the invited email for a different org. Change that org's invite first, or use a different email here.` },
      { status: 409 },
    );
  }

  const { data: existingInviteRow } = await db
    .from("founding_studio_invites")
    .select("invite_id, token, redeemed_by")
    .eq("employer_id", employerId)
    .maybeSingle();
  const existingInvite = existingInviteRow as
    | { invite_id: string; token: string; redeemed_by: string | null }
    | null;

  // Defensive: owner_user_id and the invite's redeemed_by are set together in
  // bindInvite(), so an unclaimed org (checked above) should never have a
  // claimed invite — but never silently overwrite one if it somehow does.
  if (existingInvite?.redeemed_by) {
    return NextResponse.json(
      { error: "This org's invitation is already marked claimed. Please check its owner before retrying." },
      { status: 409 },
    );
  }

  let token: string;
  let inviteId: string;
  const resent = Boolean(existingInvite);

  if (existingInvite) {
    // Redirect the existing unclaimed invite to the new email; regenerate the
    // token so a copy of the old link (if it ever leaked) stops working.
    token = randomBytes(32).toString("base64url");
    const { error: updErr } = await db
      .from("founding_studio_invites")
      .update({ email, token })
      .eq("invite_id", existingInvite.invite_id);
    if (updErr) {
      return NextResponse.json({ error: `Could not update the invitation: ${updErr.message}` }, { status: 500 });
    }
    inviteId = existingInvite.invite_id;
  } else {
    token = randomBytes(32).toString("base64url");
    const { data: inviteRow, error: inviteErr } = await db
      .from("founding_studio_invites")
      .insert({ email, token, employer_id: employerId, status: "invited", created_by: createdBy })
      .select("invite_id")
      .single();
    if (inviteErr || !inviteRow) {
      return NextResponse.json(
        { error: `Could not create the invitation: ${inviteErr?.message ?? "unknown error"}` },
        { status: 500 },
      );
    }
    inviteId = (inviteRow as { invite_id: string }).invite_id;
  }

  const setupUrl = `${emailSiteUrl()}/studio/setup?token=${token}`;
  // Read org_type/member_label from the EXISTING org, never from the caller —
  // this path is for an org that already knows what it is.
  const send = await sendStudioInvitation({
    to: email,
    setupUrl,
    orgType: org.org_type,
    memberLabel: org.member_label,
  });

  return NextResponse.json({
    ok: true,
    resent,
    invite_id: inviteId,
    employer_id: employerId,
    setup_url: setupUrl,
    email_sent: send?.sent ?? null,
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  let body: {
    email?: string;
    org_type?: string;
    team_type?: string;
    member_label?: string | null;
    org_name?: string | null;
    employer_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }

  const targetEmployerId = String(body.employer_id ?? "").trim() || null;
  if (targetEmployerId) {
    return attachInviteToExistingOrg(targetEmployerId, email, gate.userId);
  }

  // A studio (default) or a dance team. Both onboard through the same owner-invite
  // flow; org_type just relabels and drives the adult-join path. A dance team also
  // carries a display-only team_type and an optional member_label.
  const orgType = body.org_type === "dance_team" ? "dance_team" : "studio";
  const teamType = orgType === "dance_team" && isTeamType(body.team_type) ? body.team_type : null;
  const memberLabel =
    orgType === "dance_team"
      ? (String(body.member_label ?? "").trim() || null)
      : null;
  // Optional — when Kathleen already knows the org's name at invite time (e.g.
  // "Manhattan College Dance Team"), it's carried straight into the profile so
  // the invitee's setup form is pre-filled and never blank. Previously this had
  // no field at all, so every invite created an empty `name` (required NOT NULL
  // column) that only got filled if/when the invitee typed it in themselves.
  const orgName = String(body.org_name ?? "").trim() || null;

  const db = createAdminClient();

  // Re-invite? Reuse the existing invite + its profile (also serves as "resend").
  const { data: existingRow } = await db
    .from("founding_studio_invites")
    .select("invite_id, token, employer_id")
    .ilike("email", email)
    .maybeSingle();
  const existing = existingRow as
    | { invite_id: string; token: string; employer_id: string }
    | null;

  let token: string;
  let employerId: string;
  let inviteId: string;
  let resent = false;

  if (existing) {
    token = existing.token;
    employerId = existing.employer_id;
    inviteId = existing.invite_id;
    resent = true;
  } else {
    // The empty studio profile this invite creates (rule 6). No owner yet — it's
    // claimed when the invited email signs in. `name` is NOT NULL, so seed it
    // blank; the studio fills it (required) during setup.
    const { data: profRow, error: profErr } = await db
      .from("employer_profiles")
      .insert({
        owner_user_id: null,
        name: orgName ?? "",
        status: "invited",
        org_type: orgType,
        team_type: teamType,
        member_label: memberLabel,
      })
      .select("employer_id")
      .single();
    if (profErr || !profRow) {
      return NextResponse.json(
        { error: `Could not create the studio profile: ${profErr?.message ?? "unknown error"}` },
        { status: 500 },
      );
    }
    employerId = (profRow as { employer_id: string }).employer_id;

    token = randomBytes(32).toString("base64url");
    const { data: inviteRow, error: inviteErr } = await db
      .from("founding_studio_invites")
      .insert({ email, token, employer_id: employerId, status: "invited", created_by: gate.userId })
      .select("invite_id")
      .single();
    if (inviteErr || !inviteRow) {
      return NextResponse.json(
        { error: `Could not create the invitation: ${inviteErr?.message ?? "unknown error"}` },
        { status: 500 },
      );
    }
    inviteId = (inviteRow as { invite_id: string }).invite_id;
  }

  const setupUrl = `${emailSiteUrl()}/studio/setup?token=${token}`;
  const send = await sendStudioInvitation({ to: email, setupUrl, orgType, memberLabel });

  return NextResponse.json({
    ok: true,
    resent,
    invite_id: inviteId,
    employer_id: employerId,
    setup_url: setupUrl,
    email_sent: send?.sent ?? null,
  });
}
