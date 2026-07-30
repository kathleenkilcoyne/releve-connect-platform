// Admin — generate / regenerate a FAMILY join code for one studio (Brick B1).
//
// Concierge only: the ADMIN mints the code that a studio hands to its competition
// families. The code is a row in the EXISTING family `studio_invites` table,
// validated exactly as-is by /join (joinThroughStudio). This route only CREATES
// codes — it never changes /join, and it never touches `founding_studio_invites`
// (that is the separate studio-OWNER onboarding invite).
//
// POST /api/admin/studios/<employerId>/family-code
//   body: { action: "generate" | "regenerate" }
//     generate   → if an active code already exists, return it unchanged (never
//                  spawn a duplicate); otherwise mint one.
//     regenerate → deliberately replace: disable the existing active code(s),
//                  then mint a fresh one. The old code stops working at once.

import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: "generate" | "regenerate" };

// Human-typeable alphabet: no I/O/L/0/1, so a code is unambiguous read aloud,
// over the phone, or hand-typed by a parent.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomChars(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** A short alpha prefix from the studio name, e.g. "Tate Academy" → "TATE". */
function prefixFrom(name: string | null): string {
  const letters = (name ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  const p = letters.slice(0, 4);
  return p.length >= 2 ? p : "TEAM";
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const action = body.action ?? "generate";
  if (action !== "generate" && action !== "regenerate") {
    return NextResponse.json({ error: "action must be 'generate' or 'regenerate'." }, { status: 400 });
  }

  const db = createAdminClient();

  // The studio must exist.
  const { data: prof, error: profErr } = await db
    .from("employer_profiles")
    .select("employer_id, name")
    .eq("employer_id", id)
    .maybeSingle();
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
  if (!prof) return NextResponse.json({ error: "Studio not found." }, { status: 404 });
  const studioName = (prof as { name: string | null }).name;

  // Existing active code(s) for THIS studio.
  const { data: activeRows, error: activeErr } = await db
    .from("studio_invites")
    .select("invite_id, code")
    .eq("employer_id", id)
    .eq("status", "active");
  if (activeErr) return NextResponse.json({ error: activeErr.message }, { status: 500 });
  const active = (activeRows ?? []) as Array<{ invite_id: string; code: string }>;

  // generate is a no-op when a code already exists — never spawn a duplicate.
  if (action === "generate" && active.length > 0) {
    return NextResponse.json({ ok: true, code: active[0].code, reused: true });
  }

  // regenerate: retire the current active code(s) first, deliberately, so a
  // studio can never be left with two live codes.
  if (action === "regenerate" && active.length > 0) {
    const { error: disErr } = await db
      .from("studio_invites")
      .update({ status: "disabled" })
      .eq("employer_id", id)
      .eq("status", "active");
    if (disErr) return NextResponse.json({ error: disErr.message }, { status: 500 });
  }

  // Mint a globally-unique code. There is no DB unique index on `code` (the table
  // is reused as-is), so we check for a clash and retry. /join matches the code
  // case-insensitively, so uniqueness is checked the same way.
  const prefix = prefixFrom(studioName);
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
    return NextResponse.json(
      { error: "Could not mint a unique code — please try again." },
      { status: 500 },
    );
  }

  const { error: insErr } = await db.from("studio_invites").insert({
    employer_id: id,
    code,
    label: "Family join code",
    status: "active",
    max_uses: null, // unlimited for the pilot — a family is never turned away mid-code
    use_count: 0,
    // expires_at left open (null) per spec.
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, code, reused: false });
}
