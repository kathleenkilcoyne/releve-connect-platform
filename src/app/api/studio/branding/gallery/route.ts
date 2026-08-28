// Org Additional Photos / Gallery — add one (up to 6 total) or remove one.
//
// POST   /api/studio/branding/gallery   multipart form-data: { file }
// DELETE /api/studio/branding/gallery   JSON body: { url }
//
// Same org-branding bucket/prefix/RLS as the logo and hero uploads. The
// gallery itself lives as a jsonb array on employer_profiles.gallery_urls
// (mirrors talent_profiles.gallery_urls exactly) — capped at 6 by both a DB
// CHECK constraint and this route's own pre-check.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireStudioAccess } from "@/lib/studio/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_GALLERY_IMAGES, MAX_PHOTO_BYTES, PHOTO_EXT_BY_TYPE, canAddGalleryPhoto, isAllowedPhotoType } from "@/lib/studio/org-photos";
import { orgBrandingPathFromUrl } from "@/lib/studio/org-branding-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentGallery(db: ReturnType<typeof createAdminClient>, employerId: string): Promise<string[]> {
  const { data } = await db.from("employer_profiles").select("gallery_urls").eq("employer_id", employerId).maybeSingle();
  return ((data as { gallery_urls: string[] } | null)?.gallery_urls ?? []) as string[];
}

export async function POST(req: Request) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;

  const db = createAdminClient();
  const existing = await currentGallery(db, gate.employerId);
  if (!canAddGalleryPhoto(existing.length)) {
    return NextResponse.json({ error: `You can add up to ${MAX_GALLERY_IMAGES} photos.` }, { status: 409 });
  }

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

  const ext = PHOTO_EXT_BY_TYPE[file.type];
  const path = `${gate.employerId}/gallery-${randomBytes(6).toString("hex")}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage.from("org-branding").upload(path, bytes, { contentType: file.type });
  if (upErr) {
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = db.storage.from("org-branding").getPublicUrl(path);
  const url = pub.publicUrl;

  // Re-read immediately before writing (defense against two uploads racing
  // past the pre-check above) and re-check the cap one last time.
  const latest = await currentGallery(db, gate.employerId);
  if (!canAddGalleryPhoto(latest.length)) {
    await db.storage.from("org-branding").remove([path]); // don't leave an orphaned upload
    return NextResponse.json({ error: `You can add up to ${MAX_GALLERY_IMAGES} photos.` }, { status: 409 });
  }
  const next = [...latest, url];

  const { error: setErr } = await db
    .from("employer_profiles")
    .update({ gallery_urls: next, updated_at: new Date().toISOString() })
    .eq("employer_id", gate.employerId);
  if (setErr) {
    await db.storage.from("org-branding").remove([path]);
    return NextResponse.json({ error: `Saved the file but could not add it to your gallery: ${setErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url, gallery_urls: next });
}

export async function DELETE(req: Request) {
  const gate = await requireStudioAccess(req);
  if (!gate.ok) return gate.response;

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const url = String(body.url ?? "").trim();
  if (!url) return NextResponse.json({ error: "url is required." }, { status: 400 });

  const db = createAdminClient();
  const existing = await currentGallery(db, gate.employerId);
  if (!existing.includes(url)) {
    return NextResponse.json({ error: "That photo isn't in your gallery." }, { status: 404 });
  }
  const next = existing.filter((u) => u !== url);

  const { error } = await db
    .from("employer_profiles")
    .update({ gallery_urls: next, updated_at: new Date().toISOString() })
    .eq("employer_id", gate.employerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const path = orgBrandingPathFromUrl(url);
  if (path) await db.storage.from("org-branding").remove([path]);

  return NextResponse.json({ ok: true, gallery_urls: next });
}
