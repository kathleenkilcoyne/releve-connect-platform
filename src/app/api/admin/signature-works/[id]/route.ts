// Admin — update a signature_work. Used mainly to publish / unpublish, but also
// accepts field edits.
//
// PATCH /api/admin/signature-works/<id>
//   body: partial of the same fields as create, e.g. { status: 'published' }

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE = [
  "title",
  "style",
  "length_label",
  "level",
  "built_for",
  "price_cents",
  "vimeo_performance_url",
  "vimeo_breakdown_url",
  "count_sheet_url",
  "music_note",
  "artistic_intent",
  "status",
] as const;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = requireAdmin(req);
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  // Only allow known columns through.
  const update: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in body) update[key] = body[key];
  }
  if (update.status && update.status !== "draft" && update.status !== "published") {
    return NextResponse.json({ error: "status must be draft or published." }, { status: 400 });
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const db = createAdminClient();
  const { error } = await db.from("signature_works").update(update).eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `Could not update the work: ${error.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
