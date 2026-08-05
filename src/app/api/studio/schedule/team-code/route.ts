// Dance team — the Team Director mints/regenerates their TEAM join code.
//
// POST /api/studio/schedule/team-code   body: { action: "generate" | "regenerate" }
//
// A team code is a studio_invites row with kind = 'team' for THIS team — kept
// SEPARATE from family codes (kind = 'family'): a team code is redeemed only via
// the adult dance-team pathway (/team-join), never at the family /join. The Team
// Director shares it with adult members. Gated to the caller's own team
// (requireStudioAccess), and only a dance-team employer may mint one.
//
// This creates NO students / guardianship / family / talent_profile / Swing rows —
// it is only a code.

import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { requireStudioAccess } from "@/lib/studio/access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: "generate" | "regenerate" };

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/O/L/0/1

function randomChars(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

function prefixFrom(name: string | null): string {
  const letters = (name ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  const p = letters.slice(0, 4);
  return p.length >= 2 ? p : "TEAM";
}

export async function POST(req: Request) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const action = body.action ?? "generate";
  if (action !== "generate" && action !== "regenerate") {
    return NextResponse.json({ error: "action must be 'generate' or 'regenerate'." }, { status: 400 });
  }

  const db = createAdminClient();

  // Only a dance team mints team codes (studios use family codes).
  const { data: prof, error: profErr } = await db
    .from("employer_profiles")
    .select("employer_id, name, org_type")
    .eq("employer_id", gate.employerId)
    .maybeSingle();
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
  if (!prof) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  const p = prof as { name: string | null; org_type: string };
  if (p.org_type !== "dance_team") {
    return NextResponse.json({ error: "Team join codes are for dance teams." }, { status: 400 });
  }

  // Existing active TEAM code(s) for this team.
  const { data: activeRows, error: activeErr } = await db
    .from("studio_invites")
    .select("invite_id, code")
    .eq("employer_id", gate.employerId)
    .eq("kind", "team")
    .eq("status", "active");
  if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 500 });
  const active = (activeRows ?? []) as Array<{ invite_id: string; code: string }>;

  if (action === "generate" && active.length > 0) {
    return NextResponse.json({ ok: true, code: active[0].code, reused: true });
  }
  if (action === "regenerate" && active.length > 0) {
    const { error: disErr } = await db
      .from("studio_invites")
      .update({ status: "disabled" })
      .eq("employer_id", gate.employerId)
      .eq("kind", "team")
      .eq("status", "active");
    if (disErr) return NextResponse.json({ error: disErr.message }, { status: 500 });
  }

  // Mint a unique, human-typeable code. No DB unique index on `code`, so check +
  // retry (case-insensitive, matching how the join path compares).
  const prefix = prefixFrom(p.name);
  let code = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = `${prefix}-${randomChars(4)}`;
    const { data: clash, error: clashErr } = await db
      .from("studio_invites")
      .select("invite_id")
      .ilike("code", candidate)
      .maybeSingle();
    if (clashErr) return NextResponse.json({ error: clashErr.message }, { status: 500 });
    if (!clash) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    return NextResponse.json({ error: "Could not mint a unique code — please try again." }, { status: 500 });
  }

  const { error: insErr } = await db.from("studio_invites").insert({
    employer_id: gate.employerId,
    code,
    label: "Team join code",
    kind: "team",
    status: "active",
    max_uses: null,
    use_count: 0,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, code, reused: false });
}
