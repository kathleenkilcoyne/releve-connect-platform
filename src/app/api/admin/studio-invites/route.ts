// Admin — create (or resend) a Founding Studio invitation.
//
// POST /api/admin/studio-invites   body: { email }
//   • Generates a secure token and the ONE empty employer_profiles row (status
//     'invited', unowned) this invite binds to.
//   • Re-inviting the same email REUSES its existing invite + profile (idempotent,
//     and doubles as "resend") rather than minting a duplicate.
//   • Sends the invitation email (Resend pipeline) with the secure setup link.
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

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  let body: { email?: string; org_type?: string; team_type?: string; member_label?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
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
        name: "",
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
