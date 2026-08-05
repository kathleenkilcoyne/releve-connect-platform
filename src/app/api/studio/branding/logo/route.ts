// Org branding — upload a logo / mascot (sets employer_profiles.logo_url).
//
// POST /api/studio/branding/logo   multipart form-data: { file }
//
// Gated to the caller's OWN org (requireStudioAccess). The object is stored under
// the org's own prefix — org-branding/{employer_id}/logo-<rand>.<ext> — in the
// public-read bucket, then logo_url is pointed at its public URL. PNG/JPG/SVG,
// <= 2 MB. Writes run through the service role (the caller is already verified as
// this org's admin); the bucket's RLS admin-write policy is a second guard.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireStudioAccess } from "@/lib/studio/access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};

export async function POST(req: Request) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Please upload a PNG, JPG, or SVG image." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That image is over 2 MB — please upload a smaller file." },
      { status: 413 },
    );
  }

  const db = createAdminClient();
  const path = `${gate.employerId}/logo-${randomBytes(6).toString("hex")}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage
    .from("org-branding")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) {
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = db.storage.from("org-branding").getPublicUrl(path);
  const url = pub.publicUrl;

  const { error: setErr } = await db
    .from("employer_profiles")
    .update({ logo_url: url, updated_at: new Date().toISOString() })
    .eq("employer_id", gate.employerId);
  if (setErr) {
    return NextResponse.json({ error: `Saved the file but could not set the logo: ${setErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url });
}
