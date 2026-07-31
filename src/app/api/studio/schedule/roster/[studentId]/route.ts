// Studio self-serve — set one dancer's Age Division for the caller's OWN studio.
//
// PATCH /api/studio/schedule/roster/<studentId>   body: { division: string | null }
//
// The division is the STUDIO's classification of that dancer (Junior / Teen /
// Senior…) and lives on the studio-scoped affiliations row — never on the
// family-owned students record. Gated to the studio's own owner/staff; the studio
// id comes from the session, and the write is scoped to (this studio, this
// dancer), so a studio can only ever classify its own affiliated dancers.

import { NextResponse } from "next/server";
import { requireStudioAccess } from "@/lib/studio/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidDivision } from "@/lib/studio/divisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ studentId: string }> }) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;
  const { studentId } = await ctx.params;

  let body: { division?: string | null };
  try {
    body = (await req.json()) as { division?: string | null };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  // Empty/absent clears the division; otherwise it must be one of the picklist.
  const raw = (body.division ?? "").trim();
  const division = raw === "" ? null : raw;
  if (division !== null && !isValidDivision(division)) {
    return NextResponse.json({ error: "That isn't a valid division." }, { status: 400 });
  }

  const db = createAdminClient();

  // Scope the write to this studio's own affiliation with this dancer.
  const { data, error } = await db
    .from("affiliations")
    .update({ division })
    .eq("employer_id", gate.employerId)
    .eq("subject_kind", "student")
    .eq("subject_id", studentId)
    .select("affiliation_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || (data as unknown[]).length === 0) {
    return NextResponse.json({ error: "That dancer isn't on your roster." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, division });
}
