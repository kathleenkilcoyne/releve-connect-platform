// Admin — create a signature_work (the $499 sellable piece).
//
// POST /api/admin/signature-works
//   body: { profileId, title, style?, length_label?, level?, built_for?,
//           price_cents?, vimeo_performance_url?, vimeo_breakdown_url?,
//           count_sheet_url?, music_note?, artistic_intent?, status? }
//
// Writes via the service role (RLS bypass) because there's no artist login yet.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SIGNATURE_PRICE_CENTS } from "@/lib/stripe/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  profileId?: string;
  title?: string;
  style?: string;
  length_label?: string;
  level?: string;
  built_for?: string;
  price_cents?: number;
  vimeo_performance_url?: string;
  vimeo_breakdown_url?: string;
  count_sheet_url?: string;
  music_note?: string;
  artistic_intent?: string;
  status?: "draft" | "published";
};

/** Empty string → null, so we don't store blanks. */
function clean(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (!body.profileId) {
    return NextResponse.json({ error: "Choose an artist (profileId)." }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }

  const status = body.status === "published" ? "published" : "draft";
  const price =
    typeof body.price_cents === "number" && body.price_cents > 0
      ? Math.round(body.price_cents)
      : SIGNATURE_PRICE_CENTS;

  const db = createAdminClient();
  const { data, error } = await db
    .from("signature_works")
    .insert({
      profile_id: body.profileId,
      title: body.title.trim(),
      style: clean(body.style),
      length_label: clean(body.length_label),
      level: clean(body.level),
      built_for: clean(body.built_for),
      price_cents: price,
      vimeo_performance_url: clean(body.vimeo_performance_url),
      vimeo_breakdown_url: clean(body.vimeo_breakdown_url),
      count_sheet_url: clean(body.count_sheet_url),
      music_note: clean(body.music_note),
      artistic_intent: clean(body.artistic_intent),
      status,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Could not create the work: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  const work = data as unknown as { id: string };
  return NextResponse.json({ id: work.id, status });
}
