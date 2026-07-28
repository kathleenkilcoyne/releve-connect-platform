// Admin — act on a studio's lifecycle. Gated on a signed-in admin
// (lib/admin-auth); writes via the service role.
//
// PATCH /api/admin/studios/<employerId>
//   body: { action }
//     action = "approve"   → status submitted → approved   (accepts the content)
//            | "publish"    → status approved  → live        (makes it PUBLIC)
//            | "unpublish"  → status live      → approved    (pull it back private)
//
// `approve` and `publish` are two DISTINCT steps, both admin-only — nothing
// auto-publishes (spec rule 9). The profile's `status` is the source of truth for
// publication (the public read RLS gates on status = 'live'); the invite row's
// status is a mirror for the admin list.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSiteUrl } from "@/lib/email/send";
import { sendStudioLive } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: "approve" | "publish" | "unpublish" };

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: profRow, error: loadErr } = await db
    .from("employer_profiles")
    .select("employer_id, name, status, owner_user_id")
    .eq("employer_id", id)
    .single();
  if (loadErr || !profRow) {
    return NextResponse.json({ error: "Studio not found." }, { status: 404 });
  }
  const prof = profRow as unknown as {
    employer_id: string;
    name: string | null;
    status: string;
    owner_user_id: string | null;
  };
  const now = new Date().toISOString();

  const transition = async (
    from: string[],
    to: string,
    extra: Record<string, unknown>,
  ): Promise<NextResponse | null> => {
    if (!from.includes(prof.status)) {
      return NextResponse.json(
        { error: `Cannot ${body.action} a studio that is "${prof.status}".` },
        { status: 409 },
      );
    }
    const { error } = await db
      .from("employer_profiles")
      .update({ status: to, updated_at: now, ...extra })
      .eq("employer_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Keep the invite mirror in step (best-effort).
    await db.from("founding_studio_invites").update({ status: to }).eq("employer_id", id);
    return null;
  };

  switch (body.action) {
    case "approve": {
      const err = await transition(["submitted"], "approved", { approved_at: now });
      if (err) return err;
      return NextResponse.json({ ok: true, status: "approved" });
    }

    case "publish": {
      const err = await transition(["approved"], "live", { live_at: now });
      if (err) return err;

      // Optional "you're live" note to the studio owner.
      if (prof.owner_user_id) {
        const { data: ownerRow } = await db
          .from("users")
          .select("email")
          .eq("user_id", prof.owner_user_id)
          .maybeSingle();
        const ownerEmail = (ownerRow as { email?: string } | null)?.email;
        if (ownerEmail) {
          await sendStudioLive({
            to: ownerEmail,
            studioName: prof.name || "Your studio",
            profileUrl: `${emailSiteUrl()}/studios`,
          });
        }
      }
      return NextResponse.json({ ok: true, status: "live" });
    }

    case "unpublish": {
      const err = await transition(["live"], "approved", { live_at: null });
      if (err) return err;
      return NextResponse.json({ ok: true, status: "approved" });
    }

    default:
      return NextResponse.json(
        { error: "action must be one of: approve, publish, unpublish." },
        { status: 400 },
      );
  }
}
