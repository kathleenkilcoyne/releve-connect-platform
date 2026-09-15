// Dance team — invite adult members by email, using the team's EXISTING join
// code. This route mints NOTHING: /api/studio/schedule/team-code stays the
// only place a code is created or replaced; if the team has none yet, this
// route refuses and the page's existing "Generate team join code" step is
// what the coach uses first.
//
// POST /api/studio/schedule/team-invite   body: { addresses: string }
//
// Gated by requireStudioAccess — employer_id comes from the CALLER'S OWN
// session, never the request body, so a coach can only ever resolve and send
// their own team's code. One email per address (Resend, via
// sendTeamInviteEmail — EMAILS.md #17); a bad or bouncing address is reported
// per-address and never fails the rest of the batch.
//
// No schema changes: no invite tracking table, no pending/accepted state, no
// resend/revoke. This is a one-shot send, same as copying the link by hand.

import { NextResponse } from "next/server";
import { requireStudioAccess } from "@/lib/studio/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseInviteAddresses, resolveCoachName } from "@/lib/studio/team-invite";
import { memberLabelOf } from "@/lib/studio/team-types";
import { sendTeamInviteEmail } from "@/lib/notifications";
import { emailSiteUrl } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ADDRESSES = 50;

type Body = { addresses?: string };

type ResultRow = { email: string; ok: boolean; error?: string };

export async function POST(req: Request) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const raw = String(body.addresses ?? "");

  const db = createAdminClient();

  // Only a dance team invites this way — studios use the family code instead.
  const { data: prof, error: profErr } = await db
    .from("employer_profiles")
    .select("name, org_type, member_label, artistic_director")
    .eq("employer_id", gate.employerId)
    .maybeSingle();
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
  const p = prof as
    | { name: string | null; org_type: string; member_label: string | null; artistic_director: string[] | null }
    | null;
  if (!p) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  if (p.org_type !== "dance_team") {
    return NextResponse.json({ error: "Email invitations are for dance teams." }, { status: 400 });
  }

  // The team's OWN active code — resolved from the session, the same lookup
  // page.tsx uses. A code from another org can never reach this route.
  const { data: codeRow, error: codeErr } = await db
    .from("studio_invites")
    .select("code")
    .eq("employer_id", gate.employerId)
    .eq("kind", "team")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (codeErr) return NextResponse.json({ error: codeErr.message }, { status: 500 });
  const code = (codeRow as { code: string } | null)?.code ?? null;
  if (!code) {
    return NextResponse.json(
      { error: "Generate a team join code first — there isn't one to send yet." },
      { status: 400 },
    );
  }

  const { valid, invalid } = parseInviteAddresses(raw);
  const total = valid.length + invalid.length;
  if (total === 0) {
    return NextResponse.json({ error: "Enter at least one email address." }, { status: 400 });
  }
  if (total > MAX_ADDRESSES) {
    return NextResponse.json(
      { error: `You can invite up to ${MAX_ADDRESSES} addresses at a time — you supplied ${total}.` },
      { status: 400 },
    );
  }

  const { data: userRow } = await db
    .from("users")
    .select("display_name")
    .eq("user_id", gate.userId)
    .maybeSingle();

  const teamName = p.name?.trim() || "Your team";
  const coachName = resolveCoachName({
    artisticDirector: p.artistic_director,
    displayName: (userRow as { display_name: string | null } | null)?.display_name,
    teamName,
  });
  const memberLabel = memberLabelOf(p.member_label);
  const joinLink = `${emailSiteUrl()}/team-join?code=${encodeURIComponent(code)}`;

  const results: ResultRow[] = invalid.map((token) => ({
    email: token,
    ok: false,
    error: "Not a valid email address.",
  }));

  // Sequential, not Promise.all — a batch of up to 50 to one vendor is kinder
  // sent one at a time, and partial failure (per-address, below) already
  // means order/speed here isn't load-bearing.
  for (const email of valid) {
    const send = await sendTeamInviteEmail({ to: email, coachName, teamName, memberLabel, joinLink });
    results.push({
      email,
      ok: send.sent,
      ...(send.sent
        ? {}
        : {
            error:
              send.reason === "not_configured"
                ? "Email sending isn't configured yet."
                : "Could not send — please try again.",
          }),
    });
  }

  return NextResponse.json({ ok: true, results });
}
