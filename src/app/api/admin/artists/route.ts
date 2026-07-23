// Admin helper — quick-create a (test) artist so a signature_work has an artist
// to hang off. Creates a users row + a talent_profile via the service role.
//
// POST /api/admin/artists   body: { displayName: string, email?: string }
//
// NOTE: this makes an "orphan" users row (a generated id not tied to a Supabase
// auth login) — fine for a founder/test artist who never signs in as that
// profile. Real artist profiles will come from the approved-application flow
// with a genuine auth user. See DECISIONS.md.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin, slugify } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  let body: { displayName?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const displayName = body.displayName?.trim();
  if (!displayName) {
    return NextResponse.json({ error: "displayName is required." }, { status: 400 });
  }

  const db = createAdminClient();
  const slug = slugify(displayName);
  const userId = randomUUID();
  const email = body.email?.trim() || `${slug}@artist.test`;

  const { error: userErr } = await db.from("users").insert({
    user_id: userId,
    email,
    account_type: "talent",
    display_name: displayName,
    status: "active",
  });
  if (userErr) {
    return NextResponse.json(
      { error: `Could not create the user: ${userErr.message}` },
      { status: 500 },
    );
  }

  const { data, error: profErr } = await db
    .from("talent_profiles")
    .insert({
      user_id: userId,
      display_name: displayName,
      public_slug: slug,
      primary_role: "choreographer",
      status: "approved",
    })
    .select("profile_id")
    .single();

  if (profErr || !data) {
    return NextResponse.json(
      { error: `Could not create the profile: ${profErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  const profile = data as unknown as { profile_id: string };
  return NextResponse.json({ profileId: profile.profile_id, slug });
}
