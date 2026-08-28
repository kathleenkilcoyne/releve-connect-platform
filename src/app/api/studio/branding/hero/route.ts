// Org Hero / Cover image — upload (replace) or remove.
//
// POST   /api/studio/branding/hero   multipart form-data: { file }
// DELETE /api/studio/branding/hero
//
// Same pattern as the existing logo upload (requireStudioAccess, org-branding
// bucket, {employer_id}/ prefix) — restricted to real photographs (PNG/JPEG,
// see org-photos.ts) rather than the logo's PNG/JPG/SVG. Writes run through the
// service role (the caller is already verified as this org's admin); the
// bucket's RLS admin-write policy (same one the logo uses) is a second guard.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireStudioAccess } from "@/lib/studio/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_PHOTO_BYTES, PHOTO_EXT_BY_TYPE, isAllowedPhotoType } from "@/lib/studio/org-photos";
import { orgBrandingPathFromUrl } from "@/lib/studio/org-branding-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (!isAllowedPhotoType(file.type)) {
    return NextResponse.json({ error: "Please upload a PNG or JPEG photo." }, { status: 415 });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: "That image is over 5 MB — please upload a smaller file." },
      { status: 413 },
    );
  }

  const db = createAdminClient();
  const ext = PHOTO_EXT_BY_TYPE[file.type];
  const path = `${gate.employerId}/hero-${randomBytes(6).toString("hex")}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage
    .from("org-branding")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) {
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = db.storage.from("org-branding").getPublicUrl(path);
  const url = pub.publicUrl;

  // Read the previous hero (if any) BEFORE overwriting, so the orphaned object
  // can be cleaned up — a hero is a single slot, unlike the gallery.
  const { data: before } = await db
    .from("employer_profiles")
    .select("hero_url")
    .eq("employer_id", gate.employerId)
    .maybeSingle();
  const previousUrl = (before as { hero_url: string | null } | null)?.hero_url ?? null;

  const { error: setErr } = await db
    .from("employer_profiles")
    .update({ hero_url: url, updated_at: new Date().toISOString() })
    .eq("employer_id", gate.employerId);
  if (setErr) {
    return NextResponse.json({ error: `Saved the file but could not set the hero image: ${setErr.message}` }, { status: 500 });
  }

  const previousPath = orgBrandingPathFromUrl(previousUrl);
  if (previousPath) await db.storage.from("org-branding").remove([previousPath]);

  return NextResponse.json({ ok: true, url });
}

export async function DELETE(req: Request) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;

  const db = createAdminClient();
  const { data: before } = await db
    .from("employer_profiles")
    .select("hero_url")
    .eq("employer_id", gate.employerId)
    .maybeSingle();
  const previousUrl = (before as { hero_url: string | null } | null)?.hero_url ?? null;

  const { error } = await db
    .from("employer_profiles")
    .update({ hero_url: null, updated_at: new Date().toISOString() })
    .eq("employer_id", gate.employerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const path = orgBrandingPathFromUrl(previousUrl);
  if (path) await db.storage.from("org-branding").remove([path]);

  return NextResponse.json({ ok: true });
}
